# Orphan Detection & Deletion Fixes - Implementation Summary

## Changes Implemented ✅

### 1. Backend: Fixed Orphan Detection Logic (`backend/app.py`)

**File:** `backend/app.py` - Function `_find_orphan_chapter_dirs()`

**What was wrong:**
- Added series-level orphans even when series existed in database
- Created duplicate entries (same directory shown as both chapter and series orphan)
- No validation that series actually exists in database

**What was fixed:**
```python
def _find_orphan_chapter_dirs() -> list[OrphanChapterDir]:
    from db import get_series_by_id  # NEW: Import series lookup
    
    # ... existing code ...
    
    for series_id in os.listdir(SHARED_LIBRARY_ROOT):
        # ... scan chapters ...
        
        # FIXED: Only add series-level orphan if series NOT in database
        series_in_db = get_series_by_id(series_id)
        
        if not series_in_db:
            # Series doesn't exist in DB - entire directory is orphaned
            if child_dirs or not os.listdir(series_dir):
                orphans.append(OrphanChapterDir(..., kind='series'))
```

**Result:**
- ✅ No more duplicate entries
- ✅ Series-level orphans only shown when series truly doesn't exist in DB
- ✅ Active series with orphaned chapters won't show series as orphan

---

### 2. Backend: Fixed DELETE Route (`backend/app.py`)

**File:** `backend/app.py` - Route `/maintenance/orphans/<series_id>` and `/<series_id>/<chapter_folder>`

**What was wrong:**
- Route only accepted `/maintenance/orphans/<series_id>/<chapter_folder>`
- When `chapter_folder` was empty (series deletion), URL became `/maintenance/orphans/series_id/`
- Flask couldn't match the route → 404 error

**What was fixed:**
```python
# Added TWO route patterns:
@app.route('/maintenance/orphans/<series_id>', methods=['DELETE'])  # For series
@app.route('/maintenance/orphans/<series_id>/<path:chapter_folder>', methods=['DELETE'])  # For chapters
@log_endpoint_access
def delete_orphan_chapter_dir(series_id: str, chapter_folder: str = ''):
    # Default parameter allows handling both cases
    
    if chapter_folder:
        # Delete specific chapter
        target_dir = os.path.join(SHARED_LIBRARY_ROOT, series_id, chapter_folder)
        deleted_path = f'/library/{series_id}/{chapter_folder}'
    else:
        # Delete entire series
        target_dir = os.path.join(SHARED_LIBRARY_ROOT, series_id)
        deleted_path = f'/library/{series_id}'
    
    # Better error handling
    try:
        shutil.rmtree(target_dir)
        return jsonify({'success': True, 'deleted': deleted_path})
    except PermissionError as pe:
        return jsonify({'error': 'Permission denied - check file ownership'}), 500
    except Exception as de:
        return jsonify({'error': f'Deletion failed: {str(de)}'}), 500
```

**Result:**
- ✅ Both `/maintenance/orphans/series_id` and `/maintenance/orphans/series_id/chapter` work
- ✅ Series-level deletions now succeed
- ✅ Better error messages for permission issues in Docker

---

### 3. Frontend: Fixed API Client (`frontend/src/lib/api-client.ts`)

**File:** `frontend/src/lib/api-client.ts` - Class `MaintenanceApiClient`

**What was wrong:**
- Always built URL with both series_id and chapter_folder
- When chapter_folder was empty: `/maintenance/orphans/series_id/` (invalid)

**What was fixed:**
```typescript
async deleteOrphanChapterDir(seriesId: string, chapterFolder: string): Promise<void> {
  // Build URL correctly for both scenarios
  let url = `/maintenance/orphans/${encodeURIComponent(seriesId)}`;
  
  if (chapterFolder) {
    // Only append chapter_folder if it's not empty
    url += `/${encodeURIComponent(chapterFolder)}`;
  }
  
  await this.delete(url);
}
```

**Result:**
- ✅ Series deletion: `/maintenance/orphans/series_id` (correct!)
- ✅ Chapter deletion: `/maintenance/orphans/series_id/chapter_folder` (correct!)
- ✅ No more 404 errors on series deletion

---

## Testing Instructions

### Test Case 1: Orphan Chapter Detection
1. Add a series with chapters to the database
2. Delete one chapter from database (but leave directory on disk)
3. Go to `/library/orphans`
4. **Expected:** Only the deleted chapter shows as orphan (NOT the entire series)

### Test Case 2: Orphan Series Detection  
1. Create a series directory on disk with chapters
2. Don't add the series to the database at all
3. Go to `/library/orphans`
4. **Expected:** Series shows as orphan (can delete entire series directory)

### Test Case 3: Chapter Deletion
1. Find an orphan chapter in the list
2. Click "Delete" button
3. **Expected:** 
   - Success toast message
   - Chapter directory removed from filesystem
   - Orphan disappears from list after refresh

### Test Case 4: Series Deletion
1. Find an orphan series (kind='series') in the list
2. Click "Delete" button (should show confirmation modal)
3. Confirm deletion
4. **Expected:**
   - Success toast message
   - Entire series directory removed from filesystem
   - Series disappears from list after refresh

### Test Case 5: No Duplicates
1. Create a series NOT in database with 3 chapter directories
2. Go to `/library/orphans`
3. **Expected:** Only 1 entry (series-level orphan), NOT 4 entries

### Test Case 6: Mixed State (Active Series with Orphaned Chapters)
1. Add series with 3 chapters to database
2. Create 2 additional chapter directories on disk (not in DB)
3. Go to `/library/orphans`
4. **Expected:** 2 orphan chapters shown, series NOT shown as orphan

---

## Key Improvements

1. **Accurate Detection:** Only true orphans are detected
2. **No Duplicates:** Each directory appears once in the list
3. **Series Validation:** Checks database to determine if series is truly orphaned
4. **Working Deletion:** Both chapter and series deletions now succeed
5. **Better Errors:** Permission and other errors reported clearly
6. **Security:** Path traversal protection maintained

---

## Breaking Changes

⚠️ **None** - All changes are backward compatible.

The API endpoints remain the same, just with better handling:
- `GET /maintenance/orphans` - Works as before
- `DELETE /maintenance/orphans/<series_id>` - NEW pattern added
- `DELETE /maintenance/orphans/<series_id>/<chapter_folder>` - Works as before

---

## Files Modified

1. ✅ `backend/app.py`
   - `_find_orphan_chapter_dirs()` - Added series DB validation
   - `delete_orphan_chapter_dir()` - Added dual route pattern, better error handling

2. ✅ `frontend/src/lib/api-client.ts`
   - `deleteOrphanChapterDir()` - Fixed URL building logic

3. ✅ `backend/db.py`
   - No changes needed - `get_series_by_id()` already existed

---

## Deployment Notes

**For Docker deployments:**
- Rebuild backend image to get the fixes
- Frontend build will include API client changes
- No database migrations needed
- No breaking changes to API contracts

**Commands:**
```bash
# Rebuild and restart
docker-compose down
docker-compose build backend frontend
docker-compose up -d

# Or if running locally:
# Backend: Restart Flask server
# Frontend: Restart Next.js dev server
```

---

## Related Issues Fixed

- ✅ Issue: "Seeing more orphans than actually exist"
- ✅ Issue: "Deletion doesn't work even when showing correct directory"  
- ✅ Issue: "Active series showing as orphaned"
- ✅ Issue: "Same directory listed multiple times"
- ✅ Issue: "404 errors when deleting series-level orphans"

---

## Future Enhancements (Optional)

1. Add progress indicator during deletion
2. Batch delete multiple orphans at once
3. Dry-run mode to preview what would be deleted
4. Orphan size threshold warnings (e.g., >1GB)
5. Scheduled automatic cleanup option
