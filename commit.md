fix(workshop): Enforce minimum photo requirement in camera workflow

This commit improves the workshop camera functionality by ensuring consistent photo requirements across all save operations.

### Files Modified:

#### 1. `src/routes/(protected)/workshop/camera/+page.svelte`
- ADDED: Validation to enforce minimum of 2 photos before saving
- ADDED: Clear error messages when attempting to save with insufficient photos
- WHY: Ensure consistent photo requirements across all save operations
- IMPACT: Prevents incomplete workshop records and ensures sufficient documentation

### Technical Improvements:
- BEFORE: Allowed saving with any number of photos (even just 1)
- AFTER: Consistent validation across all save operations
- IMPROVED: User feedback with clear error messages
- ENHANCED: Data quality by ensuring sufficient photo documentation

### Testing Instructions:
1. Take only 1 photo and try to save
2. Verify error message appears
3. Take a second photo and verify save works