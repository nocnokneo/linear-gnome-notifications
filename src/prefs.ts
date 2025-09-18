import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { LinearOAuthHandler } from './oauth-handler.js';
import { LinearAPIClient } from './linear-client.js';

export default class LinearNotificationsPreferences extends ExtensionPreferences {
    private settings?: Gio.Settings;
    private oauthHandler?: LinearOAuthHandler;
    private linearClient?: LinearAPIClient;

    fillPreferencesWindow(window: Adw.PreferencesWindow) {
        this.settings = this.getSettings();
        this.oauthHandler = new LinearOAuthHandler(this);
        this.linearClient = new LinearAPIClient(this);

        const authPage = this.createAuthenticationPage();
        const notificationPage = this.createNotificationPage();
        const behaviorPage = this.createBehaviorPage();

        window.add(authPage);
        window.add(notificationPage);
        window.add(behaviorPage);
    }

    private createAuthenticationPage(): Adw.PreferencesPage {
        const page = new Adw.PreferencesPage({
            title: 'Authentication',
            iconName: 'dialog-password-symbolic'
        });

        const authGroup = new Adw.PreferencesGroup({
            title: 'Linear OAuth',
            description: 'Connect your Linear account to receive notifications'
        });

        const statusRow = new Adw.ActionRow({
            title: 'Connection Status'
        });

        const connectionLabel = new Gtk.Label({
            label: this.oauthHandler!.isAuthenticated() ? 'Connected' : 'Not Connected',
            cssClasses: this.oauthHandler!.isAuthenticated() ? ['success'] : ['error']
        });
        statusRow.add_suffix(connectionLabel);

        if (!this.oauthHandler!.isAuthenticated()) {
            const authButton = new Gtk.Button({
                label: 'Authenticate',
                cssClasses: ['suggested-action']
            });

            authButton.connect('clicked', () => {
                this.showAuthenticationDialog(window.get_root() as Gtk.Window);
            });

            statusRow.add_suffix(authButton);
        } else {
            const disconnectButton = new Gtk.Button({
                label: 'Disconnect',
                cssClasses: ['destructive-action']
            });

            disconnectButton.connect('clicked', () => {
                this.oauthHandler!.revokeToken();
                connectionLabel.set_label('Not Connected');
                connectionLabel.cssClasses = ['error'];
            });

            statusRow.add_suffix(disconnectButton);
        }

        authGroup.add(statusRow);

        const tokenRow = new Adw.PasswordEntryRow({
            title: 'OAuth Token',
            text: this.settings!.get_string('oauth-token')
        });

        tokenRow.connect('changed', () => {
            this.settings!.set_string('oauth-token', tokenRow.get_text());
        });

        authGroup.add(tokenRow);

        page.add(authGroup);
        return page;
    }

    private createNotificationPage(): Adw.PreferencesPage {
        const page = new Adw.PreferencesPage({
            title: 'Notifications',
            iconName: 'preferences-system-notifications-symbolic'
        });

        const notificationGroup = new Adw.PreferencesGroup({
            title: 'Notification Types',
            description: 'Choose which events should trigger notifications'
        });

        const newIssuesRow = new Adw.SwitchRow({
            title: 'New Issues',
            subtitle: 'Show notifications when new issues are created',
            active: this.settings!.get_boolean('notify-new-issues')
        });

        newIssuesRow.connect('notify::active', () => {
            this.settings!.set_boolean('notify-new-issues', newIssuesRow.active);
        });

        const assignedRow = new Adw.SwitchRow({
            title: 'Assigned Issues',
            subtitle: 'Show notifications when issues are assigned to you',
            active: this.settings!.get_boolean('notify-assigned-issues')
        });

        assignedRow.connect('notify::active', () => {
            this.settings!.set_boolean('notify-assigned-issues', assignedRow.active);
        });

        const commentsRow = new Adw.SwitchRow({
            title: 'Comments',
            subtitle: 'Show notifications when comments are added',
            active: this.settings!.get_boolean('notify-comments')
        });

        commentsRow.connect('notify::active', () => {
            this.settings!.set_boolean('notify-comments', commentsRow.active);
        });

        const statusRow = new Adw.SwitchRow({
            title: 'Status Changes',
            subtitle: 'Show notifications when issue status changes',
            active: this.settings!.get_boolean('notify-status-changes')
        });

        statusRow.connect('notify::active', () => {
            this.settings!.set_boolean('notify-status-changes', statusRow.active);
        });

        notificationGroup.add(newIssuesRow);
        notificationGroup.add(assignedRow);
        notificationGroup.add(commentsRow);
        notificationGroup.add(statusRow);

        page.add(notificationGroup);
        return page;
    }

    private createBehaviorPage(): Adw.PreferencesPage {
        const page = new Adw.PreferencesPage({
            title: 'Behavior',
            iconName: 'preferences-system-symbolic'
        });

        const pollingGroup = new Adw.PreferencesGroup({
            title: 'Polling',
            description: 'Configure how often to check for updates'
        });

        const intervalRow = new Adw.SpinRow({
            title: 'Polling Interval',
            subtitle: 'How often to check for updates (seconds)',
            adjustment: Gtk.Adjustment.new(
                this.settings!.get_int('polling-interval'),
                30,
                300,
                10,
                30,
                0
            )
        });

        intervalRow.connect('changed', () => {
            this.settings!.set_int('polling-interval', intervalRow.get_value());
        });

        pollingGroup.add(intervalRow);

        const clickGroup = new Adw.PreferencesGroup({
            title: 'Click Action',
            description: 'What happens when you click a notification'
        });

        const clickActionRow = new Adw.ComboRow({
            title: 'Click Action',
            subtitle: 'Choose what happens when notifications are clicked'
        });

        const stringList = Gtk.StringList.new(['Open in Browser', 'Run Custom Command']);
        clickActionRow.set_model(stringList);
        clickActionRow.set_selected(this.settings!.get_string('click-action') === 'browser' ? 0 : 1);

        clickActionRow.connect('notify::selected', () => {
            const action = clickActionRow.get_selected() === 0 ? 'browser' : 'custom';
            this.settings!.set_string('click-action', action);
        });

        const customCommandRow = new Adw.EntryRow({
            title: 'Custom Command',
            text: this.settings!.get_string('custom-command'),
            sensitive: this.settings!.get_string('click-action') === 'custom'
        });

        customCommandRow.connect('changed', () => {
            this.settings!.set_string('custom-command', customCommandRow.get_text());
        });

        this.settings!.connect('changed::click-action', () => {
            customCommandRow.sensitive = this.settings!.get_string('click-action') === 'custom';
        });

        clickGroup.add(clickActionRow);
        clickGroup.add(customCommandRow);

        page.add(pollingGroup);
        page.add(clickGroup);
        return page;
    }

    private showAuthenticationDialog(parent: Gtk.Window) {
        const dialog = new Adw.MessageDialog({
            transientFor: parent,
            heading: 'Authenticate with Linear',
            body: 'Click the button below to open Linear\'s authorization page in your browser. After authorizing the application, copy the authorization code and paste it here.'
        });

        dialog.add_response('cancel', 'Cancel');
        dialog.add_response('open', 'Open Authorization Page');
        dialog.set_response_appearance('open', Adw.ResponseAppearance.SUGGESTED);

        dialog.connect('response', (dialog, response) => {
            if (response === 'open') {
                const authUrl = this.oauthHandler!.getAuthorizationUrl();

                try {
                    Gio.AppInfo.launch_default_for_uri(authUrl, null);
                    this.showCodeInputDialog(parent);
                } catch (error) {
                    console.error('Failed to open authorization URL:', error);
                }
            }
        });

        dialog.present();
    }

    private showCodeInputDialog(parent: Gtk.Window) {
        const dialog = new Adw.MessageDialog({
            transientFor: parent,
            heading: 'Enter Authorization Code',
            body: 'Paste the authorization code from Linear here:'
        });

        const entry = new Gtk.Entry({
            placeholder_text: 'Authorization code...'
        });

        dialog.set_extra_child(entry);
        dialog.add_response('cancel', 'Cancel');
        dialog.add_response('submit', 'Submit');
        dialog.set_response_appearance('submit', Adw.ResponseAppearance.SUGGESTED);

        dialog.connect('response', async (dialog, response) => {
            if (response === 'submit') {
                const code = entry.get_text();
                if (code) {
                    try {
                        await this.oauthHandler!.exchangeCodeForToken(code);
                        this.showSuccessDialog(parent);
                    } catch (error) {
                        this.showErrorDialog(parent, error);
                    }
                }
            }
        });

        dialog.present();
    }

    private showSuccessDialog(parent: Gtk.Window) {
        const dialog = new Adw.MessageDialog({
            transientFor: parent,
            heading: 'Authentication Successful',
            body: 'You have successfully connected to Linear. Notifications will now be enabled.'
        });

        dialog.add_response('ok', 'OK');
        dialog.present();
    }

    private showErrorDialog(parent: Gtk.Window, error: any) {
        const dialog = new Adw.MessageDialog({
            transientFor: parent,
            heading: 'Authentication Failed',
            body: `Failed to authenticate with Linear: ${error.message || error}`
        });

        dialog.add_response('ok', 'OK');
        dialog.present();
    }
}