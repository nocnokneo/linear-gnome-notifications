# Contributing to Linear GNOME Notifications

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

## Debugging

The extension uses different log levels for better debugging:

- **Error** and **Warning** messages are always shown
- **Info** messages show important events (e.g., "Started polling service", "Found 3 new updates")
- **Debug** messages show detailed operation info (normally hidden)

### Enable Debug Logging

To see detailed debug output for development:

1. Open browser console or terminal
2. Set the debug flag:
   ```javascript
   globalThis.LINEAR_DEBUG = true;
   ```
3. Restart the extension:
   ```bash
   gnome-extensions disable linear-notifications@tbj.dev
   gnome-extensions enable linear-notifications@tbj.dev
   ```

View logs in real-time:
```bash
journalctl -f /usr/bin/gnome-shell | grep -i linear
```