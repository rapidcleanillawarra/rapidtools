# feat(product-pricing): Add tax-free item support and restructure price groups

This commit enhances the product pricing update functionality by adding tax-free item
support and restructuring price groups for better organization.

## Files Modified:

### 1. `src/routes/update-product-pricing/+page.svelte`
   - **ADDED**: TaxFreeItem field to Product interface
   - **ADDED**: TaxFreeItem to API request fields array
   - **ADDED**: Debug logging for TaxFreeItem transformation with detailed console output
   - **ADDED**: Tax-free checkbox column in data table with proper styling
   - **CHANGED**: "RRP" column header to "List Price" for better clarity
   - **ADDED**: Tax-free property to transformed product object
   - **DIFF**:
     ```diff
     + TaxFreeItem: string;
     ```
     ```diff
     + "TaxFreeItem"
     ```
     ```diff
     + // Debug TaxFreeItem transformation
     + console.log(`🔍 TaxFreeItem debug for ${item.SKU}:`, {
     +   rawValue: item.TaxFreeItem,
     +   type: typeof item.TaxFreeItem,
     +   comparison: item.TaxFreeItem === 'True',
     +   result: item.TaxFreeItem === 'True'
     + });
     ```
     ```diff
     + tax_free: item.TaxFreeItem === 'True'
     ```
     ```diff
     - RRP {getSortIcon('rrp')}
     + List Price {getSortIcon('rrp')}
     ```
     ```diff
     + <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[80px]">
     +   Tax Free
     + </th>
     ```
     ```diff
     + <td class="px-2 py-1 text-sm">
     +   <input
     +     type="checkbox"
     +     bind:checked={product.tax_free}
     +     class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
     +   />
     + </td>
     ```

### 2. `src/routes/update-product-pricing/stores.ts`
   - **ADDED**: TaxFreeItem field to API submission payload
   - **RESTRUCTURED**: Price groups from single "Default Client Group" to dual groups (Group 1: RRP, Group 2: Client Price)
   - **ADDED**: TaxFreeItem to filter request fields array
   - **ADDED**: TaxFreeItem to product transformation logic with boolean conversion
   - **DIFF**:
     ```diff
     + "TaxFreeItem": prod.tax_free || false,
     ```
     ```diff
     - "Group": "Default Client Group",
     + "Group": "1",
     + "Price": prod.rrp.toString()
     + },
     + {
     + "Group": "2",
     ```
     ```diff
     + "TaxFreeItem"
     ```
     ```diff
     + TaxFreeItem?: string;
     ```
     ```diff
     + tax_free: item.TaxFreeItem === 'True'
     ```

## Technical Improvements:
- **BEFORE**: Single price group with client price only
- **AFTER**: Dual price groups (Group 1: RRP, Group 2: Client Price) for better price organization
- **BEFORE**: No tax-free item support
- **AFTER**: Full tax-free item integration with UI controls and API persistence
- **ADDED**: Comprehensive debug logging for tax-free item transformation troubleshooting

## API Changes:
- **MODIFIED**: Product update endpoint now accepts TaxFreeItem field in submission payload
- **MODIFIED**: Product filter endpoint now requests TaxFreeItem field in filter criteria
- **RESTRUCTURED**: PriceGroups structure from single group to dual groups for better price management

## UI/UX Improvements:
- **ADDED**: Tax-free checkbox column with proper Tailwind styling for easy item categorization
- **CHANGED**: "RRP" label to "List Price" for better user understanding
- **ADDED**: Visual feedback for tax-free status with interactive checkbox controls

## Error Handling:
- **ADDED**: Detailed debug logging for TaxFreeItem transformation to identify data type issues
- **IMPROVED**: Type safety with proper boolean conversion from string values
- **ADDED**: Fallback handling for undefined tax-free values

## Testing Instructions:
1. Navigate to `/update-product-pricing`
2. Verify tax-free checkbox column appears in product table
3. Test filtering products with tax-free items
4. Update product pricing and verify tax-free status persists in API calls
5. Check browser console for TaxFreeItem debug logs showing transformation details
6. Verify price groups are properly structured in API submissions

## Breaking Changes:
- None - all changes are additive and backward compatible

## Additional Context:
- **Related issues**: Product pricing management enhancement for tax-free items
- **Dependencies**: No new dependencies required
- **Deployment requirements**: No special deployment steps needed
- **Performance impact**: Minimal - only adds one additional field to API requests