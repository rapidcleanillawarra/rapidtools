feat(shipping-zones): Enhance UI and error handling for shipping zones map

This commit improves the user interface and error handling for the shipping zones map, ensuring a better user experience when the map fails to load.

### Files Modified:

#### 1. `src/routes/(protected)/shipping-zones/+page.svelte`
   - ADDED: Error handling for iframe loading failures
   - IMPROVED: UI for the fallback view when the map is unavailable
   - DIFF:
     ```diff
     + function handleIframeError() {
     +   iframeError = true;
     + }
     ```
   - WHY: To provide a seamless experience even when the map cannot be displayed
   - IMPACT: Users now see a friendly message and a link to open the map in a new tab if the iframe fails to load.

### Technical Improvements:
- BEFORE: No fallback UI for iframe errors
- AFTER: Clear error message and alternative action (open in new tab)

### Testing Instructions:
1. Disable JavaScript or block the iframe source URL to simulate an error.
2. Verify the fallback UI appears with the expected message and link.

### Additional Context:
- Related issues: None
- Dependencies: None
- Deployment requirements: None