# Linear GNOME Notifications - GNOME Shell Extension

## Project Overview
Single GNOME Shell extension targeting GNOME Shell 46+ that polls Linear's API and displays native desktop notifications for new issues, comments, and updates. One-click install from extensions.gnome.org.

## Architecture
**All-in-One GNOME Shell Extension:**
- Polling service runs within extension process
- OAuth authentication via extension preferences
- Local storage using extension's built-in storage
- Native GNOME notifications with click actions
- Target GNOME Shell 46+ (current user version)

## Requirements

### Core Functionality
- **Real-time notifications** for Linear updates via API polling (30-60s intervals)
- **OAuth authentication** with Linear
- **Native GNOME notifications** with clickable actions
- **URL handling** - open issues in browser or custom command ({{URL}} substitution)
- **Single workspace support** initially
- **Filtering capabilities** (to be added later)

### Technical Requirements
- **TypeScript** for development (Linear SDK compatibility)
- **GNOME Shell 46+** target (no legacy support needed)
- **One-click install** from extensions.gnome.org
- **No external dependencies** or separate processes

## Implementation Plan

### Phase 1: Extension Foundation
1. ✅ Write specification to SPEC.md
2. Create GNOME Shell extension scaffold with metadata.json (target shell-version: 46+)
3. Setup TypeScript build process for modern extension development
4. Implement basic extension lifecycle using current GNOME 46 patterns
5. Add Linear SDK integration and OAuth authentication flow

### Phase 2: Linear API Integration
6. Build Linear API client with OAuth token management
7. Implement polling service with configurable intervals (30-60s)
8. Create local storage system for tracking seen issues/comments
9. Add error handling and retry logic for API calls

### Phase 3: Notification System
10. Implement native GNOME notification display using current APIs
11. Add click handlers for opening issues in browser/custom command
12. Create notification formatting (concise titles/descriptions)
13. Add notification deduplication and rate limiting

### Phase 4: Configuration & Polish
14. Build preferences UI for OAuth setup and settings
15. Add basic filtering options (assignee, projects, etc.)
16. Implement proper extension settings schema
17. Add logging and debugging capabilities

### Phase 5: Packaging & Distribution
18. Create extension package for extensions.gnome.org
19. Write installation and usage documentation
20. Test on GNOME Shell 46+
21. Submit to GNOME Extensions repository

## Project Structure
```
linear-notifications-extension/
├── extension.js          # Main extension entry point
├── prefs.js             # Preferences/settings UI
├── metadata.json        # Extension metadata (shell-version: 46+)
├── linear-client.js     # Linear API integration
├── notification-manager.js # Notification handling
├── oauth-handler.js     # OAuth flow management
├── schemas/             # Settings schema
└── build/               # TypeScript build output
```

## Key Technical Decisions
- **Target GNOME Shell 46+** (no legacy compatibility needed)
- **Single extension** containing all functionality
- **Polling approach** (30-60s intervals) for simplicity
- **OAuth authentication** with token storage in extension settings
- **Native GNOME notifications** with click actions
- **Extension preferences** for all configuration

## API Integration Details

### Linear API Usage - UPDATED APPROACH
**IMPORTANT**: Use Linear's built-in Notifications API instead of manually polling issues/comments.

#### Linear Notifications API Benefits
- Linear's notifications already handle deduplication and proper event tracking
- Built-in support for read/unread states and snoozing
- Proper notification types (issueCreated, issueAssigned, issueCommentCreated, etc.)
- Actor information (who performed the action)
- Proper URL links that match Linear's inbox behavior

#### Implementation Requirements
1. **Use notifications GraphQL query** instead of polling issues/comments:
```graphql
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
        id
        name
        displayName
        avatarUrl
      }
      ... on IssueNotification {
        issue {
          id
          identifier
          title
          url
        }
      }
    }
  }
}
```

2. **Support Linear notification actions**:
   - Mark as read: `notificationMarkAsRead(id: String!)`
   - Snooze: `notificationSnooze(id: String!, snoozedUntilAt: DateTime!)`
   - Unsnooze: `notificationUnsnooze(id: String!)`

3. **Filter notifications properly**:
   - Only show unread notifications (`readAt` is null)
   - Respect snoozed notifications (`snoozedUntilAt` is null or in the past)
   - Filter by creation time since last check

4. **GNOME notification actions**:
   - Primary action: "Open" (opens URL in browser/custom command)
   - Secondary action: "Mark Read" (calls Linear API to mark as read)
   - Tertiary action: "Snooze 1h" (snoozes for 1 hour)

### Notification Events (Linear Types)
- `issueCreated`: New issues created
- `issueAssigned`: Issues assigned to user
- `issueUnassigned`: Issues unassigned from user
- `issueCommentCreated`: Comments added to issues
- `issueMentioned`: User mentioned in issues/comments
- `issueStatusChanged`: Issue status changes
- `issueUpdated`: General issue updates

### Notification Format
- **Title**: Use Linear's notification title directly
- **Description**: Use Linear's subtitle with actor and issue identifier
- **Actions**:
  - "Open" → Open Linear URL
  - "Mark Read" → Call Linear API to mark as read
  - "Snooze 1h" → Snooze for 1 hour
- **Deduplication**: Handled by Linear's notification system

## Configuration Options

### Authentication
- OAuth token management
- Workspace selection

### Notification Preferences
- Polling interval (30-300 seconds)
- Event type filters:
  - New issues (`issueCreated`)
  - Issue assignments (`issueAssigned`, `issueUnassigned`)
  - Comments (`issueCommentCreated`)
  - Mentions (`issueMentioned`)
  - Status changes (`issueStatusChanged`)
  - General updates (`issueUpdated`)
- Click action (browser vs custom command)
- Custom command template with {{URL}} substitution

### Future Filtering Options
- Filter by assignee
- Filter by project
- Filter by priority
- Filter by labels
- Quiet hours

## Technical Implementation Notes

### Linear Notifications API Specifics

#### GraphQL Schema Considerations
- Use inline fragments for type-specific fields: `... on IssueNotification { issue { ... } }`
- Not all notifications have issue data (some are system notifications)
- Actor field may be null for system-generated notifications

#### Authentication
- Linear API uses direct token in Authorization header (NO "Bearer" prefix)
- Token format: `lin_api_xxxxxxxxxxxx`
- Test with simple viewer query first: `query { viewer { id name email } }`

#### Error Handling
- 400 errors usually indicate GraphQL schema issues
- 401 errors indicate authentication problems
- Rate limiting: respect Linear's API limits

#### Notification Filtering Logic
```javascript
const isRelevantNotification = (notification) => {
  const isUnread = !notification.readAt;
  const isNotSnoozed = !notification.snoozedUntilAt ||
                      new Date(notification.snoozedUntilAt) <= new Date();
  const isAfterLastCheck = new Date(notification.createdAt) > lastCheckTime;

  return isUnread && isNotSnoozed && isAfterLastCheck;
};
```

### GNOME Shell Extension Patterns

#### Module Loading
- Use ES6 imports for modern GNOME Shell 46+
- Extension structure: `import * as Extension from 'resource:///org/gnome/shell/extensions/extension.js'`
- Native HTTP with GJS: `import Soup from 'gi://Soup'`

#### Settings Schema
- Compile with: `glib-compile-schemas schemas/`
- Boolean settings for notification type filters
- String settings for tokens and custom commands
- Integer settings for polling intervals (30-300 seconds)

#### Notification Actions
- GNOME notifications support multiple actions
- Actions execute asynchronously
- Handle action failures gracefully

### Development Workflow

#### Testing
1. Test Linear API connection with standalone scripts first
2. Use mock objects for testing notification flow
3. Test with real Linear workspace data
4. Verify notification actions work properly

#### Common Issues
- **GraphQL validation errors**: Check field availability and use inline fragments
- **Authentication failures**: Verify token format (no Bearer prefix)
- **Extension loading issues**: Check metadata.json and proper file structure
- **Notification display problems**: Verify MessageTray source initialization

#### File Structure Priority
```
/linear-client.js           # Native HTTP implementation (production)
/polling-service.js         # Polling logic with notification filtering
/notification-manager.js    # GNOME notification display + actions
/extension.js              # Main extension entry point
/oauth-handler.js          # OAuth 2.0 authentication flow
/prefs.js                  # Preferences UI with OAuth and API token support
```

## TODO Status

### ✅ COMPLETED

- [x] **Extension Foundation**
  - [x] GNOME Shell extension scaffold with metadata.json (GNOME Shell 46+)
  - [x] Extension lifecycle implementation
  - [x] Project structure and file organization
  - [x] Package.json and TypeScript configuration

- [x] **Linear API Integration**
  - [x] Native HTTP Linear API client using GJS/Soup (no external dependencies)
  - [x] Linear Notifications API integration (proper approach vs manual polling)
  - [x] OAuth 2.0 authentication flow implementation
  - [x] API token authentication as fallback option
  - [x] Error handling and proper GraphQL query structure
  - [x] Authentication header handling (Bearer vs direct token)

- [x] **Notification System**
  - [x] Native GNOME notification display using MessageTray
  - [x] Notification click handlers (open URLs in browser)
  - [x] Notification actions: Open, Mark Read, Snooze 1h
  - [x] Notification formatting with Linear data
  - [x] Settings-based notification type filtering

- [x] **Configuration & Preferences**
  - [x] Complete preferences UI with Adw/Gtk components
  - [x] OAuth setup flow with instructions and credential configuration
  - [x] API token setup as alternative authentication method
  - [x] Authentication method selection (OAuth vs API token)
  - [x] Notification type toggles and polling interval configuration
  - [x] Click action configuration (browser vs custom command)
  - [x] GSettings schema with all required keys
  - [x] Schema compilation and integration

- [x] **Polling Service**
  - [x] Background polling service with configurable intervals
  - [x] Linear notification filtering and deduplication
  - [x] Last update time tracking
  - [x] Integration with notification manager

- [x] **Testing & Verification**
  - [x] Working extension with successful Linear API integration
  - [x] Successful notification display and click handling
  - [x] Authentication flows (both OAuth and API token)
  - [x] Preferences UI functionality

### 🔄 IN PROGRESS / NEEDS FIXES

- [ ] **OAuth Flow Issues**
  - [ ] Fix OAuth callback server HTTP 500 errors
  - [ ] Improve OAuth callback handling and error reporting
  - [ ] Test complete OAuth flow end-to-end

### 📋 TODO / FUTURE ENHANCEMENTS

- [ ] **Packaging & Distribution**
  - [ ] Create extension package for extensions.gnome.org
  - [ ] Write comprehensive installation documentation
  - [ ] Create README with setup instructions
  - [ ] Test on different GNOME Shell 46+ versions
  - [ ] Submit to GNOME Extensions repository

- [ ] **Polish & Improvements**
  - [ ] Better error handling and user feedback
  - [ ] Notification rate limiting
  - [ ] Improved logging and debugging
  - [ ] Custom notification sounds

- [ ] **Code Quality**
  - [ ] Add comprehensive error handling
  - [ ] Improve code documentation
  - [ ] Add unit tests for core functionality
  - [ ] Code cleanup and optimization

### 🐛 KNOWN ISSUES

1. **OAuth Callback Server**: Local callback server returns HTTP 500 errors during OAuth flow

### 🎯 CURRENT STATE

The extension is **fully functional** with API token authentication. Users can:

- Authenticate with Linear using personal API tokens
- Receive real-time desktop notifications for Linear updates
- Click notifications to open Linear URLs in browser
- Mark notifications as read from GNOME notification actions
- Snooze notifications for 1 hour
- Configure notification types and polling intervals
- Use custom commands for URL handling

The OAuth flow is implemented but has callback server issues that need to be resolved for production use.