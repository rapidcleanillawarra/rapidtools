feat(workshop): Add photo management and update status workflow

This commit introduces comprehensive photo management for workshops, including orphaned photo cleanup, storage statistics, and updates the workflow status from 'pending' to 'new'.

### Files Modified:

#### 1. `src/lib/services/workshop.ts`
- ADDED: `cleanupOrphanedPhotos()` function for storage maintenance
- ADDED: `getPhotoStatistics()` for storage monitoring
- ADDED: `cleanupWorkshopPhotos()` for single workshop cleanup
- CHANGED: Workshop status from 'pending' to 'new'
- IMPROVED: Photo cleanup during workshop deletion
- DIFF:
  ```diff
  - status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  + status: 'new' | 'in_progress' | 'completed' | 'cancelled';

  - status: 'pending' as const,
  + status: 'new' as const,

  + export async function cleanupOrphanedPhotos(): Promise<{
  +   found: number;
  +   deleted: number;
  +   errors: string[];
  + }> {
  ```

#### 2. `src/routes/(protected)/workshop/+page.svelte`
- ADDED: New management dashboard page
- ADDED: Storage statistics display
- ADDED: Orphaned photo cleanup interface
- ADDED: Recent workshops list
- CHANGED: Status color scheme to match new workflow
- DIFF:
  ```diff
  - case 'pending': return 'bg-yellow-100 text-yellow-800';
  + case 'new': return 'bg-blue-100 text-blue-800';
  + case 'in_progress': return 'bg-yellow-100 text-yellow-800';
  ```

#### 3. `src/routes/(protected)/workshop/camera/+page.svelte`
- ADDED: URL parameter to track entry point
- DIFF:
  ```diff
  - <a href="{base}/workshop/create" class="px-3 py-2 bg-gray-700 text-white rounded-md text-sm hover:bg-gray-800">Done</a>
  + <a href="{base}/workshop/create?from=camera" class="px-3 py-2 bg-gray-700 text-white rounded-md text-sm hover:bg-gray-800">Done</a>
  ```

### Database Changes:

```sql
-- Update existing workshops
ALTER TABLE workshop ALTER COLUMN status SET DEFAULT 'new';
UPDATE workshop SET status = 'new' WHERE status = 'pending';

-- Update status check constraint
ALTER TABLE workshop DROP CONSTRAINT IF EXISTS workshop_status_check;
ALTER TABLE workshop ADD CONSTRAINT workshop_status_check 
  CHECK (status IN ('new', 'in_progress', 'completed', 'cancelled'));
```

### Technical Improvements:

#### Photo Management
- BEFORE: No cleanup mechanism for orphaned photos
- AFTER: Automated cleanup with manual and automatic triggers
- IMPACT: Reduced storage costs and improved data consistency

#### Status Workflow
- BEFORE: Workshops started as 'pending'
- AFTER: Workshops start as 'new' with clear status progression
- IMPACT: Better workflow clarity and status tracking

#### Storage Monitoring
- BEFORE: No visibility into storage usage
- AFTER: Detailed statistics with orphaned file detection
- IMPACT: Proactive storage management and cost control

### Security Considerations:
- Photo deletion requires authentication
- Safe file path handling in storage operations
- Proper error handling for failed deletions
- Row-level security maintained

### Performance Optimizations:
- Batch photo deletions using Promise.all
- Efficient photo URL extraction and comparison
- Indexed status and customer_name columns
- Optimized storage queries with limits

### Testing Instructions:

1. **Photo Cleanup:**
   ```bash
   # Navigate to workshop management
   /workshop

   # Check statistics
   Click "Clean Storage" to view orphaned photos

   # Run cleanup
   Confirm cleanup in modal
   ```

2. **Status Workflow:**
   ```bash
   # Test camera workflow
   /workshop/camera → take photos → create form
   Verify status: 'new' (blue badge)

   # Test form workflow
   /workshop/create
   Verify status: 'new' (blue badge)
   ```

3. **Storage Management:**
   ```bash
   # Monitor statistics
   Check dashboard for:
   - Total photos
   - Used photos
   - Orphaned photos
   - Storage size
   ```

### Breaking Changes:
- Workshops previously marked as 'pending' will be updated to 'new'
- Status color scheme updated in UI
- Photo cleanup may remove orphaned files from storage

### Error Handling:
- Detailed error messages for failed cleanups
- Safe handling of missing photos
- Graceful handling of storage API errors
- User feedback for all operations

### Related Features:
- Workshop creation from camera
- Workshop creation from form
- Photo storage management
- Status workflow tracking