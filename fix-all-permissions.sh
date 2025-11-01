#!/bin/bash
# Complete fix for Docker permission issues

set -e  # Exit on error

echo "🔧 Complete Docker Permission Fix"
echo "================================="
echo ""

# Step 1: Stop containers
echo "Step 1: Stopping containers..."
docker compose down
echo "✅ Done"
echo ""

# Step 2: Fix volume permissions using a temporary container
echo "Step 2: Fixing volume permissions..."
echo ""

# Fix backend_data volume
echo "  📁 Fixing backend_data volume..."
docker run --rm \
  -v mokuro-reader-enhanced_backend_data:/data \
  alpine:latest \
  chown -R 1001:1001 /data
echo "  ✅ backend_data fixed"

# Fix backend_logs volume  
echo "  📁 Fixing backend_logs volume..."
docker run --rm \
  -v mokuro-reader-enhanced_backend_logs:/logs \
  alpine:latest \
  chown -R 1001:1001 /logs
echo "  ✅ backend_logs fixed"

# Fix manga_library volume
echo "  📁 Fixing manga_library volume..."
docker run --rm \
  -v mokuro-reader-enhanced_manga_library:/library \
  alpine:latest \
  chown -R 1001:1001 /library
echo "  ✅ manga_library fixed"

echo ""
echo "Step 3: Starting containers with correct permissions..."
docker compose up -d

echo ""
echo "Step 4: Waiting for containers to start..."
sleep 5

echo ""
echo "Step 5: Verifying setup..."
echo ""

echo "Backend user:"
docker exec mokuro-backend id

echo ""
echo "Frontend user:"
docker exec mokuro-frontend id

echo ""
echo "Database file permissions:"
docker exec mokuro-backend ls -la /app/data/flashcards.db 2>/dev/null || echo "  Database will be created"

echo ""
echo "Library permissions:"
docker exec mokuro-backend ls -la /app/shared/library | head -3

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Fix complete!"
echo ""
echo "Services:"
echo "  - Backend:  http://localhost:5000"
echo "  - Frontend: http://localhost:3000"
echo "  - Orphans:  http://localhost:3000/library/orphans"
echo ""
echo "Check status: docker compose ps"
echo "Check logs:   docker compose logs -f"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
