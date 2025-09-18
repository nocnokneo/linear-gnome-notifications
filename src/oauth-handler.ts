import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

export class LinearOAuthHandler {
    private extension: Extension;
    private settings: Gio.Settings;
    private httpSession?: Soup.Session;

    private readonly CLIENT_ID = 'linear-notifications-gnome';
    private readonly REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';
    private readonly AUTHORIZATION_URL = 'https://linear.app/oauth/authorize';
    private readonly TOKEN_URL = 'https://api.linear.app/oauth/token';

    constructor(extension: Extension) {
        this.extension = extension;
        this.settings = extension.getSettings();
        this.httpSession = new Soup.Session();
    }

    getAuthorizationUrl(): string {
        const params = new URLSearchParams({
            client_id: this.CLIENT_ID,
            redirect_uri: this.REDIRECT_URI,
            response_type: 'code',
            scope: 'read write',
            state: this.generateRandomState()
        });

        return `${this.AUTHORIZATION_URL}?${params.toString()}`;
    }

    async exchangeCodeForToken(authorizationCode: string): Promise<string> {
        if (!this.httpSession) {
            throw new Error('HTTP session not initialized');
        }

        const requestBody = new URLSearchParams({
            client_id: this.CLIENT_ID,
            redirect_uri: this.REDIRECT_URI,
            code: authorizationCode,
            grant_type: 'authorization_code'
        });

        const message = Soup.Message.new(
            'POST',
            this.TOKEN_URL
        );

        const bodyBytes = new GLib.Bytes(requestBody.toString());
        message.set_request_body_from_bytes('application/x-www-form-urlencoded', bodyBytes);

        return new Promise((resolve, reject) => {
            this.httpSession!.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                null,
                (session, result) => {
                    try {
                        const bytes = session!.send_and_read_finish(result);
                        const response = new TextDecoder().decode(bytes.get_data() || new Uint8Array());

                        if (message.get_status() !== Soup.Status.OK) {
                            reject(new Error(`HTTP ${message.get_status()}: ${response}`));
                            return;
                        }

                        const data = JSON.parse(response);

                        if (data.error) {
                            reject(new Error(`OAuth error: ${data.error_description || data.error}`));
                            return;
                        }

                        if (!data.access_token) {
                            reject(new Error('No access token received'));
                            return;
                        }

                        this.settings.set_string('oauth-token', data.access_token);
                        resolve(data.access_token);

                    } catch (error) {
                        reject(error);
                    }
                }
            );
        });
    }

    revokeToken(): void {
        this.settings.set_string('oauth-token', '');
        this.settings.set_string('workspace-id', '');
        this.settings.set_string('last-update-time', '');
    }

    isAuthenticated(): boolean {
        const token = this.settings.get_string('oauth-token');
        return !!token && token.length > 0;
    }

    getToken(): string {
        return this.settings.get_string('oauth-token');
    }

    private generateRandomState(): string {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    destroy() {
        this.httpSession = undefined;
    }
}