fix(gross-profit-calculator): Fix price group ID mapping for Maropost API integration

This commit addresses an issue where customer price group IDs were not correctly mapped when sending data to the Maropost API, resulting in incorrect pricing assignments.

### Files Modified:

#### 1. `src/routes/gross-profit-calculator/services/gpp.service.ts`
   - FIXED: Customer price group ID mapping for Maropost API
   - ADDED: Proper retrieval of group ID from customer group mapping
   - ADDED: Detailed logging for API requests and responses
   - MODIFIED: Changed payload structure to match Maropost API requirements
   - DIFF:
     ```diff
     - const payload = {
     -   order_id: orderId,
     -   lines: orderLines
     -     .filter(line => line.saveDiscount)
     -     .map(line => ({
     -       sku: line.sku,
     -       discount: line.percentDiscount
     -     }))
     - };
     + // Get the customer's group ID
     + let priceGroupId = "1"; // Default as fallback
     + 
     + if (orderInfo) {
     +   // Fetch group mappings to get the correct group ID
     +   const mappings = await this.fetchGroupMappings();
     +   
     +   // Find the mapping for the customer's group
     +   const customerMapping = mappings.find(item => item.Group === orderInfo.customerGroup);
     +   
     +   // Use the customer's group ID if found
     +   if (customerMapping && customerMapping.GroupID) {
     +     priceGroupId = customerMapping.GroupID;
     +   }
     + }
     + 
     + // For each selected line, make a separate API call
     + for (const line of selectedLines) {
     +   const payload = {
     +     sku: line.sku,
     +     price_group_id: priceGroupId,
     +     price: line.unitPriceDiscounted
     +   };
     ```

#### 2. `src/routes/gross-profit-calculator/+page.svelte`
   - MODIFIED: Updated `handleApplyPricing` function to pass `orderInfo` to `saveCustomerPricing` method
   - DIFF:
     ```diff
     - await gppService.saveCustomerPricing(orderId, orderLines);
     + await gppService.saveCustomerPricing(orderId, orderLines, orderInfo);
     ```

### Technical Improvements:
- BEFORE: Used hardcoded price group ID "1" for all customers
- AFTER: Dynamically retrieves correct price group ID from customer group mapping
- BEFORE: Sent all order lines in a single API call with nested structure
- AFTER: Sends individual API calls per line with simplified payload structure matching API requirements
- ADDED: Comprehensive logging for:
  - Group mapping API calls and responses
  - Customer info API calls and responses
  - Maropost API calls and responses

### Testing Instructions:
1. Enter an order ID and submit to load order details
2. Check browser console for "Group Mapping API Response" and "Customer Info API Response"
3. Select items and click "Apply Customer Pricing to Maropost"
4. Verify in console logs that the correct price_group_id is being used
5. Confirm successful API responses from Maropost

### Note:
This change maintains backward compatibility by falling back to price group ID "1" if mapping fails, ensuring the system continues to function even with incomplete data. 