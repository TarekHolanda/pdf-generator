#!/bin/bash

# Install dependencies
npm install

# Install Chrome for Puppeteer
npx puppeteer browsers install chrome

# Set proper permissions
chmod -R 755 /opt/render/.cache/puppeteer

echo "Build completed successfully" 