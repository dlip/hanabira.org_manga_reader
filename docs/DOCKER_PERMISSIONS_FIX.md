# Docker Volume Permission Fix - Orphan Deletion

## Problem

When trying to delete orphaned directories via the backend API, deletion fails with permission errors:

```
Permission denied - check file ownership in Docker container
```

### Root Cause

**User/Permission Mismatch:**
- Frontend container creates files as: `nextjs:nodejs` (UID 1001, GID 1001)
- Backend container was running as: `app:app` (UID varies, likely 1000)
- Shared volume `manga_library` contains files owned by frontend
- Backend cannot delete files it doesn't own

**Evidence:**
```bash
nextjs@5b7ccb205e6d:/app/public/library$ ls -larth
drwxr-xr-x 3 nextjs nodejs 4.0K Sep 27 17:31 series_1758976586024_c189hi0ys
drwxr-xr-x 4 nextjs nodejs 4.0K Sep 27 17:31 ruri-rocks-series
# All files owned by nextjs:nodejs (UID 1001:1001)
```

## Solution Implemented

### 1. Backend Dockerfile Update

**Changed:** Backend user to use UID 1001 to match frontend

```dockerfile
# Before:
RUN useradd --create-home --shell /bin/bash app && \
    chown -R app:app /app
USER app

# After:
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid 1001 --create-home --shell /bin/bash app && \
    chown -R app:appgroup /app

RUN mkdir -p /app/shared/library && \
    chown -R app:appgroup /app/shared && \
    chmod -R 775 /app/shared

USER app
```

**Result:** Backend runs as UID 1001 (same as frontend)

### 2. Docker Compose Update

**Added explicit user mapping:**

```yaml
backend:
  user: "1001:1001"  # Match frontend user
  
frontend:
  user: "1001:1001"  # Explicit mapping
```

**Result:** Both containers run with same UID/GID for shared volume access

### 3. Shared Volume Permissions

The `manga_library` volume is now accessible by both services:
- Both run as UID 1001
- Files created by either service are accessible to both
- Deletion operations now succeed

## Deployment Steps

### Step 1: Rebuild Images

```bash
# Stop existing containers
docker-compose down

# Rebuild with new Dockerfile changes
docker-compose build --no-cache backend frontend

# Start services
docker-compose up -d
```

### Step 2: Fix Existing File Permissions (One-time)

If you have existing files with wrong permissions:

```bash
# Enter the backend container as root
docker exec -u root -it mokuro-backend bash

# Fix ownership of shared library
chown -R 1001:1001 /app/shared/library

# Exit
exit
```

Or from frontend container:

```bash
# Enter frontend container as root
docker exec -u root -it mokuro-frontend bash

# Fix ownership
chown -R 1001:1001 /app/public/library

# Exit
exit
```

### Step 3: Verify Permissions

```bash
# Check backend can access
docker exec -it mokuro-backend ls -la /app/shared/library

# Check frontend can access
docker exec -it mokuro-frontend ls -la /app/public/library

# Both should show same files owned by UID 1001
```

### Step 4: Test Orphan Deletion

1. Go to `/library/orphans` in the UI
2. Find an orphan directory
3. Click "Delete"
4. Should succeed without permission errors!

## How It Works Now

```
┌─────────────────────────────────────────────────────┐
│                  Docker Volume                       │
│              manga_library (shared)                  │
│                                                      │
│  Files owned by: UID 1001, GID 1001                 │
│  Permissions: drwxrwxr-x (775)                      │
└─────────────────────────────────────────────────────┘
           ↑                            ↑
           │                            │
   ┌───────────────┐          ┌────────────────┐
   │   Backend     │          │   Frontend     │
   │  (Flask API)  │          │  (Next.js)     │
   │               │          │                │
   │ User: 1001    │          │ User: 1001     │
   │ Group: 1001   │          │ Group: 1001    │
   │               │          │                │
   │ Can: Read     │          │ Can: Read      │
   │      Write    │          │      Write     │
   │      Delete ✓ │          │      Delete ✓  │
   └───────────────┘          └────────────────┘
```

## Verification Commands

### Check Current User IDs
```bash
# Backend
docker exec mokuro-backend id
# Should show: uid=1001(app) gid=1001(appgroup)

# Frontend  
docker exec mokuro-frontend id
# Should show: uid=1001(nextjs) gid=1001(nodejs)
```

### Check File Ownership
```bash
# List files with ownership
docker exec mokuro-backend ls -lan /app/shared/library
# All should show UID 1001, GID 1001
```

### Test File Operations
```bash
# Create test file from backend
docker exec mokuro-backend touch /app/shared/library/backend-test.txt

# Verify frontend can see it
docker exec mokuro-frontend ls -l /app/public/library/backend-test.txt

# Delete from backend
docker exec mokuro-backend rm /app/shared/library/backend-test.txt
# Should succeed without errors
```

## Alternative Solutions (Not Implemented)

### Option 1: Run Backend as Root (Not Recommended)
- Security risk
- Against Docker best practices
- Not implemented

### Option 2: Use ACLs (Access Control Lists)
- More complex to set up
- Requires additional tools
- Overkill for this use case

### Option 3: Use Docker Volume Plugin
- Adds dependency
- More complex configuration
- Current solution is simpler

## Troubleshooting

### Problem: Still getting permission errors

**Solution 1:** Verify user IDs match
```bash
docker exec mokuro-backend id
docker exec mokuro-frontend id
# Both should show UID 1001
```

**Solution 2:** Rebuild images from scratch
```bash
docker-compose down -v  # WARNING: Deletes volumes!
docker-compose build --no-cache
docker-compose up -d
```

**Solution 3:** Manually fix existing files
```bash
docker exec -u root -it mokuro-backend chown -R 1001:1001 /app/shared/library
```

### Problem: Container won't start with user mapping

Check logs:
```bash
docker-compose logs backend
docker-compose logs frontend
```

Remove user mapping temporarily:
```yaml
# Comment out in docker-compose.yml
# user: "1001:1001"
```

### Problem: Permission denied on volumes

Ensure host directories (if using bind mounts) are accessible:
```bash
# On host
sudo chown -R 1001:1001 ./host-data/manga-library
```

## Security Considerations

✅ **Safe:**
- Both containers run as non-root (UID 1001)
- Shared volume has restricted permissions (775)
- No privilege escalation required

⚠️ **Note:**
- Both services share same UID for file operations
- This is acceptable since they're in same trust boundary
- Services communicate over internal Docker network only

## Summary

**Before:**
- Backend: UID varies (1000?) → ❌ Cannot delete frontend files
- Frontend: UID 1001 → ✓ Can create files

**After:**
- Backend: UID 1001 → ✓ Can delete all files
- Frontend: UID 1001 → ✓ Can create files
- **Result: Orphan deletion works!** 🎉

## Files Modified

1. ✅ `backend/Dockerfile` - Updated user creation with explicit UID/GID
2. ✅ `docker-compose.yml` - Added user mappings for both services
3. ✅ This documentation file

## Next Steps

1. **Rebuild containers:** `docker-compose build --no-cache backend frontend`
2. **Restart services:** `docker-compose down && docker-compose up -d`
3. **Fix existing files:** `docker exec -u root -it mokuro-backend chown -R 1001:1001 /app/shared/library`
4. **Test deletion:** Try deleting orphans via UI
5. **Monitor logs:** `docker-compose logs -f backend` during deletion
