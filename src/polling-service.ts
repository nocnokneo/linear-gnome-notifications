import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import { LinearAPIClient, LinearUpdate } from './linear-client.js';
import { LinearNotificationManager, LinearNotification } from './notification-manager.js';

export class LinearPollingService {
    private extension: Extension;
    private settings: Gio.Settings;
    private linearClient: LinearAPIClient;
    private notificationManager: LinearNotificationManager;
    private timeoutId?: number;
    private isPolling: boolean = false;

    constructor(extension: Extension, notificationManager: LinearNotificationManager) {
        this.extension = extension;
        this.settings = extension.getSettings();
        this.linearClient = new LinearAPIClient(extension);
        this.notificationManager = notificationManager;

        this.settings.connect('changed::polling-interval', () => {
            this.restart();
        });

        this.settings.connect('changed::oauth-token', () => {
            this.restart();
        });
    }

    start() {
        if (this.isPolling) {
            return;
        }

        this.isPolling = true;
        this.scheduleNextPoll();
        console.log('Linear polling service started');
    }

    stop() {
        if (this.timeoutId) {
            GLib.source_remove(this.timeoutId);
            this.timeoutId = undefined;
        }

        this.isPolling = false;
        console.log('Linear polling service stopped');
    }

    restart() {
        this.stop();
        this.start();
    }

    private scheduleNextPoll() {
        if (!this.isPolling) {
            return;
        }

        const intervalSeconds = this.settings.get_int('polling-interval');
        const intervalMs = intervalSeconds * 1000;

        this.timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, intervalMs, () => {
            this.poll();
            this.scheduleNextPoll();
            return false;
        });
    }

    private async poll() {
        if (!this.linearClient.isAuthenticated()) {
            console.log('Linear client not authenticated, skipping poll');
            return;
        }

        try {
            console.log('Polling Linear for updates...');
            const updates = await this.linearClient.getUpdates();

            for (const update of updates) {
                const notification = this.convertUpdateToNotification(update);
                this.notificationManager.showNotification(notification);
            }

            if (updates.length > 0) {
                console.log(`Processed ${updates.length} Linear updates`);
            }

        } catch (error) {
            console.error('Failed to poll Linear updates:', error);

            if (this.isAuthenticationError(error)) {
                console.log('Authentication error detected, stopping polling');
                this.stop();
            }
        }
    }

    private convertUpdateToNotification(update: LinearUpdate): LinearNotification {
        return {
            id: update.id,
            title: update.title,
            body: update.body,
            url: update.url,
            type: update.type
        };
    }

    private isAuthenticationError(error: any): boolean {
        const errorMessage = error?.message?.toLowerCase() || '';
        return errorMessage.includes('unauthorized') ||
               errorMessage.includes('invalid token') ||
               errorMessage.includes('authentication');
    }

    async testConnection(): Promise<boolean> {
        if (!this.linearClient.isAuthenticated()) {
            return false;
        }

        try {
            await this.linearClient.getCurrentUser();
            return true;
        } catch (error) {
            console.error('Test connection failed:', error);
            return false;
        }
    }

    getPollingInterval(): number {
        return this.settings.get_int('polling-interval');
    }

    setPollingInterval(seconds: number) {
        if (seconds < 30 || seconds > 300) {
            throw new Error('Polling interval must be between 30 and 300 seconds');
        }

        this.settings.set_int('polling-interval', seconds);
    }
}