import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';
import { Logger } from './logger.js';

export class LinearNotificationManager {
    constructor(extension) {
        this.extension = extension;
        this.settings = extension.getSettings();
        this.logger = new Logger('NotificationManager');
        this.avatarCache = new Map();
        this.httpSession = new Soup.Session();
        this.cacheDir = GLib.build_filenamev([GLib.get_user_cache_dir(), 'linear-notifications', 'avatars']);
        this.ensureCacheDir();
        this.initializeSource();
    }

    initializeSource() {
        this.source = new MessageTray.Source({
            title: 'Linear Notifications',
            iconName: 'applications-internet-symbolic'
        });

        Main.messageTray.add(this.source);
    }

    ensureSource() {
        // Always recreate if source is null
        if (!this.source) {
            this.logger.debug('Source missing, creating...');
            this.initializeSource();
            return;
        }

        // Test if source is still usable by attempting a safe operation
        try {
            // Try to access a property - this will fail if disposed
            this.source.title;
        } catch (error) {
            this.logger.debug('Source disposed, recreating...', error.message);
            this.initializeSource();
        }
    }

    isDarkTheme() {
        try {
            // Check GNOME's interface color scheme setting
            const interfaceSettings = new Gio.Settings({ schema: 'org.gnome.desktop.interface' });
            const colorScheme = interfaceSettings.get_string('color-scheme');

            // 'prefer-dark' means dark theme, 'default' or 'prefer-light' means light theme
            return colorScheme === 'prefer-dark';
        } catch (error) {
            this.logger.debug('Failed to detect theme, defaulting to light theme:', error);
            return false; // Default to light theme if detection fails
        }
    }

    showNotification(notification) {
        this.ensureSource();

        if (!this.shouldShowNotification(notification)) {
            return;
        }

        const gnomeNotification = new MessageTray.Notification({
            source: this.source,
            title: notification.title,
            body: notification.body,
            isTransient: false
        });

        // Handle clicking on the notification itself (not just action buttons)
        gnomeNotification.connect('activated', () => {
            this.logger.debug('Notification clicked, opening URL:', notification.url);
            this.handleNotificationClick(notification.url);
        });

        // Primary action - open in Linear
        gnomeNotification.addAction('Open', () => {
            this.handleNotificationClick(notification.url);
        });

        // If this is a Linear notification, add mark as read action
        if (notification.data?.notificationId) {
            gnomeNotification.addAction('Mark Read', () => {
                this.markNotificationAsRead(notification.data.notificationId);
            });

            gnomeNotification.addAction('Snooze 1h', () => {
                const oneHourLater = new Date();
                oneHourLater.setHours(oneHourLater.getHours() + 1);
                this.snoozeNotification(notification.data.notificationId, oneHourLater.toISOString());
            });
        }

        // Try to set custom avatar icon if available
        const actorIcon = this.getActorIcon(notification.data?.actor);
        if (actorIcon) {
            gnomeNotification.set_gicon(actorIcon);
        }

        this.source.addNotification(gnomeNotification);
    }

    /**
     * Ensure cache directory exists
     */
    ensureCacheDir() {
        try {
            const cacheDir = Gio.File.new_for_path(this.cacheDir);
            if (!cacheDir.query_exists(null)) {
                cacheDir.make_directory_with_parents(null);
                this.logger.debug(`Created cache directory: ${this.cacheDir}`);
            }
        } catch (error) {
            this.logger.error('Failed to create cache directory:', error);
        }
    }

    /**
     * Get or create avatar icon for actor
     */
    getActorIcon(actor) {
        if (!actor) return null;

        const cacheKey = `${actor.displayName}-${actor.avatarUrl || actor.avatarBackgroundColor}`;

        if (this.avatarCache.has(cacheKey)) {
            return this.avatarCache.get(cacheKey);
        }

        // Check if we have a cached file
        const cachedIcon = this.loadCachedAvatar(cacheKey);
        if (cachedIcon) {
            this.avatarCache.set(cacheKey, cachedIcon);
            return cachedIcon;
        }

        // Create new avatar asynchronously
        this.createActorAvatar(actor, cacheKey);

        return null; // Return null for now, will be cached for next time
    }

    /**
     * Load cached avatar from disk
     */
    loadCachedAvatar(cacheKey) {
        try {
            // Try PNG first (downloaded avatars)
            let cachePath = GLib.build_filenamev([this.cacheDir, `${cacheKey}.png`]);
            let file = Gio.File.new_for_path(cachePath);

            if (file.query_exists(null)) {
                return Gio.FileIcon.new(file);
            }

            // Try SVG (generated avatars)
            cachePath = GLib.build_filenamev([this.cacheDir, `${cacheKey}.svg`]);
            file = Gio.File.new_for_path(cachePath);

            if (file.query_exists(null)) {
                return Gio.FileIcon.new(file);
            }
        } catch (error) {
            this.logger.debug('Failed to load cached avatar:', error);
        }

        return null;
    }

    /**
     * Create avatar for actor (async operation)
     */
    async createActorAvatar(actor, cacheKey) {
        try {
            let icon = null;

            if (actor.avatarUrl) {
                // Try to download and cache avatar image
                icon = await this.downloadAvatar(actor.avatarUrl, cacheKey);
            }

            if (!icon && actor.avatarBackgroundColor && actor.initials) {
                // Create colored avatar with initials
                icon = await this.createColoredAvatar(
                    actor.initials,
                    actor.avatarBackgroundColor,
                    cacheKey
                );
            }

            if (icon) {
                this.avatarCache.set(cacheKey, icon);
                this.logger.debug(`Created avatar for ${actor.displayName}`);
            }
        } catch (error) {
            this.logger.error('Failed to create avatar for', actor.displayName, error);
        }
    }

    /**
     * Download avatar from URL and cache it
     */
    async downloadAvatar(avatarUrl, cacheKey) {
        return new Promise((resolve) => {
            try {
                const message = Soup.Message.new('GET', avatarUrl);

                this.httpSession.send_and_read_async(
                    message,
                    GLib.PRIORITY_DEFAULT,
                    null,
                    (session, result) => {
                        try {
                            const bytes = session.send_and_read_finish(result);

                            if (message.get_status() === Soup.Status.OK) {
                                const cachePath = GLib.build_filenamev([this.cacheDir, `${cacheKey}.png`]);
                                const file = Gio.File.new_for_path(cachePath);

                                // Save image data to cache
                                const outputStream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
                                outputStream.write_all(bytes.get_data(), null);
                                outputStream.close(null);

                                // Create GIcon from cached file
                                const icon = Gio.FileIcon.new(file);
                                resolve(icon);
                            } else {
                                resolve(null);
                            }
                        } catch (error) {
                            this.logger.debug('Avatar download failed:', error);
                            resolve(null);
                        }
                    }
                );
            } catch (error) {
                this.logger.debug('Avatar download setup failed:', error);
                resolve(null);
            }
        });
    }

    /**
     * Create colored avatar with initials
     */
    async createColoredAvatar(initials, backgroundColor, cacheKey) {
        return new Promise((resolve) => {
            try {
                // Create a simple SVG avatar
                const size = 48;
                const svgContent = `
                    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${backgroundColor}"/>
                        <text x="${size/2}" y="${size/2 + 5}" text-anchor="middle"
                              font-family="sans-serif" font-size="18" font-weight="bold" fill="white">
                            ${initials}
                        </text>
                    </svg>
                `;

                const cachePath = GLib.build_filenamev([this.cacheDir, `${cacheKey}.svg`]);
                const file = Gio.File.new_for_path(cachePath);

                // Save SVG to cache
                const outputStream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
                outputStream.write_all(new TextEncoder().encode(svgContent), null);
                outputStream.close(null);

                // Create GIcon from SVG file
                const icon = Gio.FileIcon.new(file);
                resolve(icon);

            } catch (error) {
                this.logger.debug('Colored avatar creation failed:', error);
                resolve(null);
            }
        });
    }

    shouldShowNotification(notification) {
        switch (notification.type) {
            case 'new_issue':
                return this.settings.get_boolean('notify-new-issues');
            case 'issue_updated':
                return this.settings.get_boolean('notify-issue-updates');
            case 'issue_assigned':
                return this.settings.get_boolean('notify-assigned-issues');
            case 'issue_unassigned':
                return this.settings.get_boolean('notify-assigned-issues');
            case 'new_comment':
                return this.settings.get_boolean('notify-comments');
            case 'mentioned':
                return this.settings.get_boolean('notify-mentions');
            case 'status_change':
                return this.settings.get_boolean('notify-status-changes');
            default:
                return true;
        }
    }

    handleNotificationClick(url) {
        const clickAction = this.settings.get_string('click-action');

        if (clickAction === 'browser') {
            this.openInBrowser(url);
        } else if (clickAction === 'custom') {
            this.runCustomCommand(url);
        }
    }

    openInBrowser(url) {
        try {
            Gio.AppInfo.launch_default_for_uri(url, null);
        } catch (error) {
            this.logger.error('Failed to open URL in browser:', error);
        }
    }

    runCustomCommand(url) {
        const customCommand = this.settings.get_string('custom-command');

        if (!customCommand) {
            this.logger.error('Custom command not configured');
            return;
        }

        const command = customCommand.replace('{{URL}}', url);

        try {
            GLib.spawn_command_line_async(command);
        } catch (error) {
            this.logger.error('Failed to run custom command:', error);
        }
    }

    async markNotificationAsRead(notificationId) {
        try {
            // Get the Linear API client from the extension
            const linearClient = this.extension.linearClient;
            if (linearClient) {
                await linearClient.markNotificationAsRead(notificationId);
                this.logger.debug(`Marked notification ${notificationId} as read`);
            }
        } catch (error) {
            this.logger.error('Failed to mark notification as read:', error);
        }
    }

    async snoozeNotification(notificationId, snoozedUntilAt) {
        try {
            // Get the Linear API client from the extension
            const linearClient = this.extension.linearClient;
            if (linearClient) {
                await linearClient.snoozeNotification(notificationId, snoozedUntilAt);
                this.logger.debug(`Snoozed notification ${notificationId} until ${snoozedUntilAt}`);
            }
        } catch (error) {
            this.logger.error('Failed to snooze notification:', error);
        }
    }

    destroy() {
        if (this.source) {
            this.source.destroy();
            this.source = null;
        }

        if (this.httpSession) {
            this.httpSession = null;
        }

        this.avatarCache.clear();
    }
}