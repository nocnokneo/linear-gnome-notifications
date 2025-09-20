import * as Extension from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { LinearNotificationManager } from './notification-manager.js';
import { LinearPollingService } from './polling-service.js';
import { LinearOAuthHandler } from './oauth-handler.js';
import { Logger } from './logger.js';

export default class LinearNotificationsExtension extends Extension.Extension {
    enable() {
        this.logger = new Logger('Extension');
        this.settings = this.getSettings();

        // Initialize OAuth handler
        this.oauthHandler = new LinearOAuthHandler(this);

        // Initialize notification manager and polling service
        this.notificationManager = new LinearNotificationManager(this);
        this.pollingService = new LinearPollingService(this, this.notificationManager);

        // Expose Linear API client for notification actions
        this.linearClient = this.pollingService.linearClient;

        // Watch for OAuth flow trigger from preferences
        this.oauthFlowConnection = this.settings.connect('changed::start-oauth-flow', () => {
            const shouldStart = this.settings.get_boolean('start-oauth-flow');
            if (shouldStart) {
                this.startOAuthFlow();
            }
        });

        // Watch for OAuth success to restart polling
        this.oauthSuccessConnection = this.settings.connect('changed::oauth-token', () => {
            if (this.oauthHandler.isAuthenticated()) {
                this.logger.info('OAuth authentication completed, restarting polling...');
                this.pollingService.restart();
            }
        });

        // Watch for API token changes to restart polling
        this.apiTokenConnection = this.settings.connect('changed::api-token', () => {
            this.logger.info('API token changed, checking authentication...');
            if (this.pollingService.linearClient.isAuthenticated()) {
                this.logger.info('API token authentication successful, restarting polling...');
                this.pollingService.restart();
            } else {
                this.logger.warn('API token authentication failed, stopping polling...');
                this.pollingService.stop();
            }
        });

        // Watch for auth method changes
        this.authMethodConnection = this.settings.connect('changed::auth-method', () => {
            const authMethod = this.settings.get_string('auth-method');
            this.logger.info('Authentication method changed to:', authMethod);
            this.pollingService.restart();
        });

        // Start polling service with enhanced debug logging
        this.logger.info('Starting Linear Desktop Notifications extension...');
        const authMethod = this.settings.get_string('auth-method');
        this.logger.info('Authentication method:', authMethod);

        if (this.pollingService.linearClient.isAuthenticated()) {
            this.logger.info('Authentication successful - starting polling service');
        } else {
            this.logger.warn('Not authenticated - polling service may not work');
        }

        this.pollingService.start();

        this.logger.info('Linear Desktop Notifications extension enabled');
    }

    async startOAuthFlow() {
        try {
            this.logger.info('Starting OAuth flow from extension...');
            await this.oauthHandler.startAuthFlow();
        } catch (error) {
            this.logger.error('OAuth flow failed:', error);
            Main.notifyError('Linear Authentication Failed', error.message);
        }
    }

    disable() {
        // Disconnect settings handlers
        if (this.oauthFlowConnection) {
            this.settings.disconnect(this.oauthFlowConnection);
            this.oauthFlowConnection = null;
        }

        if (this.oauthSuccessConnection) {
            this.settings.disconnect(this.oauthSuccessConnection);
            this.oauthSuccessConnection = null;
        }

        if (this.apiTokenConnection) {
            this.settings.disconnect(this.apiTokenConnection);
            this.apiTokenConnection = null;
        }

        if (this.authMethodConnection) {
            this.settings.disconnect(this.authMethodConnection);
            this.authMethodConnection = null;
        }

        // Cleanup components
        this.pollingService?.stop();
        this.pollingService = null;

        this.notificationManager?.destroy();
        this.notificationManager = null;

        this.oauthHandler?.destroy();
        this.oauthHandler = null;

        this.settings = null;

        this.logger.info('Linear Desktop Notifications extension disabled');
    }
}