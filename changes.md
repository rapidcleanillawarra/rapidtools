# fix(pricing): Remove 10% GST inclusion from price calculations

This commit removes the automatic 10% GST inclusion from client price and list price calculations, making all displayed prices GST-exclusive.

## Files Modified:

### 1. `src/routes/update-product-pricing/stores.ts`
- **FIXED**: Removed 10% GST multiplier from price calculations
- **CHANGED**: Client price calculation from `purchasePrice * clientMup * 1.1` to `purchasePrice * clientMup`
- **CHANGED**: RRP/List price calculation from `purchasePrice * retailMup * 1.1` to `purchasePrice * retailMup`
- **CHANGED**: Client MUP calculation from `clientPrice / (purchasePrice * 1.1)` to `clientPrice / purchasePrice`
- **CHANGED**: Retail MUP calculation from `rrp / (purchasePrice * 1.1)` to `rrp / purchasePrice`

**Why**: The previous implementation automatically included 10% GST in all price calculations, which was incorrect for pricing management where GST-exclusive amounts are required.

**Impact**: All displayed prices will now be GST-exclusive, resulting in approximately 10% lower displayed values but correct pre-GST pricing for business calculations.

**DIFF**:
```diff
@@ -63,22 +63,22 @@ export function calculatePrices(product: any, source: 'mup' | 'price' = 'mup') {
     const retailMup = parseFloat(product.retail_mup?.toString() || '0');

     if (purchasePrice && clientMup) {
-      product.client_price = parseFloat((purchasePrice * clientMup * 1.1).toFixed(2));      
+      product.client_price = parseFloat((purchasePrice * clientMup).toFixed(2));
     }

     if (purchasePrice && retailMup) {
-      product.rrp = parseFloat((purchasePrice * retailMup * 1.1).toFixed(2));
+      product.rrp = parseFloat((purchasePrice * retailMup).toFixed(2));
     }
   } else {
     const clientPrice = parseFloat(product.client_price?.toString() || '0');
     const rrp = parseFloat(product.rrp?.toString() || '0');

     if (purchasePrice && clientPrice) {
-      product.client_mup = parseFloat((clientPrice / (purchasePrice * 1.1)).toFixed(2));    
+      product.client_mup = parseFloat((clientPrice / purchasePrice).toFixed(2));
     }

     if (purchasePrice && rrp) {
-      product.retail_mup = parseFloat((rrp / (purchasePrice * 1.1)).toFixed(2));
+      product.retail_mup = parseFloat((rrp / purchasePrice).toFixed(2));
     }
   }
```

## Technical Improvements:

### Before/After Comparisons:
- **BEFORE**: Prices included 10% GST automatically (e.g., $100 purchase price × 2.0 MUP × 1.1 = $220)
- **AFTER**: Prices are GST-exclusive (e.g., $100 purchase price × 2.0 MUP = $200)

### Calculation Changes:
1. **Client Price**: Now calculated as `Purchase Price × Client MUP` (GST-exclusive)
2. **List Price (RRP)**: Now calculated as `Purchase Price × Retail MUP` (GST-exclusive)
3. **Client MUP**: Now calculated as `Client Price ÷ Purchase Price` (without GST factor)
4. **Retail MUP**: Now calculated as `RRP ÷ Purchase Price` (without GST factor)

### Security Considerations:
- No security implications - this is a business logic change only
- All existing data validation and error handling remains intact

### Performance Impacts:
- **POSITIVE**: Slightly improved performance due to removal of multiplication operations
- **NEUTRAL**: No impact on API calls or data processing

## Breaking Changes:
- **YES**: All displayed prices will be approximately 10% lower than before
- **MIGRATION**: Existing MUP values may need adjustment if they were calculated with GST inclusion
- **NOTIFICATION**: Users should be informed that displayed prices are now GST-exclusive

## Testing Instructions:

### Manual Testing:
1. Navigate to `/update-product-pricing`
2. Enter a purchase price and MUP values
3. Verify that calculated prices are GST-exclusive
4. Test both MUP-to-price and price-to-MUP calculations

### Test Cases:
- **Test Case 1**: Purchase Price $100, Client MUP 2.0 → Expected Client Price $200 (not $220)
- **Test Case 2**: Purchase Price $50, Retail MUP 3.0 → Expected RRP $150 (not $165)
- **Test Case 3**: Client Price $200, Purchase Price $100 → Expected Client MUP 2.0 (not 1.82)

### URLs for Testing:
- **Production**: `https://rapidtools.netlify.app/update-product-pricing`
- **Development**: `http://localhost:5173/update-product-pricing`

## Error Handling:
- All existing error handling for invalid numbers and edge cases remains unchanged
- Price calculations will still handle null/undefined values gracefully
- MUP calculations will still prevent division by zero

## Related Issues:
- Addresses pricing accuracy requirements for GST-exclusive calculations
- Ensures consistency with Australian tax requirements

## Dependencies:
- No new dependencies added
- No changes to existing package.json requirements

## Deployment Requirements:
- No special deployment requirements
- Changes are purely client-side business logic
- Can be deployed immediately without database migrations