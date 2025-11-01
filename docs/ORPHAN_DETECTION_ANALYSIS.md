# Orphan Detection & Deletion Issue Analysis

## Problem Summary
The orphan detection system shows more orphaned directories than actually exist, and deletion operations fail even when showing the correct directory path.

## Root Cause Analysis

### 1. **Path Format Inconsistency**

**The Core Issue:** The orphan detection logic parses file paths with a critical assumption that breaks in Docker environments.

#### Backend Orphan Detection Logic (`app.py` lines 38-48):
```python
def _gather_existing_chapter_dir_pairs() -> set[tuple[str, str]]:
    """Return set of (series_id, chapter_folder) pairs referenced by chapters.file_path rows.
    We parse stored file_path values of form /library/<series>/<chapterFolder>/<file>.html
    """
    from db import get_chapters
    pairs: set[tuple[str, str]] = set()
    for ch in get_chapters():
        fp = ch.get('file_path') or ''
        fp_clean = fp.split('?')[0].split('#')[0]
        if fp_clean.startswith('/library/'):
            parts = fp_clean.strip('/').split('/')
            if len(parts) >= 4:  # library, series, chapterFolder, file
                pairs.add((parts[1], parts[2]))  # ← PROBLEM: Assumes exactly 4 parts
    return pairs
```

**The Assumption:** The code expects paths in format: `/library/<series_id>/<chapter_folder>/<file>.html` (exactly 4 parts when split)

**What Actually Happens in Docker:**

1. **Frontend stores paths as:** `/library/<series_id>/<chapter_folder>/<file>.html` ✓
2. **Backend reads from database:** Same format ✓
3. **Filesystem structure in Docker:**
   - Backend sees: `/app/shared/library/<series_id>/<chapter_folder>/`
   - Frontend sees: `/app/public/library/<series_id>/<chapter_folder>/`
   
4. **The parsing breaks when:**
   - Paths have query parameters: `/library/series/chapter/file.html?page=5`
   - Paths have URL fragments: `/library/series/chapter/file.html#section`
   - Subdirectories exist: `/library/series/chapter/subdir/file.html` ← **This is the killer**

#### Path Parsing Issues:

**Scenario A: Subdirectories in chapter folders**
```
Stored path: /library/ruri-rocks-series/ruri_rocks_ch_1-dp9otz/images/page_001.jpg
Split result: ['', 'library', 'ruri-rocks-series', 'ruri_rocks_ch_1-dp9otz', 'images', 'page_001.jpg']
Length: 6 parts (not 4!)
Condition check: len(parts) >= 4 → TRUE
Extracted pair: ('ruri-rocks-series', 'ruri_rocks_ch_1-dp9otz') ✓ CORRECT
```

**Wait, this should work!** Let me reconsider...

### 2. **Actual Problem: Duplicate Detection**

Looking at the orphan detection logic more carefully:

```python
def _find_orphan_chapter_dirs() -> list[OrphanChapterDir]:
    existing_pairs = _gather_existing_chapter_dir_pairs()
    orphans: list[OrphanChapterDir] = []
    
    for series_id in os.listdir(SHARED_LIBRARY_ROOT):
        series_dir = os.path.join(SHARED_LIBRARY_ROOT, series_id)
        if not os.path.isdir(series_dir):
            continue
            
        child_dirs: list[str] = []
        for chapter_folder in os.listdir(series_dir):
            chapter_dir = os.path.join(series_dir, chapter_folder)
            if not os.path.isdir(chapter_dir):
                continue
            child_dirs.append(chapter_folder)
            
            pair = (series_id, chapter_folder)
            if pair not in existing_pairs:
                # Mark as orphan chapter
                orphans.append(OrphanChapterDir(..., kind='chapter'))
        
        # ⚠️ ISSUE 1: Duplicate series-level orphan detection
        if child_dirs and all((series_id, c) not in existing_pairs for c in child_dirs):
            # Entire series directory unused - adds series-level orphan
            orphans.append(OrphanChapterDir(..., kind='series'))
        
        # ⚠️ ISSUE 2: Also adds series orphan for empty directories
        if not child_dirs:
            orphans.append(OrphanChapterDir(..., kind='series'))
```

**Problem 1: Double Counting**
- If a series has 3 orphaned chapters, it adds:
  - 3 individual chapter orphans (kind='chapter')
  - 1 series-level orphan (kind='series') because ALL chapters are orphaned
  - **Total: 4 entries for what's really 1 unused series directory**

**Problem 2: Mixed Orphan States Not Handled**
- If a series has 2 chapters in DB and 3 orphaned chapter folders:
  - The 3 orphaned chapters are correctly identified
  - But the series-level check fails because NOT ALL children are orphaned
  - **Result: Shows 3 orphans, but they're part of an active series!**

### 3. **Deletion Failure Root Causes**

#### Issue A: URL Encoding in DELETE Request

**Frontend code** (`OrphanClient.tsx` line 43):
```typescript
async deleteOrphanChapterDir(seriesId: string, chapterFolder: string): Promise<void> {
  await apiClient.maintenance.deleteOrphanChapterDir(seriesId, chapterFolder);
}

// In api-client.ts:
await this.delete(`/maintenance/orphans/${encodeURIComponent(seriesId)}/${encodeURIComponent(chapterFolder)}`);
```

**Backend route**:
```python
@app.route('/maintenance/orphans/<series_id>/<chapter_folder>', methods=['DELETE'])
def delete_orphan_chapter_dir(series_id: str, chapter_folder: str):
```

**The Problem:**
- Series orphans have `chapter_folder = ''` (empty string)
- Frontend encodes empty string: `encodeURIComponent('') → ''`
- URL becomes: `/maintenance/orphans/series_id/` (trailing slash)
- Flask route expects: `/maintenance/orphans/<series_id>/<chapter_folder>`
- **Route doesn't match! DELETE request fails with 404**

#### Issue B: Path Validation Fails for Encoded Names

If chapter folder contains special characters (spaces, etc.):
- Stored in DB: `ruri rocks ch 1`
- Directory on disk: `ruri rocks ch 1`
- Frontend sends: `ruri%20rocks%20ch%201`
- Flask receives (URL-decoded): `ruri rocks ch 1` ✓
- Path check: `os.path.join(SHARED_LIBRARY_ROOT, series_id, 'ruri rocks ch 1')`
- **If filesystem doesn't match exactly, deletion fails**

### 4. **Container Volume Mapping Issues**

**Docker Compose Configuration:**
```yaml
backend:
  volumes:
    - manga_library:/app/shared/library

frontend:
  volumes:
    - manga_library:/app/public/library
```

**Potential Issues:**

1. **Permissions Mismatch:**
   - Frontend runs as user X (often root or node user)
   - Backend runs as user Y (often root or python user)
   - If files created by frontend, backend may not have delete permissions

2. **Race Conditions:**
   - Frontend serves files from `/app/public/library`
   - Backend tries to delete from `/app/shared/library`
   - Same volume, but concurrent access can cause issues

3. **Stale Directory Listings:**
   - `os.listdir()` in Python may cache results
   - Deletion appears to fail but actually succeeds
   - Refresh shows different results

### 5. **The "Seeing More Than Exists" Issue**

**Scenario:** User reports seeing more orphans than actually exist.

**Root Cause Chain:**
1. A series `ruri-rocks-series` has 5 chapters total
2. 3 chapters are deleted from the database
3. Their directories remain on disk (orphaned)
4. Orphan detection finds:
   - 3 individual chapter orphans ✓
   - 1 series-level orphan ✗ (WRONG - series still has 2 active chapters!)
5. **UI shows 4 items, but only 3 should be deletable**

**The Bug:** Series-level orphan is added even when series is partially active:
```python
# This check is WRONG:
if child_dirs and all((series_id, c) not in existing_pairs for c in child_dirs):
    orphans.append(OrphanChapterDir(..., kind='series'))
```

**Should be:**
```python
# Need to check if series itself exists in database
from db import get_series_by_id
if child_dirs and all((series_id, c) not in existing_pairs for c in child_dirs):
    # Also verify series doesn't exist in DB
    if not get_series_by_id(series_id):
        orphans.append(OrphanChapterDir(..., kind='series'))
```

## Summary of Issues

| Issue | Severity | Impact |
|-------|----------|--------|
| **Duplicate orphan entries** (chapters + series) | HIGH | Shows more orphans than exist, confuses users |
| **Empty string chapter_folder in DELETE URL** | CRITICAL | Series deletion fails with 404 |
| **Series-level orphan added for active series** | HIGH | Offers to delete directories that are still in use |
| **No validation of series existence** | MEDIUM | Can delete series directories while chapters still in DB |
| **Permission issues in Docker** | MEDIUM | Deletions may fail silently |
| **Path encoding edge cases** | LOW | Fails for unusual folder names |

## Recommended Fixes

### Fix 1: Correct Orphan Detection Logic
```python
def _find_orphan_chapter_dirs() -> list[OrphanChapterDir]:
    from db import get_series  # Import series lookup
    existing_pairs = _gather_existing_chapter_dir_pairs()
    orphans: list[OrphanChapterDir] = []
    
    if not os.path.isdir(SHARED_LIBRARY_ROOT):
        return orphans
    
    # Get all series IDs from database
    db_series_ids = {s['id'] for s in get_series()}
    
    for series_id in os.listdir(SHARED_LIBRARY_ROOT):
        series_dir = os.path.join(SHARED_LIBRARY_ROOT, series_id)
        if not os.path.isdir(series_dir):
            continue
        
        child_dirs: list[str] = []
        orphaned_chapters: list[str] = []
        
        for chapter_folder in os.listdir(series_dir):
            chapter_dir = os.path.join(series_dir, chapter_folder)
            if not os.path.isdir(chapter_dir):
                continue
            
            child_dirs.append(chapter_folder)
            pair = (series_id, chapter_folder)
            
            if pair not in existing_pairs:
                orphaned_chapters.append(chapter_folder)
                size, count = _compute_dir_stats(chapter_dir)
                rel_path = f"/library/{series_id}/{chapter_folder}"
                orphans.append(OrphanChapterDir(
                    series_id, chapter_folder, chapter_dir, 
                    rel_path, size, count, 'chapter'
                ))
        
        # FIXED: Only add series-level orphan if:
        # 1. Series NOT in database, OR
        # 2. ALL child directories are orphaned AND series has no active chapters
        if series_id not in db_series_ids:
            if child_dirs or not os.listdir(series_dir):  # Has children or is empty
                size, count = _compute_dir_stats(series_dir)
                rel_path = f"/library/{series_id}"
                orphans.append(OrphanChapterDir(
                    series_id, '', series_dir, 
                    rel_path, size, count, 'series'
                ))
    
    return orphans
```

### Fix 2: Handle Empty chapter_folder in DELETE Route
```python
@app.route('/maintenance/orphans/<series_id>', methods=['DELETE'])
@app.route('/maintenance/orphans/<series_id>/<chapter_folder>', methods=['DELETE'])
@log_endpoint_access
def delete_orphan_chapter_dir(series_id: str, chapter_folder: str = ''):
    """Delete an orphaned chapter directory or entire series directory.
    If chapter_folder is empty, deletes entire series directory.
    """
    try:
        # Safety checks...
        if any(sep in series_id for sep in ('..', '/', '\\')):
            return jsonify({'success': False, 'error': 'Invalid series_id'}), 400
        
        if chapter_folder and any(sep in chapter_folder for sep in ('..', '/', '\\')):
            return jsonify({'success': False, 'error': 'Invalid chapter_folder'}), 400
        
        existing_pairs = _gather_existing_chapter_dir_pairs()
        
        if chapter_folder:  # Deleting specific chapter
            if (series_id, chapter_folder) in existing_pairs:
                return jsonify({
                    'success': False, 
                    'error': 'Chapter is referenced in database'
                }), 409
            target_dir = os.path.join(SHARED_LIBRARY_ROOT, series_id, chapter_folder)
            deleted_path = f'/library/{series_id}/{chapter_folder}'
        else:  # Deleting entire series
            # Ensure NO chapters from this series exist in DB
            if any(pair[0] == series_id for pair in existing_pairs):
                return jsonify({
                    'success': False, 
                    'error': 'Series has active chapters in database'
                }), 409
            target_dir = os.path.join(SHARED_LIBRARY_ROOT, series_id)
            deleted_path = f'/library/{series_id}'
        
        # Validate path is within library root
        if not target_dir.startswith(SHARED_LIBRARY_ROOT):
            return jsonify({'success': False, 'error': 'Invalid path'}), 400
        
        if not os.path.isdir(target_dir):
            return jsonify({'success': False, 'error': 'Directory not found'}), 404
        
        # Attempt deletion with better error handling
        import shutil
        try:
            shutil.rmtree(target_dir)
            logger.info(f"Successfully deleted orphan directory: {target_dir}")
            return jsonify({'success': True, 'deleted': deleted_path})
        except PermissionError as pe:
            logger.error(f"Permission denied deleting {target_dir}: {pe}")
            return jsonify({
                'success': False, 
                'error': 'Permission denied - check file ownership'
            }), 500
        except Exception as de:
            logger.error(f"Failed to delete {target_dir}: {de}")
            return jsonify({
                'success': False, 
                'error': f'Deletion failed: {str(de)}'
            }), 500
            
    except Exception as e:
        logger.error(f"Delete orphan dir error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
```

### Fix 3: Update Frontend DELETE Call
```typescript
// In api-client.ts
async deleteOrphanChapterDir(seriesId: string, chapterFolder: string): Promise<void> {
  // Build URL correctly for both chapter and series deletions
  let url = `/maintenance/orphans/${encodeURIComponent(seriesId)}`;
  if (chapterFolder) {
    url += `/${encodeURIComponent(chapterFolder)}`;
  }
  await this.delete(url);
}
```

### Fix 4: Add Series Existence Check
```python
# In db.py, ensure this function exists:
def get_series_by_id(series_id: str) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM series WHERE id = ?", (series_id,))
    row = cur.fetchone()
    return row_to_dict(row) if row else None
```

## Testing Checklist

- [ ] Orphan detection correctly identifies ONLY truly orphaned directories
- [ ] No duplicate entries (same directory listed as both chapter and series orphan)
- [ ] Series-level orphans only appear for series NOT in database
- [ ] DELETE works for chapter-level orphans
- [ ] DELETE works for series-level orphans (empty chapter_folder)
- [ ] DELETE fails safely when trying to remove active chapters
- [ ] Permission errors are logged and reported clearly
- [ ] Special characters in folder names are handled correctly
- [ ] Refresh after deletion shows accurate results
