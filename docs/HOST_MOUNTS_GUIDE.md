# Docker Host Mounts Setup Guide

## Overview

This guide explains how to use host bind mounts instead of Docker named volumes for easier file management and user access.

## Directory Structure

```
mokuro-reader-enhanced/
├── host-data/                    # Host-accessible data directory
│   ├── backend-data/            # SQLite database, config files
│   │   ├── flashcards.db       # User flashcards and progress
│   │   └── images/             # Uploaded images from flashcards
│   ├── logs/                   # Application logs
│   └── manga-library/          # Mokuro manga files (USER ACCESS)
│       ├── series1/
│       │   ├── chapter1/
│       │   │   ├── chapter1.html
│       │   │   ├── chapter1.mokuro
│       │   │   └── images/
│       │   └── chapter2/
│       └── series2/
├── docker-compose.host-mounts.yml      # Production with host mounts
├── docker-compose.host-mounts.dev.yml  # Development with host mounts
└── setup-host-dirs.sh                  # Setup script
```

## Quick Start

1. **Setup host directories:**
   ```bash
   ./setup-host-dirs.sh
   ```

2. **Add your manga files:**
   ```bash
   # Copy your mokuro manga to:
   cp -r /path/to/your/manga/* ./host-data/manga-library/
   ```

3. **Run with host mounts:**
   ```bash
   # Production
   docker compose -f docker-compose.host-mounts.yml up -d
   
   # Development (with hot reloading)
   docker compose -f docker-compose.host-mounts.dev.yml up -d
   ```

## Adding New Manga

### Method 1: Direct Copy
```bash
# Copy entire manga series
cp -r /your/manga/series_name ./host-data/manga-library/

# Or copy individual chapters
cp -r /your/manga/series/chapter_01 ./host-data/manga-library/series_name/
```

### Method 2: Symlinks (Advanced)
```bash
# Create symlinks to your existing manga collection
ln -s /your/existing/manga/location ./host-data/manga-library/series_name
```

## File Permissions

The setup script automatically configures permissions:
- **Owner:** Your current user (1000:1000 typically)
- **Permissions:** 755 for directories, allowing container access
- **Group writable:** Containers can write logs and database files

## Expected Mokuro File Structure

Each manga chapter should contain:
```
chapter_directory/
├── chapter.html        # Mokuro HTML viewer
├── chapter.mokuro     # OCR text data (JSON)
└── images/           # Page images
    ├── page_001.jpg
    ├── page_002.jpg
    └── ...
```

## Container Access

- **Backend container:** Mounts manga-library to `/app/shared/library`
- **Frontend container:** Mounts manga-library to `/app/public/library`  
- **Database:** Stored in `./host-data/backend-data/flashcards.db`
- **Logs:** Accessible in `./host-data/logs/`

## Troubleshooting

### Permission Issues
```bash
# Reset permissions if containers can't write
sudo chown -R 1000:1000 host-data/
chmod -R 755 host-data/
```

### Missing Files
```bash
# Check what's actually mounted
docker exec -it mokuro-backend ls -la /app/shared/library
docker exec -it mokuro-frontend ls -la /app/public/library
```

### Database Issues
```bash
# Check database file
ls -la host-data/backend-data/flashcards.db

# Backup database
cp host-data/backend-data/flashcards.db host-data/backend-data/flashcards.db.backup
```

## Advantages of Host Mounts

1. **Easy Access:** Files visible in normal file system
2. **No Root Ownership:** Files owned by your user
3. **Easy Backup:** Simple `cp` or `rsync` commands  
4. **Development Friendly:** Direct file editing
5. **Debugging:** Direct access to logs and database

## Migration from Named Volumes

If you previously used named volumes, you can migrate data:

```bash
# Extract data from named volume
docker run --rm -v mokuro_backend_data:/from alpine cp -r /from /backup

# Copy to host directory  
docker cp container:/backup/* ./host-data/backend-data/
```

## Configuration Files

- `docker-compose.host-mounts.yml`: Production configuration with bind mounts
- `docker-compose.host-mounts.dev.yml`: Development with hot reloading + bind mounts
- Original files still available for named volume approach