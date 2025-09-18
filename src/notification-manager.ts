import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export interface LinearNotification {
    id: string;
    title: string;
    body: string;
    url: string;
    type: 'issue' | 'comment' | 'status_change';
}

export class LinearNotificationManager {
    private extension: Extension;
    private settings: Gio.Settings;
    private source?: MessageTray.Source;

    constructor(extension: Extension) {
        this.extension = extension;
        this.settings = extension.getSettings();
        this.initializeSource();
    }

    private initializeSource() {
        this.source = new MessageTray.Source({
            title: 'Linear Notifications',
            iconName: 'preferences-system-notifications-symbolic'
        });

        Main.messageTray.add(this.source);
    }

    showNotification(notification: LinearNotification) {
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

        gnomeNotification.addAction('Open', () => {
            this.handleNotificationClick(notification.url);
        });

        this.source.addNotification(gnomeNotification);
    }

    private shouldShowNotification(notification: LinearNotification): boolean {
        switch (notification.type) {
            case 'issue':
                return this.settings.get_boolean('notify-new-issues');
            case 'comment':
                return this.settings.get_boolean('notify-comments');
            case 'status_change':
                return this.settings.get_boolean('notify-status-changes');
            default:
                return true;
        }
    }

    private handleNotificationClick(url: string) {
        const clickAction = this.settings.get_string('click-action');

        if (clickAction === 'browser') {
            this.openInBrowser(url);
        } else if (clickAction === 'custom') {
            this.runCustomCommand(url);
        }
    }

    private openInBrowser(url: string) {
        try {
            Gio.AppInfo.launch_default_for_uri(url, null);
        } catch (error) {
            console.error('Failed to open URL in browser:', error);
        }
    }

    private runCustomCommand(url: string) {
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

    destroy() {
        if (this.source) {
            this.source.destroy();
            this.source = undefined;
        }
    }
}