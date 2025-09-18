# Linear GNOME Notifications - GNOME Shell Extension

A GNOME Shell extension that provides native desktop notifications for Linear issues, comments, and updates.

## Features

- **Real-time notifications** for Linear updates via API polling
- **OAuth authentication** with Linear
- **Native GNOME notifications** with clickable actions
- **Configurable polling intervals** (30-300 seconds)
- **Flexible click actions** - open in browser or run custom commands
- **Notification filtering** by event type (issues, comments, status changes)
- **Support for GNOME Shell 46+**

## Installation

### Prerequisites

- GNOME Shell 46 or later
- Node.js and npm (for building from source)
- Linear account with API access

### From Source

1. Clone this repository:
   ```bash
   git clone https://github.com/nocnokneo/linear-gnome-notifications.git
   cd linear-gnome-notifications
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build and install:
   ```bash
   make install
   ```

4. Restart GNOME Shell:
   - Press `Alt + F2`, type `r`, and press Enter
   - Or log out and log back in

5. Enable the extension:
   ```bash
   gnome-extensions enable linear-notifications@tbj.dev
   ```

### From GNOME Extensions (Coming Soon)

This extension will be available on [extensions.gnome.org](https://extensions.gnome.org) for one-click installation.

## Configuration

1. Open the extension preferences:
   ```bash
   gnome-extensions prefs linear-notifications@tbj.dev
   ```

2. **Authentication Tab**:
   - Click "Authenticate" to connect your Linear account
   - Follow the OAuth flow to authorize the extension
   - Alternatively, manually enter your Linear API token

3. **Notifications Tab**:
   - Enable/disable notifications for different event types:
     - New issues created
     - Issues assigned to you
     - Comments added to issues
     - Issue status changes

4. **Behavior Tab**:
   - Set polling interval (30-300 seconds)
   - Configure click action:
     - Open in browser (default)
     - Run custom command (use `{{URL}}` placeholder for issue URL)

## Usage

Once configured, the extension will:

1. Poll Linear's API at your specified interval
2. Show native GNOME notifications for new events
3. Allow you to click notifications to open issues
4. Track seen events to prevent duplicate notifications

### Example Custom Commands

- Open in a specific browser: `firefox {{URL}}`
- Open in terminal browser: `links {{URL}}`
- Copy URL to clipboard: `echo {{URL}} | xclip -selection clipboard`

## Development

### Building

```bash
# Install dependencies
npm install

# Build JavaScript from TypeScript
npm run build

# Compile GSettings schema
make build

# Install for testing
make install
```

### Project Structure

```
linear-gnome-notifications/
├── extension.js          # Main extension entry point
├── prefs.js             # Preferences/settings UI
├── metadata.json        # Extension metadata
├── linear-client.js     # Linear API integration
├── notification-manager.js # Notification handling
├── oauth-handler.js     # OAuth flow management
├── polling-service.js   # Polling service
├── schemas/             # GSettings schema
└── package.json         # Node.js dependencies
```

### API Usage

The extension uses the Linear TypeScript SDK with the following key operations:

- `client.issues()` - Fetch recent issue updates
- `client.comments()` - Fetch recent comment updates
- `client.viewer` - Get current user information

All API calls are authenticated using OAuth tokens stored in GSettings.

## Troubleshooting

### Extension not loading
- Check GNOME Shell version compatibility (requires 46+)
- Verify extension is enabled: `gnome-extensions list --enabled`
- Check logs: `journalctl -f /usr/bin/gnome-shell`

### No notifications appearing
- Verify Linear OAuth token is configured
- Check polling interval settings
- Ensure notification types are enabled
- Test connection in preferences

### Authentication issues
- Ensure you have access to the Linear workspace
- Try revoking and re-authorizing the token
- Check network connectivity to Linear's API

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with your GNOME Shell version
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/nocnokneo/linear-gnome-notifications/issues).