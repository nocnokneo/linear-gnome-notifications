import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { LinearNotificationManager } from './notification-manager.js';
import { LinearPollingService } from './polling-service.js';

export default class LinearNotificationsExtension extends Extension {
    private notificationManager?: LinearNotificationManager;
    private pollingService?: LinearPollingService;

    enable() {
        this.notificationManager = new LinearNotificationManager(this);
        this.pollingService = new LinearPollingService(this, this.notificationManager);

        this.pollingService.start();

        console.log('Linear Desktop Notifications extension enabled');
    }

    disable() {
        this.pollingService?.stop();
        this.pollingService = undefined;
        this.notificationManager = undefined;

        console.log('Linear Desktop Notifications extension disabled');
    }
}