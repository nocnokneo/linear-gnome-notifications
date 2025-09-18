import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

export class LinearAPIClient {
    constructor(extension) {
        this.extension = extension;
        this.settings = extension.getSettings();
        this.httpSession = new Soup.Session();
        this.apiUrl = 'https://api.linear.app/graphql';

        console.log('LinearAPIClient initialized');
    }

    isAuthenticated() {
        const authMethod = this.settings.get_string('auth-method');

        if (authMethod === 'token') {
            const apiToken = this.settings.get_string('api-token');
            return apiToken && apiToken.length > 0;
        } else {
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
    }

    getToken() {
        if (!this.isAuthenticated()) {
            return null;
        }

        const authMethod = this.settings.get_string('auth-method');
        if (authMethod === 'token') {
            return this.settings.get_string('api-token');
        } else {
            return this.settings.get_string('oauth-token');
        }
    }

    /**
     * Make a GraphQL request to Linear API
     * @param {string} query - GraphQL query string
     * @param {Object} variables - GraphQL variables
     * @returns {Promise<Object>} - API response data
     */
    async makeRequest(query, variables = {}) {
        if (!this.isAuthenticated()) {
            throw new Error('Not authenticated - please configure OAuth or API token first');
        }

        const token = this.getToken();
        const payload = {
            query: query,
            variables: variables
        };

        const message = Soup.Message.new('POST', this.apiUrl);

        // Set headers - OAuth tokens use Bearer prefix, API tokens don't
        const authMethod = this.settings.get_string('auth-method');
        if (authMethod === 'token') {
            // API tokens don't use Bearer prefix
            message.request_headers.append('Authorization', token);
        } else {
            // OAuth tokens use Bearer prefix
            message.request_headers.append('Authorization', `Bearer ${token}`);
        }
        message.request_headers.append('Content-Type', 'application/json');
        message.request_headers.append('User-Agent', 'LinearNotifications-GNOME/1.0');

        // Set request body
        const bodyText = JSON.stringify(payload);
        const bodyBytes = new TextEncoder().encode(bodyText);
        message.set_request_body_from_bytes('application/json', new GLib.Bytes(bodyBytes));

        console.log(`Making Linear API request: ${query.substring(0, 50)}...`);

        return new Promise((resolve, reject) => {
            this.httpSession.send_and_read_async(
                message,
                GLib.PRIORITY_DEFAULT,
                null,
                (session, result) => {
                    try {
                        const bytes = session.send_and_read_finish(result);
                        const responseText = new TextDecoder().decode(bytes.get_data() || new Uint8Array());

                        console.log(`Linear API response status: ${message.get_status()}`);

                        if (message.get_status() !== Soup.Status.OK) {
                            reject(new Error(`HTTP ${message.get_status()}: ${responseText}`));
                            return;
                        }

                        const response = JSON.parse(responseText);

                        if (response.errors) {
                            reject(new Error(`GraphQL errors: ${JSON.stringify(response.errors)}`));
                            return;
                        }

                        resolve(response.data);
                    } catch (error) {
                        reject(error);
                    }
                }
            );
        });
    }

    /**
     * Get current user information
     */
    async getCurrentUser() {
        const query = `
            query {
                viewer {
                    id
                    name
                    email
                    organization {
                        id
                        name
                    }
                }
            }
        `;

        const data = await this.makeRequest(query);
        return data.viewer;
    }

    /**
     * Get recent issues
     * @param {number} first - Number of issues to fetch (default: 10)
     * @param {Date} since - Only get issues updated since this date
     */
    async getRecentIssues(first = 10, since = null) {
        let filter = {};

        if (since) {
            filter.updatedAt = {
                gt: since.toISOString()
            };
        }

        const query = `
            query GetRecentIssues($first: Int!, $filter: IssueFilter) {
                issues(first: $first, filter: $filter, orderBy: updatedAt) {
                    nodes {
                        id
                        identifier
                        title
                        description
                        url
                        createdAt
                        updatedAt
                        state {
                            id
                            name
                            type
                        }
                        assignee {
                            id
                            name
                            email
                        }
                        creator {
                            id
                            name
                        }
                        team {
                            id
                            name
                        }
                    }
                    pageInfo {
                        hasNextPage
                        endCursor
                    }
                }
            }
        `;

        const variables = { first, filter };
        const data = await this.makeRequest(query, variables);
        return data.issues;
    }

    /**
     * Get recent comments
     * @param {number} first - Number of comments to fetch
     * @param {Date} since - Only get comments created since this date
     */
    async getRecentComments(first = 10, since = null) {
        let filter = {};

        if (since) {
            filter.createdAt = {
                gt: since.toISOString()
            };
        }

        const query = `
            query GetRecentComments($first: Int!, $filter: CommentFilter) {
                comments(first: $first, filter: $filter, orderBy: createdAt) {
                    nodes {
                        id
                        body
                        createdAt
                        updatedAt
                        user {
                            id
                            name
                        }
                        issue {
                            id
                            identifier
                            title
                            url
                        }
                    }
                    pageInfo {
                        hasNextPage
                        endCursor
                    }
                }
            }
        `;

        const variables = { first, filter };
        const data = await this.makeRequest(query, variables);
        return data.comments;
    }

    /**
     * Test the API connection
     */
    async testConnection() {
        try {
            const user = await this.getCurrentUser();
            console.log(`Linear API connection successful - logged in as: ${user.name} (${user.email})`);
            return true;
        } catch (error) {
            console.error('Linear API connection failed:', error.message);
            return false;
        }
    }

    /**
     * Get notifications from Linear
     */
    async getNotifications(first = 20) {
        const query = `
            query GetNotifications($first: Int!) {
                notifications(first: $first, orderBy: createdAt) {
                    nodes {
                        id
                        type
                        createdAt
                        readAt
                        snoozedUntilAt
                        title
                        subtitle
                        url
                        issueStatusType
                        actor {
                            displayName
                            avatarUrl
                        }
                    }
                    pageInfo {
                        hasNextPage
                        endCursor
                    }
                }
            }
        `;

        const variables = { first };
        const data = await this.makeRequest(query, variables);
        return data.notifications;
    }

    /**
     * Archive notification (Linear's equivalent of marking as read)
     */
    async markNotificationAsRead(notificationId) {
        const query = `
            mutation ArchiveNotification($id: String!) {
                notificationArchive(id: $id) {
                    success
                }
            }
        `;

        const variables = { id: notificationId };
        const data = await this.makeRequest(query, variables);
        return data.notificationArchive;
    }

    /**
     * Unarchive notification (for testing purposes)
     */
    async unarchiveNotification(notificationId) {
        const query = `
            mutation UnarchiveNotification($id: String!) {
                notificationUnarchive(id: $id) {
                    success
                }
            }
        `;

        const variables = { id: notificationId };
        const data = await this.makeRequest(query, variables);
        return data.notificationUnarchive;
    }

    /**
     * Get updates since last check using notifications
     */
    async getUpdates() {
        const lastUpdateTime = this.getLastUpdateTime();

        try {
            const notifications = await this.getNotifications(50);

            // Filter to only unarchived notifications created after last update time
            const newNotifications = notifications.nodes.filter(notification => {
                const createdAt = new Date(notification.createdAt);
                const isAfterLastUpdate = createdAt.getTime() > lastUpdateTime.getTime();

                return isAfterLastUpdate;
            });

            this.updateLastUpdateTime();

            const updates = [];

            // Convert Linear notifications to our update format
            for (const notification of newNotifications) {
                const update = {
                    id: `notification-${notification.id}`,
                    type: this.mapNotificationType(notification.type),
                    title: notification.title,
                    body: notification.subtitle || 'No additional details',
                    url: notification.url,
                    updatedAt: new Date(notification.createdAt),
                    data: {
                        notificationId: notification.id,
                        notificationType: notification.type,
                        actor: notification.actor,
                        issueStatusType: notification.issueStatusType
                    }
                };

                // Enhance the body with actor information
                if (notification.actor?.displayName) {
                    update.body = `${notification.actor.displayName}: ${update.body}`;
                }

                // Add issue status if available
                if (notification.issueStatusType) {
                    update.body = `[${notification.issueStatusType}] ${update.body}`;
                }

                updates.push(update);
            }

            // Sort by most recent first
            updates.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

            console.log(`Retrieved ${updates.length} new Linear notifications`);
            return updates;

        } catch (error) {
            console.error('Failed to get Linear notifications:', error.message);
            throw error;
        }
    }

    /**
     * Map Linear notification types to our internal types
     */
    mapNotificationType(linearType) {
        const typeMap = {
            'issueCreated': 'new_issue',
            'issueAssigned': 'issue_assigned',
            'issueStatusChanged': 'status_change',
            'issueCommentCreated': 'new_comment',
            'issueMentioned': 'mentioned',
            'issueUnassigned': 'issue_unassigned'
        };

        return typeMap[linearType] || 'notification';
    }

    getLastUpdateTime() {
        const lastUpdateString = this.settings.get_string('last-update-time');

        if (lastUpdateString) {
            return new Date(lastUpdateString);
        }

        // First run - get updates from 1 hour ago
        const oneHourAgo = new Date();
        oneHourAgo.setHours(oneHourAgo.getHours() - 1);
        return oneHourAgo;
    }

    updateLastUpdateTime() {
        const now = new Date().toISOString();
        this.settings.set_string('last-update-time', now);
    }

    destroy() {
        if (this.httpSession) {
            this.httpSession = null;
        }
    }
}