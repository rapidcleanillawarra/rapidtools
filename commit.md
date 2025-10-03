fix(catalogue): implement session hierarchy reconstruction

This commit fixes the issue where dynamic hierarchy was not getting loaded when opening saved catalogue sessions.

### Files Modified:

#### 1. `src/routes/(protected)/catalogue/+page.svelte`
- ADDED: Complete hierarchy reconstruction logic in loadCatalogueSession()
- ADDED: Logic to reconstruct level1, level2, and level3 containers from saved productRanges data
- ADDED: Product grouping into level3 containers with max 10 items per container
- ADDED: SKU list filtering to exclude items already in loaded catalogue
- ADDED: Proper ID generation using nextId counter
- ADDED: Fallback to default hierarchy structure when no catalogue data exists
- WHY: Sessions were loading SKU data but hierarchy remained empty/default
- IMPACT: Users can now properly load and continue working on saved catalogue sessions

### Technical Improvements:
- BEFORE: Sessions loaded SKU data but hierarchy remained empty/default, causing confusion
- AFTER: Complete catalogue structure is restored from saved session data
- IMPROVED: SKU list management prevents duplicates between available and catalogue lists
- ENHANCED: Data integrity during session load/save cycles
- MAINTAINED: Proper drag and drop functionality with loaded session data

### Bug Fix Details:
- Resolves issue where dynamic hierarchy was not getting loaded when opening sessions
- SKUs now properly distributed between available list and catalogue containers
- Session load now fully restores the catalogue building state
- Prevents SKUs from appearing in both available list and catalogue containers

### Testing Instructions:
1. Create a catalogue with multiple ranges and categories
2. Add SKUs to different categories
3. Save the catalogue session
4. Refresh the page or load a different session
5. Load the original session and verify hierarchy structure is restored
6. Verify SKU list only shows items not already in catalogue
7. Test drag and drop functionality works with loaded session data