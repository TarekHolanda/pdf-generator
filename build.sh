#!/bin/bash

echo "Starting build process..."

# Install dependencies (this will also run the postinstall script)
echo "Installing npm dependencies..."
npm install

# Verify Chrome installation
echo "Verifying Chrome installation..."
if npx puppeteer browsers list | grep -q "chrome"; then
    echo "Chrome is installed successfully"
else
    echo "Chrome installation verification failed, attempting manual install..."
    npx puppeteer browsers install chrome
fi

# Set permissions if the directory exists
if [ -d "/opt/render/.cache/puppeteer" ]; then
    echo "Setting permissions for Puppeteer cache..."
    chmod -R 755 /opt/render/.cache/puppeteer
fi

echo "Build completed successfully" 