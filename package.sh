#!/bin/bash

# Package script for Linear Desktop Notifications GNOME Shell Extension

set -e

EXTENSION_UUID="linear-notifications@tbj.dev"
VERSION="1.0.0"
PACKAGE_NAME="linear-notifications-${VERSION}.shell-extension.zip"

echo "Building Linear Desktop Notifications extension..."

# Clean up any previous builds
rm -rf dist/
mkdir -p dist/

# Build the extension
make build

echo "Creating extension package..."

# Create package with required files
zip -r "dist/${PACKAGE_NAME}" \
    extension.js \
    prefs.js \
    metadata.json \
    linear-client.js \
    notification-manager.js \
    oauth-handler.js \
    polling-service.js \
    schemas/ \
    --exclude "schemas/*.xml"

echo "Package created: dist/${PACKAGE_NAME}"
echo ""
echo "To install:"
echo "1. Extract the package to ~/.local/share/gnome-shell/extensions/${EXTENSION_UUID}/"
echo "2. Restart GNOME Shell (Alt+F2, type 'r', press Enter)"
echo "3. Enable extension: gnome-extensions enable ${EXTENSION_UUID}"
echo ""
echo "Or use: make install"

ls -lh "dist/${PACKAGE_NAME}"