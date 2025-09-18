import { LinearClient, Issue, Comment, IssueConnection } from '@linear/sdk';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import Gio from 'gi://Gio';

export interface LinearUpdate {
    id: string;
    type: 'issue' | 'comment' | 'status_change';
    title: string;
    body: string;
    url: string;
    updatedAt: Date;
}

export class LinearAPIClient {
    private client?: LinearClient;
    private extension: Extension;
    private settings: Gio.Settings;

    constructor(extension: Extension) {
        this.extension = extension;
        this.settings = extension.getSettings();
        this.initializeClient();
    }

    private initializeClient() {
        const token = this.settings.get_string('oauth-token');

        if (token) {
            this.client = new LinearClient({
                apiKey: token
            });
        }
    }

    isAuthenticated(): boolean {
        return !!this.client && !!this.settings.get_string('oauth-token');
    }

    setToken(token: string) {
        this.settings.set_string('oauth-token', token);
        this.initializeClient();
    }

    async getUpdates(): Promise<LinearUpdate[]> {
        if (!this.client) {
            throw new Error('Client not authenticated');
        }

        const updates: LinearUpdate[] = [];
        const lastUpdateTime = this.getLastUpdateTime();

        try {
            await this.fetchIssueUpdates(updates, lastUpdateTime);
            await this.fetchCommentUpdates(updates, lastUpdateTime);

            this.updateLastUpdateTime();

            return updates.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        } catch (error) {
            console.error('Failed to fetch Linear updates:', error);
            throw error;
        }
    }

    private async fetchIssueUpdates(updates: LinearUpdate[], lastUpdateTime: Date) {
        const workspaceId = this.settings.get_string('workspace-id');

        const issues = await this.client!.issues({
            filter: {
                updatedAt: {
                    gt: lastUpdateTime
                },
                ...(workspaceId && {
                    team: {
                        organization: {
                            id: { eq: workspaceId }
                        }
                    }
                })
            },
            orderBy: 'updatedAt'
        });

        for (const issue of issues.nodes) {
            const issueUrl = issue.url || `https://linear.app/issue/${issue.identifier}`;

            const isNewIssue = new Date(issue.createdAt).getTime() > lastUpdateTime.getTime();

            if (isNewIssue) {
                updates.push({
                    id: `issue-${issue.id}`,
                    type: 'issue',
                    title: `New Issue: ${issue.title}`,
                    body: `${issue.identifier} - ${issue.description?.substring(0, 100) || 'No description'}`,
                    url: issueUrl,
                    updatedAt: new Date(issue.updatedAt)
                });
            } else {
                updates.push({
                    id: `status-${issue.id}`,
                    type: 'status_change',
                    title: `Issue Updated: ${issue.title}`,
                    body: `${issue.identifier} - Status: ${issue.state?.name || 'Unknown'}`,
                    url: issueUrl,
                    updatedAt: new Date(issue.updatedAt)
                });
            }

            if (this.shouldNotifyForAssignment(issue)) {
                updates.push({
                    id: `assigned-${issue.id}`,
                    type: 'issue',
                    title: `Issue Assigned: ${issue.title}`,
                    body: `${issue.identifier} has been assigned to you`,
                    url: issueUrl,
                    updatedAt: new Date(issue.updatedAt)
                });
            }
        }
    }

    private async fetchCommentUpdates(updates: LinearUpdate[], lastUpdateTime: Date) {
        const comments = await this.client!.comments({
            filter: {
                updatedAt: {
                    gt: lastUpdateTime
                }
            },
            orderBy: 'updatedAt'
        });

        for (const comment of comments.nodes) {
            const issue = await comment.issue;
            if (!issue) continue;

            const issueUrl = issue.url || `https://linear.app/issue/${issue.identifier}`;

            updates.push({
                id: `comment-${comment.id}`,
                type: 'comment',
                title: `New Comment: ${issue.title}`,
                body: `${comment.user?.name || 'Someone'}: ${comment.body?.substring(0, 100) || 'No content'}`,
                url: issueUrl,
                updatedAt: new Date(comment.updatedAt)
            });
        }
    }

    private shouldNotifyForAssignment(issue: Issue): boolean {
        if (!this.settings.get_boolean('notify-assigned-issues')) {
            return false;
        }

        return !!issue.assignee;
    }

    private getLastUpdateTime(): Date {
        const lastUpdateString = this.settings.get_string('last-update-time');

        if (lastUpdateString) {
            return new Date(lastUpdateString);
        }

        const oneHourAgo = new Date();
        oneHourAgo.setHours(oneHourAgo.getHours() - 1);
        return oneHourAgo;
    }

    private updateLastUpdateTime() {
        const now = new Date().toISOString();
        this.settings.set_string('last-update-time', now);
    }

    async getCurrentUser() {
        if (!this.client) {
            throw new Error('Client not authenticated');
        }

        return await this.client.viewer;
    }

    async getWorkspaces() {
        if (!this.client) {
            throw new Error('Client not authenticated');
        }

        const user = await this.getCurrentUser();
        return await user.organization;
    }
}