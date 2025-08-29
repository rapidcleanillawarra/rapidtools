feat(customer-group-invoices): Add order lines export with price comparison

Implements a new feature to export order lines with price comparison between discounted and list prices.

### Files Modified:

#### 1. `src/routes/customer-group-invoices/+page.svelte`
- ADDED: "Get Order Lines" button in the actions toolbar
- ADDED: Order lines export functionality with price comparison
- ADDED: Helper function `fetchRrpMapForSkus` for batched RRP retrieval
- MODIFIED: CSV generation to include price comparison
- DIFF:
  ```diff
  + <button
  +   class="bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700"
  +   on:click={handleGetOrderLines}
  + >
  +   Get Order Lines
  + </button>

  + async function fetchRrpMapForSkus(skus: string[]): Promise<Map<string, number>> {
  +   // Implementation for batched RRP retrieval
  + }
  ```

### Technical Improvements:

#### API Integration
- BEFORE: No order lines export functionality
- AFTER: Comprehensive export with price comparison and filtering
- IMPROVED: Batched API calls to handle large datasets efficiently

#### Data Processing
- BEFORE: N/A
- AFTER: 
  - Efficient SKU deduplication
  - Price comparison logic
  - Automatic filtering of non-discounted items

#### CSV Generation
- Format: SKU, Discounted Price, List Price
- Filtering: Excludes items where discounted price ≥ list price
- Sorting: Alphabetical by SKU with header preserved

### API Endpoints Used:
1. Get Order Lines:
   ```json
   {
     "Filter": {
       "OrderID": ["array_of_order_ids"],
       "OutputSelector": ["OrderLine", "OrderLine.UnitPrice"]
     },
     "action": "GetOrder"
   }
   ```

2. Get RRP (List Price):
   ```json
   {
     "Filter": {
       "SKU": ["array_of_skus"],
       "OutputSelector": ["RRP"]
     },
     "action": "GetItem"
   }
   ```

### Error Handling:
- Added validation for empty order sets
- Graceful handling of missing RRP values
- Proper error messaging for API failures

### Testing Instructions:
1. Navigate to Customer Group Invoices page
2. Apply filters to get a set of invoices
3. Click "Get Order Lines" button
4. Verify CSV contains:
   - Only SKUs with actual discounts
   - Correct price comparison
   - Proper header row

### Performance Considerations:
- Implemented SKU batching (80 per request) to prevent payload size issues
- Optimized data structures for price comparison
- Efficient CSV generation with minimal memory footprint

### Security:
- No sensitive data exposed in exports
- Uses existing API endpoints with proper authentication
- Input validation on all user-provided data

### Dependencies:
- Requires existing API endpoints for order and item data
- Uses browser's native CSV download capabilities