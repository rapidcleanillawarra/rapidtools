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

fix(calculator): Update GST calculation consistency across components

This commit fixes the GST calculation in the Gross Profit Calculator to ensure consistent handling of GST exclusion both during initial load and user interactions.

### Files Modified:

#### 1. `src/routes/gross-profit-calculator/services/gpp.service.ts`
- FIXED: GST calculation in totalExGst to properly exclude 10% GST
- UPDATED: Decimal precision to match display requirements
- DIFF:
  ```diff
  - totalExGst: parseFloat((quantity * unitPriceDiscounted).toFixed(3)),
  + totalExGst: parseFloat(((quantity * unitPriceDiscounted) / 1.10).toFixed(2)),
  ```

#### 2. `src/routes/gross-profit-calculator/+page.svelte`
- FIXED: GST calculation in handleDiscountChange event handler
- UPDATED: Comment clarity for GST exclusion
- DIFF:
  ```diff
  - // Calculate Total Ex GST (same as Unit Price Disc. * quantity)
  - const totalExGst = quantity * unitPriceDiscounted;
  + // Calculate Total Ex GST (excluding 10% GST)
  + const totalExGst = (quantity * unitPriceDiscounted) / 1.10;
  ```

### Technical Improvements:
- BEFORE: Inconsistent GST handling between initial load and user interactions
- AFTER: Consistent GST exclusion across all calculations
- PRECISION: Standardized to 2 decimal places for monetary values

### Testing Instructions:
1. Load the Gross Profit Calculator with an order
2. Verify initial totalExGst values exclude GST
3. Modify discount percentages and confirm:
   - totalExGst updates correctly
   - Values match between initial load and after changes
   - All monetary values show 2 decimal places

### Impact:
- Ensures accurate GST-exclusive pricing throughout the application
- Maintains consistency between static and dynamic calculations
- Improves clarity of GST handling in the codebase

### No Breaking Changes