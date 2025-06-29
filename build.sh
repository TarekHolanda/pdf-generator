#!/bin/bash

set -e  # Exit on any error

echo "Starting build process..."

# Install dependencies
echo "Installing npm dependencies..."
npm install

# Install Chrome for Puppeteer
echo "Installing Chrome for Puppeteer..."
npx puppeteer browsers install chrome

# Verify Chrome installation
echo "Verifying Chrome installation..."
if npx puppeteer browsers list | grep -q "chrome"; then
    echo "✅ Chrome is installed successfully"
else
    echo "❌ Chrome installation verification failed"
    exit 1
fi

# Set permissions if the directory exists
if [ -d "/opt/render/.cache/puppeteer" ]; then
    echo "Setting permissions for Puppeteer cache..."
    chmod -R 755 /opt/render/.cache/puppeteer
    
    # Find and set permissions for Chrome executable
    CHROME_PATH=$(find /opt/render/.cache/puppeteer -name "chrome" -type f 2>/dev/null | head -1)
    if [ -n "$CHROME_PATH" ]; then
        echo "Found Chrome at: $CHROME_PATH"
        chmod +x "$CHROME_PATH"
    else
        echo "⚠️  Chrome executable not found in expected location"
    fi
else
    echo "⚠️  Puppeteer cache directory does not exist"
fi

# List installed browsers
echo "Installed browsers:"
npx puppeteer browsers list

echo "✅ Build completed successfully" 