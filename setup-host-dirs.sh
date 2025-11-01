#!/bin/bash

# Setup script for mokuro-reader-enhanced Docker environment
# Creates host directories for bind mounts with proper permissions

set -e

echo "🚀 Setting up mokuro-reader-enhanced host directories..."

# Get current user info
USER_ID=$(id -u)
GROUP_ID=$(id -g) 
USER_NAME=$(whoami)

echo "📋 Current user: $USER_NAME (UID: $USER_ID, GID: $GROUP_ID)"

# Create base host-data directory
mkdir -p host-data

# Create subdirectories
mkdir -p host-data/backend-data
mkdir -p host-data/logs
mkdir -p host-data/manga-library

echo "📁 Created directory structure:"
echo "  host-data/"
echo "  ├── backend-data/     (SQLite DB, config files)"
echo "  ├── logs/            (Application logs)"  
echo "  └── manga-library/   (Mokuro manga files)"

# Set permissions so both host user and container can access
echo "🔐 Setting permissions..."

# Make directories writable by user and group
chmod 755 host-data
chmod 775 host-data/backend-data
chmod 775 host-data/logs
chmod 775 host-data/manga-library

# Set ownership to current user
chown -R $USER_ID:$GROUP_ID host-data

echo "✅ Directory setup complete!"
echo ""
echo "📚 How to add manga files:"
echo "1. Copy your mokuro manga directories to: ./host-data/manga-library/"
echo "2. Structure should be: ./host-data/manga-library/series_name/chapter_name/"
echo "3. Each chapter should contain: .html, .mokuro, and image files"
echo ""
echo "📖 Example structure:"
echo "  host-data/manga-library/"
echo "  └── my_manga_series/"
echo "      ├── chapter_01/"
echo "      │   ├── chapter_01.html"
echo "      │   ├── chapter_01.mokuro"
echo "      │   └── images/"
echo "      └── chapter_02/"
echo "          ├── chapter_02.html"
echo "          ├── chapter_02.mokuro"
echo "          └── images/"
echo ""
echo "🐳 Ready to run Docker Compose!"
echo "Production: docker compose -f docker-compose.host-mounts.yml up"
echo "Development: docker compose -f docker-compose.host-mounts.dev.yml up"