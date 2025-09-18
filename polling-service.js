import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import { LinearAPIClient } from './linear-client.js';
import { Logger } from './logger.js';

export class LinearPollingService {
    constructor(extension, notificationManager) {
        this.extension = extension;
        this.settings = extension.getSettings();
        this.linearClient = new LinearAPIClient(extension);
        this.notificationManager = notificationManager;
        this.isPolling = false;
        this.timeoutId = null;
        this.lastKnownUpdates = new Set();
        this.logger = new Logger('PollingService');

        this.logger.debug('Initialized');

        this.settings.connect('changed::polling-interval', () => {
            this.logger.debug('Polling interval changed, restarting service');
            this.restart();
        });

        this.settings.connect('changed::oauth-token', () => {
            this.logger.debug('OAuth token changed, restarting service');
            this.restart();
        });
    }

    start() {
        if (this.isPolling) {
            this.logger.debug('Already polling');
            return;
        }

        // Check authentication status
        const isAuth = this.linearClient.isAuthenticated();

        if (!isAuth) {
            this.logger.warn('Cannot start polling - not authenticated');
            return;
        }

        this.isPolling = true;
        this.logger.info('Started polling service');

        // Do initial poll immediately
        this.poll();

        // Schedule regular polling
        this.scheduleNextPoll();
    }

    stop() {
        this.logger.info('Stopping polling service');
        this.isPolling = false;

        if (this.timeoutId) {
            GLib.Source.remove(this.timeoutId);
            this.timeoutId = null;
        }
    }

    restart() {
        this.stop();
        this.start();
    }

    scheduleNextPoll() {
        if (!this.isPolling) {
            return;
        }

        const intervalSeconds = Math.max(30, this.settings.get_int('polling-interval'));
        this.logger.debug(`Next poll in ${intervalSeconds} seconds`);

        this.timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            intervalSeconds,
            () => {
                this.poll();
                this.scheduleNextPoll();
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    async poll() {
        if (!this.isPolling) {
            return;
        }

        if (!this.linearClient.isAuthenticated()) {
            this.logger.debug('Not authenticated, skipping poll');
            return;
        }

        try {
            this.logger.debug('Polling for updates');
            const updates = await this.linearClient.getUpdates();
            this.logger.debug(`Received ${updates.length} total updates`);

            // Filter out updates we've already seen
            const newUpdates = updates.filter(update => !this.lastKnownUpdates.has(update.id));

            if (newUpdates.length > 0) {
                this.logger.info(`Found ${newUpdates.length} new updates`);
                this.logger.debug('New updates:', newUpdates.map(u => `${u.type}: ${u.title}`));

                for (const update of newUpdates) {
                    const notification = this.convertUpdateToNotification(update);
                    if (this.notificationManager) {
                        this.notificationManager.showNotification(notification);
                    }
                    this.lastKnownUpdates.add(update.id);
                }

                // Clean up old update IDs to prevent memory leak
                this.cleanupOldUpdateIds();
            } else {
                this.logger.debug('No new updates found');
            }

        } catch (error) {
            this.logger.error('Failed to poll updates:', error.message);

            if (this.isAuthenticationError(error)) {
                this.logger.warn('Authentication error detected, stopping polling');
                this.stop();
            }
        }
    }

    convertUpdateToNotification(update) {
        return {
            id: update.id,
            title: update.title,
            body: update.body,
            url: update.url,
            type: update.type,
            timestamp: update.updatedAt,
            data: update.data
        };
    }

    /**
     * Clean up old update IDs to prevent memory leak
     * Keep only the last 1000 update IDs
     */
    cleanupOldUpdateIds() {
        if (this.lastKnownUpdates.size > 1000) {
            const updateIds = Array.from(this.lastKnownUpdates);
            const keepIds = updateIds.slice(-500); // Keep most recent 500

            this.lastKnownUpdates.clear();
            keepIds.forEach(id => this.lastKnownUpdates.add(id));

            console.log('Cleaned up old update IDs, keeping 500 most recent');
        }
    }

    isAuthenticationError(error) {
        const errorMessage = error?.message?.toLowerCase() || '';
        return errorMessage.includes('unauthorized') ||
               errorMessage.includes('invalid token') ||
               errorMessage.includes('authentication');
    }

    async testConnection() {
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

    getPollingInterval() {
        return this.settings.get_int('polling-interval');
    }

    setPollingInterval(seconds) {
        if (seconds < 30 || seconds > 300) {
            throw new Error('Polling interval must be between 30 and 300 seconds');
        }

        this.settings.set_int('polling-interval', seconds);
    }

    /**
     * Force a poll right now (for testing or manual refresh)
     */
    async forcePoll() {
        console.log('Force polling Linear updates...');
        await this.poll();
    }

    /**
     * Get polling status
     */
    getStatus() {
        return {
            isPolling: this.isPolling,
            isAuthenticated: this.linearClient.isAuthenticated(),
            pollingInterval: this.getPollingInterval(),
            lastKnownUpdateCount: this.lastKnownUpdates.size
        };
    }

    /**
     * Reset polling state (clear known updates)
     */
    reset() {
        console.log('Resetting Linear polling service state');
        this.lastKnownUpdates.clear();
    }

    /**
     * Cleanup when service is destroyed
     */
    destroy() {
        this.stop();

        if (this.linearClient) {
            this.linearClient.destroy();
            this.linearClient = null;
        }

        console.log('LinearPollingService destroyed');
    }
}