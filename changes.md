# fix(workshop): Enforce minimum photo requirement in camera workflow

This commit improves the workshop camera functionality by ensuring consistent photo requirements across all save operations.

### Files Modified:

#### 1. `src/routes/(protected)/workshop/camera/+page.svelte`
- ADDED: Validation to enforce minimum of 2 photos before saving
- ADDED: Clear error messages when attempting to save with insufficient photos
- DIFF:
  ```diff
  // In saveAndTakeMorePhotos function
  + if (photos.length < 2) {
  +   toastError('Please take at least 2 photos before saving');
  +   return;
  + }
  
  // In savePhotosToDatabase function
  + if (photos.length < 2) {
  +   toastError('Please take at least 2 photos before saving');
  +   return;
  + }
  ```
- WHY: Ensure consistent photo requirements across all save operations
- IMPACT: Prevents incomplete workshop records and ensures sufficient documentation

### Technical Improvements:

#### Error Handling:
- BEFORE: Allowed saving with any number of photos (even just 1)
- AFTER: Consistent validation across all save operations:
  - Validates minimum photo count before saving
  - Shows clear error messages to guide user actions
  - Matches auto-prompting behavior that already required 2+ photos

#### User Experience:
- BEFORE: Inconsistent requirements between auto-prompt and save operations
- AFTER: Unified experience where:
  - Auto-prompt asks for more photos until 2+ are captured
  - Save buttons enforce the same 2+ photo requirement
  - Clear error messages guide users to take additional photos

#### Data Quality:
- BEFORE: Possible to create workshop records with insufficient photo documentation
- AFTER: Ensures all workshop records have at least 2 photos for proper documentation

### Testing Instructions:

1. Navigate to workshop camera page
2. Take only 1 photo
3. Try to save using either:
   - The "Done" button in the header
   - The "Save & Take More" button in the prompt
4. Verify error message appears: "Please take at least 2 photos before saving"
5. Take a second photo
6. Verify save operations now work successfully

### Related Issues:
- Inconsistent photo requirements between auto-prompt and save operations
- Potential for incomplete workshop documentation with insufficient photos

### Dependencies:
- No new dependencies added
- Uses existing toast notification system for error messages