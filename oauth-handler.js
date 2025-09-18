import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

/**
 * Linear OAuth Handler for GNOME Shell Extension
 * Implements OAuth 2.0 flow for Linear API authentication
 */
export class LinearOAuthHandler {
    constructor(extension) {
        this.extension = extension;
        this.settings = extension.getSettings();
        this.httpSession = new Soup.Session();

        // OAuth configuration
        this.redirectUri = 'http://localhost:8080/callback';
        this.scope = 'read';
        this.authUrl = 'https://linear.app/oauth/authorize';
        this.tokenUrl = 'https://api.linear.app/oauth/token';

        // Local server for handling OAuth callback
        this.server = null;
        this.serverPort = 8080;

        console.log('LinearOAuthHandler initialized');
    }

    /**
     * Get client ID from settings
     */
    get clientId() {
        return this.settings.get_string('oauth-client-id');
    }

    /**
     * Get client secret from settings
     */
    get clientSecret() {
        return this.settings.get_string('oauth-client-secret');
    }

    /**
     * Parse query string manually (URLSearchParams not available in GJS)
     */
    parseQueryString(queryString) {
        const params = {};
        if (!queryString) return params;

        const pairs = queryString.split('&');
        for (const pair of pairs) {
            const [key, value] = pair.split('=');
            if (key) {
                params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
            }
        }
        return params;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        const token = this.settings.get_string('oauth-token');
        const expiresAt = this.settings.get_string('token-expires-at');

        if (!token || !expiresAt) {
            return false;
        }

        // Check if token is expired
        const now = new Date().getTime();
        const expires = new Date(expiresAt).getTime();

        if (now >= expires) {
            console.log('OAuth token expired');
            return false;
        }

        return true;
    }

    /**
     * Get current access token
     */
    getAccessToken() {
        if (!this.isAuthenticated()) {
            return null;
        }
        return this.settings.get_string('oauth-token');
    }

    /**
     * Start OAuth authentication flow
     */
    async startAuthFlow() {
        try {
            console.log('Starting Linear OAuth flow...');

            // Generate a random state parameter for CSRF protection
            const state = this.generateRandomState();
            this.settings.set_string('oauth-state', state);

            // Start local callback server
            await this.startCallbackServer();

            // Build authorization URL
            const authUrl = this.buildAuthorizationUrl(state);

            // Open authorization URL in default browser
            console.log('Opening authorization URL:', authUrl);
            Gio.AppInfo.launch_default_for_uri(authUrl, null);

            return true;
        } catch (error) {
            console.error('Failed to start OAuth flow:', error);
            this.stopCallbackServer();
            throw error;
        }
    }

    /**
     * Generate random state parameter
     */
    generateRandomState() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 32; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Build authorization URL
     */
    buildAuthorizationUrl(state) {
        // Manual URL parameter building since URLSearchParams is not available in GJS
        const params = [
            `response_type=code`,
            `client_id=${encodeURIComponent(this.clientId)}`,
            `redirect_uri=${encodeURIComponent(this.redirectUri)}`,
            `scope=${encodeURIComponent(this.scope)}`,
            `state=${encodeURIComponent(state)}`
        ];

        return `${this.authUrl}?${params.join('&')}`;
    }

    /**
     * Start local HTTP server to handle OAuth callback
     */
    async startCallbackServer() {
        return new Promise((resolve, reject) => {
            try {
                console.log('Creating Soup server...');
                // Create HTTP server
                this.server = new Soup.Server();
                console.log('Soup server created:', !!this.server);

                // Add callback handler
                console.log('Adding callback handler...');
                this.server.add_handler('/callback', (server, msg, path, query, context) => {
                    try {
                        console.log('Callback handler called');
                        console.log('Arguments count:', arguments.length);
                        console.log('msg type:', typeof msg);

                        // Simple response without calling other methods
                        msg.set_status(200, 'OK');
                        msg.response_headers.set_content_type('text/html', null);
                        msg.response_body.append('<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Callback received!</h1></body></html>');

                        console.log('Response set successfully');
                    } catch (error) {
                        console.error('Error in callback handler:', error);
                        try {
                            msg.set_status(500, 'Handler Error');
                            msg.response_headers.set_content_type('text/plain', null);
                            msg.response_body.append(`Handler Error: ${error.message}`);
                        } catch (innerError) {
                            console.error('Error setting error response:', innerError);
                        }
                    }
                });

                // Add success page handler
                this.server.add_handler('/success', (server, msg, path, query) => {
                    const successHtml = `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>Linear Authentication Successful</title>
                            <style>
                                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                                .success { color: #28a745; font-size: 24px; margin-bottom: 20px; }
                                .message { color: #666; font-size: 16px; }
                            </style>
                        </head>
                        <body>
                            <div class="success">✅ Authentication Successful!</div>
                            <div class="message">
                                You have successfully connected your Linear account to GNOME Desktop Notifications.
                                <br><br>
                                You can now close this window and return to your desktop.
                            </div>
                        </body>
                        </html>
                    `;

                    msg.set_status(200, 'OK');
                    msg.response_headers.set_content_type('text/html', null);
                    msg.response_body.append(successHtml);
                });

                // Listen on localhost
                console.log('Starting server listen on port:', this.serverPort);
                this.server.listen_local(this.serverPort, Soup.ServerListenOptions.IPV4_ONLY);
                console.log(`OAuth callback server started on port ${this.serverPort}`);
                resolve();
            } catch (error) {
                console.error('Failed to start callback server:', error);
                reject(error);
            }
        });
    }

    /**
     * Handle OAuth callback from Linear
     */
    handleOAuthCallback(msg, query) {
        try {
            console.log('Received OAuth callback. Query object:', query);
            console.log('Query toString:', query?.toString());

            // For debugging, let's start with a simple response
            msg.set_status(200, 'OK');
            msg.response_headers.set_content_type('text/html', null);
            msg.response_body.append(`
                <!DOCTYPE html>
                <html>
                <head><title>OAuth Callback Debug</title></head>
                <body>
                    <h1>OAuth Callback Received</h1>
                    <p>Query: ${query?.toString() || 'No query'}</p>
                    <p>This is a debug response to test the callback.</p>
                </body>
                </html>
            `);

            console.log('OAuth callback response sent successfully');
        } catch (error) {
            console.error('Error handling OAuth callback:', error);
            msg.set_status(500, 'Internal Error');
            msg.response_headers.set_content_type('text/plain', null);
            msg.response_body.append(`Internal error: ${error.message}`);
        }
    }

    /**
     * Exchange authorization code for access token
     */
    async exchangeCodeForToken(code) {
        return new Promise((resolve, reject) => {
            const message = Soup.Message.new('POST', this.tokenUrl);

            // Set headers
            message.request_headers.append('Content-Type', 'application/x-www-form-urlencoded');
            message.request_headers.append('Accept', 'application/json');

            // Prepare form data manually
            const formParams = [
                `grant_type=authorization_code`,
                `client_id=${encodeURIComponent(this.clientId)}`,
                `client_secret=${encodeURIComponent(this.clientSecret)}`,
                `code=${encodeURIComponent(code)}`,
                `redirect_uri=${encodeURIComponent(this.redirectUri)}`
            ];

            // Set request body
            const bodyText = formParams.join('&');
            const bodyBytes = new TextEncoder().encode(bodyText);
            message.set_request_body_from_bytes('application/x-www-form-urlencoded', new GLib.Bytes(bodyBytes));

            console.log('Exchanging authorization code for token...');

            this.httpSession.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                null,
                (session, result) => {
                    try {
                        const bytes = session.send_and_read_finish(result);
                        const responseText = new TextDecoder().decode(bytes.get_data() || new Uint8Array());

                        console.log('Token exchange response status:', message.get_status());

                        if (message.get_status() !== Soup.Status.OK) {
                            reject(new Error(`HTTP ${message.get_status()}: ${responseText}`));
                            return;
                        }

                        const tokenData = JSON.parse(responseText);

                        if (tokenData.error) {
                            reject(new Error(`Token error: ${tokenData.error_description || tokenData.error}`));
                            return;
                        }

                        // Store access token and expiry
                        this.settings.set_string('oauth-token', tokenData.access_token);

                        // Calculate expiry time
                        const expiresIn = tokenData.expires_in || 86400; // Default 24 hours
                        const expiresAt = new Date(Date.now() + (expiresIn * 1000)).toISOString();
                        this.settings.set_string('token-expires-at', expiresAt);

                        // Store refresh token if available
                        if (tokenData.refresh_token) {
                            this.settings.set_string('refresh-token', tokenData.refresh_token);
                        }

                        console.log('✅ OAuth token obtained successfully');
                        console.log('Token expires at:', expiresAt);

                        // Clear state
                        this.settings.set_string('oauth-state', '');

                        // Emit authentication success signal
                        this.extension.emit('oauth-success');

                        resolve(tokenData);
                    } catch (error) {
                        console.error('Error processing token response:', error);
                        reject(error);
                    }
                }
            );
        });
    }

    /**
     * Stop OAuth callback server
     */
    stopCallbackServer() {
        if (this.server) {
            console.log('Stopping OAuth callback server...');
            this.server.disconnect();
            this.server = null;
        }
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshToken() {
        const refreshToken = this.settings.get_string('refresh-token');
        if (!refreshToken) {
            throw new Error('No refresh token available');
        }

        return new Promise((resolve, reject) => {
            const message = Soup.Message.new('POST', this.tokenUrl);

            // Set headers
            message.request_headers.append('Content-Type', 'application/x-www-form-urlencoded');
            message.request_headers.append('Accept', 'application/json');

            // Prepare form data manually
            const formParams = [
                `grant_type=refresh_token`,
                `client_id=${encodeURIComponent(this.clientId)}`,
                `client_secret=${encodeURIComponent(this.clientSecret)}`,
                `refresh_token=${encodeURIComponent(refreshToken)}`
            ];

            // Set request body
            const bodyText = formParams.join('&');
            const bodyBytes = new TextEncoder().encode(bodyText);
            message.set_request_body_from_bytes('application/x-www-form-urlencoded', new GLib.Bytes(bodyBytes));

            console.log('Refreshing access token...');

            this.httpSession.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                null,
                (session, result) => {
                    try {
                        const bytes = session.send_and_read_finish(result);
                        const responseText = new TextDecoder().decode(bytes.get_data() || new Uint8Array());

                        if (message.get_status() !== Soup.Status.OK) {
                            reject(new Error(`HTTP ${message.get_status()}: ${responseText}`));
                            return;
                        }

                        const tokenData = JSON.parse(responseText);

                        if (tokenData.error) {
                            reject(new Error(`Token refresh error: ${tokenData.error_description || tokenData.error}`));
                            return;
                        }

                        // Update stored tokens
                        this.settings.set_string('oauth-token', tokenData.access_token);

                        const expiresIn = tokenData.expires_in || 86400;
                        const expiresAt = new Date(Date.now() + (expiresIn * 1000)).toISOString();
                        this.settings.set_string('token-expires-at', expiresAt);

                        if (tokenData.refresh_token) {
                            this.settings.set_string('refresh-token', tokenData.refresh_token);
                        }

                        console.log('✅ Access token refreshed successfully');
                        resolve(tokenData);
                    } catch (error) {
                        console.error('Error processing token refresh response:', error);
                        reject(error);
                    }
                }
            );
        });
    }

    /**
     * Revoke access token (logout)
     */
    async logout() {
        console.log('Logging out from Linear...');

        // Clear stored tokens
        this.settings.set_string('oauth-token', '');
        this.settings.set_string('refresh-token', '');
        this.settings.set_string('token-expires-at', '');
        this.settings.set_string('oauth-state', '');

        // Stop callback server if running
        this.stopCallbackServer();

        console.log('✅ Logged out successfully');
    }

    /**
     * Cleanup when handler is destroyed
     */
    destroy() {
        this.stopCallbackServer();
        if (this.httpSession) {
            this.httpSession = null;
        }
        console.log('LinearOAuthHandler destroyed');
    }
}