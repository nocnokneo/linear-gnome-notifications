import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export class LinearNotificationManager {
    constructor(extension) {
        this.extension = extension;
        this.settings = extension.getSettings();
        this.initializeSource();
    }

    initializeSource() {
        this.source = new MessageTray.Source({
            title: 'Linear Notifications',
            iconName: 'preferences-system-notifications-symbolic'
        });

        Main.messageTray.add(this.source);
    }

    showNotification(notification) {
        if (!this.source) {
            console.error('Notification source not initialized');
            return;
        }

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
            console.log('Linear notification clicked, opening URL:', notification.url);
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

        this.source.addNotification(gnomeNotification);
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
            console.error('Failed to open URL in browser:', error);
        }
    }

    runCustomCommand(url) {
        const customCommand = this.settings.get_string('custom-command');

        if (!customCommand) {
            console.error('Custom command not configured');
            return;
        }

        const command = customCommand.replace('{{URL}}', url);

        try {
            GLib.spawn_command_line_async(command);
        } catch (error) {
            console.error('Failed to run custom command:', error);
        }
    }

    async markNotificationAsRead(notificationId) {
        try {
            // Get the Linear API client from the extension
            const linearClient = this.extension.linearClient;
            if (linearClient) {
                await linearClient.markNotificationAsRead(notificationId);
                console.log(`Marked Linear notification ${notificationId} as read`);
            }
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    }

    async snoozeNotification(notificationId, snoozedUntilAt) {
        try {
            // Get the Linear API client from the extension
            const linearClient = this.extension.linearClient;
            if (linearClient) {
                await linearClient.snoozeNotification(notificationId, snoozedUntilAt);
                console.log(`Snoozed Linear notification ${notificationId} until ${snoozedUntilAt}`);
            }
        } catch (error) {
            console.error('Failed to snooze notification:', error);
        }
    }

    destroy() {
        if (this.source) {
            this.source.destroy();
            this.source = null;
        }
    }
}