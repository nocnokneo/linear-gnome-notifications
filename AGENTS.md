# Linear Desktop Notifications - Copilot Instructions

## Project Overview

This is a GNOME Shell extension that provides native desktop notifications for Linear updates through API polling. It targets GNOME Shell 46+ and uses modern JavaScript ES modules.

**Important**: See `PLAN.md` for comprehensive project tracking including:
- Original implementation plan and architecture decisions
- Completed work (extension is fully functional with API token auth)
- Known issues (OAuth callback server needs fixes)
- Remaining tasks (packaging, distribution, polish)

## Architecture

### Core Components
- **`extension.js`**: Main entry point managing lifecycle, settings connections, and component coordination
- **`linear-client.js`**: GraphQL client for Linear API using native GJS/Soup (no external HTTP libraries)
- **`polling-service.js`**: Background service that polls Linear's notifications API at configurable intervals (30-300s)
- **`notification-manager.js`**: Handles GNOME native notifications with clickable actions and avatar caching
- **`oauth-handler.js`**: OAuth 2.0 flow with local server callback handling
- **`prefs.js`**: Adw/Gtk preferences UI with authentication and notification settings

### Data Flow
1. `PollingService` queries Linear's **notifications API** (not issues/comments directly)
2. Filters for unread notifications (`readAt: null`) created after last check
3. `NotificationManager` displays native GNOME notifications with avatar images
4. User actions trigger Linear API calls (mark read, snooze) and URL opening

## Development Patterns

### Authentication Specifics
- **Linear API tokens**: Use direct token in Authorization header (NO "Bearer" prefix)
- **OAuth tokens**: Use "Bearer {token}" format
- Token validation checks expiration timestamps for OAuth
- Settings: `auth-method`, `api-token`, `oauth-token`, `token-expires-at`

### GraphQL Query Patterns
```javascript
// Always use Linear's notifications API
const query = `
    query GetNotifications($first: Int!) {
        notifications(first: $first, orderBy: createdAt) {
            nodes {
                id type createdAt readAt snoozedUntilAt
                title subtitle url issueStatusType
                actor { displayName avatarUrl initials }
                ... on IssueNotification { issue { identifier } }
            }
        }
    }
`;
```

### Settings Architecture
- Uses GSettings with schema in `schemas/org.gnome.shell.extensions.linear-notifications.gschema.xml`
- Run `glib-compile-schemas schemas/` after schema changes
- Connect to setting changes with `settings.connect('changed::{key-name}', callback)`
- Boolean settings for notification types: `notify-new-issues`, `notify-comments`, etc.

### Logging & Debug
- Use `Logger` class from `logger.js` with component names
- Enable debug logging: `globalThis.LINEAR_DEBUG = true`
- Log levels: debug (hidden by default), info, warn, error
- Example: `this.logger = new Logger('ComponentName')`

### Memory Management
- Clean up GLib timeouts: `GLib.source_remove(timeoutId)`
- Disconnect settings handlers in `disable()`
- Clear notification source references to prevent leaks
- `lastKnownUpdates` Set limited to 1000 items with cleanup

## Build & Development Workflow

### Essential Commands
```bash
# Build GSettings schema (required after schema changes)
make build

# Install extension for testing
make install

# Restart GNOME Shell to reload extension
Alt+F2, type 'r', Enter

# Enable/disable extension
gnome-extensions enable linear-notifications@tbj.dev
gnome-extensions disable linear-notifications@tbj.dev

# View extension logs
journalctl -f -o cat /usr/bin/gnome-shell
```

### Testing Patterns
- Test Linear API connection with `linearClient.getCurrentUser()` first
- Use `pollingService.forcePoll()` for immediate polling during development  
- Check authentication status with `linearClient.isAuthenticated()`
- Mock notifications by modifying `getUpdates()` return values

## Common Pitfalls

### GraphQL Issues
- Use inline fragments for type-specific fields: `... on IssueNotification { issue { identifier } }`
- 400 errors indicate schema issues; check field availability in Linear's API docs
- Test queries in Linear's GraphQL playground first

### Extension Loading
- Extensions must export a default class extending `Extension.Extension`
- `metadata.json` shell-version compatibility is strictly enforced
- Missing schema compilation causes settings to fail silently

### Notification Display
- Always call `ensureSource()` before showing notifications to handle disposed sources
- MessageTray sources can become invalid; recreate if operations fail
- Avatar caching prevents redundant downloads but requires cleanup

### Settings Synchronization
- Settings changes from preferences UI automatically trigger extension restarts
- OAuth flow uses settings as communication channel between prefs and extension
- Multiple auth methods require careful state management in `isAuthenticated()`

## File Modification Guidelines

When editing core files, preserve these patterns:
- **Extension lifecycle**: Always clean up connections and services in `disable()`
- **Error boundaries**: Wrap async operations in try/catch with proper logging
- **Settings reactivity**: Connect to relevant setting changes for dynamic updates
- **Memory safety**: Use WeakMap/Set for caching and clear references appropriately

## Project Status & Planning

**Current State**: Extension is fully functional with API token authentication. OAuth flow is implemented but has callback server issues.

**Key Files**:
- `PLAN.md`: Master project plan with completed/remaining work tracking
- `CONTRIBUTING.md`: Development setup and debugging instructions
- `ExampleQuery.md`: Sample GraphQL queries and responses for reference

**Known Issues**: OAuth callback server returns HTTP 500 errors (see PLAN.md for details)