import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class LinearNotificationsPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window._settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

        // Authentication Group
        const authGroup = new Adw.PreferencesGroup({
            title: _('Authentication'),
            description: _('Connect your Linear account using OAuth or API token'),
        });
        page.add(authGroup);

        // Authentication Method Selection
        const authMethodRow = new Adw.ComboRow({
            title: _('Authentication Method'),
            model: new Gtk.StringList({
                strings: [_('OAuth (Recommended)'), _('API Token')],
            }),
            selected: window._settings.get_string('auth-method') === 'token' ? 1 : 0,
        });
        authMethodRow.connect('notify::selected', () => {
            const method = authMethodRow.selected === 0 ? 'oauth' : 'token';
            window._settings.set_string('auth-method', method);
            updateAuthMethodVisibility();
        });
        authGroup.add(authMethodRow);

        // Authentication Status Row
        const authStatusRow = new Adw.ActionRow({
            title: _('Linear Account'),
        });

        // Login/Logout Button
        const authButton = new Gtk.Button({
            label: _('Connect to Linear'),
            css_classes: ['suggested-action'],
            valign: Gtk.Align.CENTER,
        });

        authStatusRow.add_suffix(authButton);
        authGroup.add(authStatusRow);

        // API Token Row
        const apiTokenRow = new Adw.PasswordEntryRow({
            title: _('Linear API Token'),
            text: window._settings.get_string('api-token'),
        });
        apiTokenRow.connect('changed', () => {
            window._settings.set_string('api-token', apiTokenRow.text);
            updateAuthStatus();
        });
        authGroup.add(apiTokenRow);

        // Update authentication status
        const updateAuthStatus = () => {
            const authMethod = window._settings.get_string('auth-method');

            if (authMethod === 'token') {
                const apiToken = window._settings.get_string('api-token');
                if (apiToken && apiToken.length > 0) {
                    authStatusRow.set_subtitle(_('API token configured'));
                    authButton.set_label(_('Clear Token'));
                    authButton.remove_css_class('suggested-action');
                    authButton.add_css_class('destructive-action');
                } else {
                    authStatusRow.set_subtitle(_('No API token set'));
                    authButton.set_label(_('Set API Token'));
                    authButton.remove_css_class('destructive-action');
                    authButton.add_css_class('suggested-action');
                }
            } else {
                const token = window._settings.get_string('oauth-token');
                const expiresAt = window._settings.get_string('token-expires-at');

                if (token && expiresAt) {
                    const now = new Date().getTime();
                    const expires = new Date(expiresAt).getTime();

                    if (now < expires) {
                        // Authenticated
                        authStatusRow.set_subtitle(_('Connected and authenticated'));
                        authButton.set_label(_('Disconnect'));
                        authButton.remove_css_class('suggested-action');
                        authButton.add_css_class('destructive-action');
                    } else {
                        // Expired
                        authStatusRow.set_subtitle(_('Token expired - please reconnect'));
                        authButton.set_label(_('Reconnect to Linear'));
                        authButton.remove_css_class('destructive-action');
                        authButton.add_css_class('suggested-action');
                    }
                } else {
                    // Not authenticated
                    authStatusRow.set_subtitle(_('Not connected'));
                    authButton.set_label(_('Connect to Linear'));
                    authButton.remove_css_class('destructive-action');
                    authButton.add_css_class('suggested-action');
                }
            }
        };


        // Initial status update
        updateAuthStatus();

        // Watch for settings changes
        window._settings.connect('changed::oauth-token', updateAuthStatus);
        window._settings.connect('changed::token-expires-at', updateAuthStatus);

        // Handle auth button click
        authButton.connect('clicked', () => {
            const authMethod = window._settings.get_string('auth-method');

            if (authMethod === 'token') {
                const apiToken = window._settings.get_string('api-token');
                if (apiToken) {
                    // Clear token
                    this.handleClearToken(window);
                } else {
                    // Focus token field for input
                    apiTokenRow.grab_focus();
                }
            } else {
                const token = window._settings.get_string('oauth-token');
                if (token) {
                    // Logout
                    this.handleLogout(window);
                } else {
                    // Login
                    this.handleLogin(window);
                }
            }
        });

        window._settings.connect('changed::api-token', updateAuthStatus);

        // Setup Instructions
        const instructionsGroup = new Adw.PreferencesGroup({
            title: _('OAuth Setup Instructions'),
            description: _('Create a Linear OAuth application'),
        });
        page.add(instructionsGroup);

        const instructionsLabel = new Gtk.Label({
            label: _(
                '1. Go to Linear Settings → API → OAuth Applications\n' +
                '2. Click "Create new OAuth application"\n' +
                '3. Set Application Name: "GNOME Desktop Notifications"\n' +
                '4. Set Redirect URL: "http://localhost:8080/callback"\n' +
                '5. Set Scopes: "read"\n' +
                '6. Enter Client ID and Secret below\n' +
                '7. Click "Connect to Linear" above'
            ),
            wrap: true,
            xalign: 0,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
        });

        instructionsGroup.add(instructionsLabel);

        // Update instructions based on auth method
        const updateInstructions = () => {
            const authMethod = window._settings.get_string('auth-method');

            if (authMethod === 'token') {
                instructionsGroup.set_title(_('API Token Setup Instructions'));
                instructionsGroup.set_description(_('Create a Linear Personal API Key'));
                instructionsLabel.set_label(_(
                    '1. Go to Linear Settings → API → Personal API Keys\n' +
                    '2. Click "Create API key"\n' +
                    '3. Set Label: "GNOME Desktop Notifications"\n' +
                    '4. Copy the generated token\n' +
                    '5. Paste the token in the API Token field above'
                ));
            } else {
                instructionsGroup.set_title(_('OAuth Setup Instructions'));
                instructionsGroup.set_description(_('Create a Linear OAuth application'));
                instructionsLabel.set_label(_(
                    '1. Go to Linear Settings → API → OAuth Applications\n' +
                    '2. Click "Create new OAuth application"\n' +
                    '3. Set Application Name: "GNOME Desktop Notifications"\n' +
                    '4. Set Redirect URL: "http://localhost:8080/callback"\n' +
                    '5. Set Scopes: "read"\n' +
                    '6. Enter Client ID and Secret below\n' +
                    '7. Click "Connect to Linear" above'
                ));
            }
        };

        // OAuth Configuration
        const oauthGroup = new Adw.PreferencesGroup({
            title: _('OAuth Configuration'),
            description: _('Enter your Linear OAuth application credentials'),
        });
        page.add(oauthGroup);

        const clientIdRow = new Adw.EntryRow({
            title: _('Client ID'),
            text: window._settings.get_string('oauth-client-id'),
        });
        clientIdRow.connect('changed', () => {
            window._settings.set_string('oauth-client-id', clientIdRow.text);
        });
        oauthGroup.add(clientIdRow);

        const clientSecretRow = new Adw.PasswordEntryRow({
            title: _('Client Secret'),
            text: window._settings.get_string('oauth-client-secret'),
        });
        clientSecretRow.connect('changed', () => {
            window._settings.set_string('oauth-client-secret', clientSecretRow.text);
        });
        oauthGroup.add(clientSecretRow);

        // Notification Settings Group
        const notificationGroup = new Adw.PreferencesGroup({
            title: _('Notification Settings'),
            description: _('Choose which Linear events trigger notifications'),
        });
        page.add(notificationGroup);

        // Polling Interval
        const intervalRow = new Adw.SpinRow({
            title: _('Polling Interval (seconds)'),
            adjustment: new Gtk.Adjustment({
                lower: 30,
                upper: 300,
                step_increment: 30,
                page_increment: 60,
                value: window._settings.get_int('polling-interval'),
            }),
        });
        intervalRow.connect('changed', () => {
            window._settings.set_int('polling-interval', intervalRow.value);
        });
        notificationGroup.add(intervalRow);

        // Notification Type Switches
        const notificationTypes = [
            { key: 'notify-new-issues', title: _('New Issues') },
            { key: 'notify-issue-updates', title: _('Issue Updates') },
            { key: 'notify-assigned-issues', title: _('Issue Assignments') },
            { key: 'notify-comments', title: _('Comments') },
            { key: 'notify-mentions', title: _('Mentions') },
            { key: 'notify-status-changes', title: _('Status Changes') },
        ];

        notificationTypes.forEach(type => {
            const switchRow = new Adw.SwitchRow({
                title: type.title,
                active: window._settings.get_boolean(type.key),
            });
            switchRow.connect('notify::active', () => {
                window._settings.set_boolean(type.key, switchRow.active);
            });
            notificationGroup.add(switchRow);
        });

        // Click Action Group
        const actionGroup = new Adw.PreferencesGroup({
            title: _('Click Actions'),
            description: _('Configure what happens when you click notifications'),
        });
        page.add(actionGroup);

        // Click Action
        const actionRow = new Adw.ComboRow({
            title: _('Click Action'),
            model: new Gtk.StringList({
                strings: [_('Open in Browser'), _('Custom Command')],
            }),
            selected: window._settings.get_string('click-action') === 'browser' ? 0 : 1,
        });
        actionRow.connect('notify::selected', () => {
            const action = actionRow.selected === 0 ? 'browser' : 'custom';
            window._settings.set_string('click-action', action);
        });
        actionGroup.add(actionRow);

        // Custom Command
        const commandRow = new Adw.EntryRow({
            title: _('Custom Command (use {{URL}} for Linear URL)'),
            text: window._settings.get_string('custom-command'),
            sensitive: window._settings.get_string('click-action') === 'custom',
        });
        commandRow.connect('changed', () => {
            window._settings.set_string('custom-command', commandRow.text);
        });
        actionGroup.add(commandRow);

        // Update command row sensitivity when action changes
        window._settings.connect('changed::click-action', () => {
            commandRow.sensitive = window._settings.get_string('click-action') === 'custom';
        });

        // Update method visibility (defined after all UI elements)
        const updateAuthMethodVisibility = () => {
            const authMethod = window._settings.get_string('auth-method');
            apiTokenRow.visible = authMethod === 'token';
            oauthGroup.visible = authMethod === 'oauth';
            updateAuthStatus();
            updateInstructions();
        };

        // Initial method visibility and status update
        updateAuthMethodVisibility();

        // Watch for auth method changes
        window._settings.connect('changed::auth-method', updateAuthMethodVisibility);
    }

    handleLogin(window) {
        console.log('Starting Linear OAuth flow from preferences...');

        // Check if OAuth credentials are configured
        const clientId = window._settings.get_string('oauth-client-id');
        const clientSecret = window._settings.get_string('oauth-client-secret');

        if (!clientId || !clientSecret) {
            const dialog = new Adw.MessageDialog({
                transient_for: window,
                heading: _('OAuth Not Configured'),
                body: _('Please enter your Linear OAuth Client ID and Client Secret first.'),
            });
            dialog.add_response('ok', _('OK'));
            dialog.connect('response', () => dialog.close());
            dialog.present();
            return;
        }

        // Show info dialog
        const dialog = new Adw.MessageDialog({
            transient_for: window,
            heading: _('Connecting to Linear'),
            body: _('Your browser will open to authenticate with Linear. Please authorize the application and return here.'),
        });

        dialog.add_response('cancel', _('Cancel'));
        dialog.add_response('continue', _('Continue'));
        dialog.set_response_appearance('continue', Adw.ResponseAppearance.SUGGESTED);

        dialog.connect('response', (dialog, response) => {
            if (response === 'continue') {
                // Trigger OAuth flow via extension
                window._settings.set_boolean('start-oauth-flow', true);

                // Reset the setting immediately
                setTimeout(() => {
                    window._settings.set_boolean('start-oauth-flow', false);
                }, 100);
            }
            dialog.close();
        });

        dialog.present();
    }

    handleLogout(window) {
        console.log('Logging out from Linear...');

        const dialog = new Adw.MessageDialog({
            transient_for: window,
            heading: _('Disconnect from Linear'),
            body: _('This will remove your authentication and stop Linear notifications.'),
        });

        dialog.add_response('cancel', _('Cancel'));
        dialog.add_response('logout', _('Disconnect'));
        dialog.set_response_appearance('logout', Adw.ResponseAppearance.DESTRUCTIVE);

        dialog.connect('response', (dialog, response) => {
            if (response === 'logout') {
                // Clear OAuth tokens
                window._settings.set_string('oauth-token', '');
                window._settings.set_string('refresh-token', '');
                window._settings.set_string('token-expires-at', '');
                window._settings.set_string('oauth-state', '');

                console.log('Linear authentication cleared');
            }
            dialog.close();
        });

        dialog.present();
    }

    handleClearToken(window) {
        console.log('Clearing API token...');

        const dialog = new Adw.MessageDialog({
            transient_for: window,
            heading: _('Clear API Token'),
            body: _('This will remove your API token and stop Linear notifications.'),
        });

        dialog.add_response('cancel', _('Cancel'));
        dialog.add_response('clear', _('Clear Token'));
        dialog.set_response_appearance('clear', Adw.ResponseAppearance.DESTRUCTIVE);

        dialog.connect('response', (dialog, response) => {
            if (response === 'clear') {
                // Clear API token
                window._settings.set_string('api-token', '');
                console.log('API token cleared');
            }
            dialog.close();
        });

        dialog.present();
    }
}