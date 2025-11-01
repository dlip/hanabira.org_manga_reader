#!/bin/bash

# Test script to verify host mounts are working correctly

echo "🧪 Testing Host Mounts Configuration..."

# Check if host-data directories exist
if [ ! -d "host-data" ]; then
    echo "❌ host-data directory not found. Run ./setup-host-dirs.sh first"
    exit 1
fi

echo "✅ host-data directory exists"

# Check subdirectories
for dir in backend-data logs manga-library; do
    if [ ! -d "host-data/$dir" ]; then
        echo "❌ host-data/$dir directory missing"
        exit 1
    else
        echo "✅ host-data/$dir exists"
    fi
done

# Test file creation permissions
echo "🔐 Testing write permissions..."

test_file="host-data/backend-data/test-write.tmp"
if echo "test" > "$test_file" 2>/dev/null; then
    echo "✅ Backend data directory is writable"
    rm "$test_file"
else
    echo "❌ Cannot write to backend-data directory"
    exit 1
fi

test_file="host-data/manga-library/test-write.tmp" 
if echo "test" > "$test_file" 2>/dev/null; then
    echo "✅ Manga library directory is writable"
    rm "$test_file" 
else
    echo "❌ Cannot write to manga-library directory"
    exit 1
fi

# Check if docker-compose files exist
for file in docker-compose.host-mounts.yml docker-compose.host-mounts.dev.yml; do
    if [ ! -f "$file" ]; then
        echo "❌ $file not found"
        exit 1
    else
        echo "✅ $file exists"
    fi
done

# Validate docker-compose files
echo "🐳 Validating Docker Compose configurations..."

if docker compose -f docker-compose.host-mounts.yml config --quiet 2>/dev/null; then
    echo "✅ Production host-mounts config is valid"
else
    echo "❌ Production host-mounts config has errors"
    exit 1
fi

if docker compose -f docker-compose.host-mounts.dev.yml config --quiet 2>/dev/null; then
    echo "✅ Development host-mounts config is valid"
else
    echo "❌ Development host-mounts config has errors"
    exit 1
fi

# Check if manga files exist
manga_count=$(find host-data/manga-library -name "*.mokuro" 2>/dev/null | wc -l)
echo "📚 Found $manga_count mokuro files in manga-library"

if [ "$manga_count" -gt 0 ]; then
    echo "✅ Manga files are present for testing"
    echo "📁 Sample files:"
    find host-data/manga-library -name "*.mokuro" 2>/dev/null | head -3 | sed 's/^/    /'
else
    echo "⚠️  No manga files found. You can add them to host-data/manga-library/"
fi

echo ""
echo "🎉 Host mounts configuration test completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Add manga files: cp -r /your/manga/* host-data/manga-library/"
echo "2. Run production: docker compose -f docker-compose.host-mounts.yml up -d"
echo "3. Run development: docker compose -f docker-compose.host-mounts.dev.yml up -d"