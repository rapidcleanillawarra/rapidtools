fix(gross-profit-calculator): Correct GST calculations and price group mapping

This commit addresses two critical issues in the Gross Profit Calculator:
1. Incorrect GST handling in Total Ex GST calculations
2. Improper price group ID mapping when sending data to Maropost API

### Files Modified:

#### 1. `src/routes/gross-profit-calculator/services/gpp.service.ts`
   - FIXED: Total Ex GST calculation now correctly removes GST (10%)
   - FIXED: Customer price group ID mapping for Maropost API integration
   - ADDED: Proper retrieval of group ID from customer group mapping
   - ADDED: Detailed logging for API requests and responses
   - MODIFIED: Changed payload structure to match Maropost API requirements
   - DIFF:
     ```diff
     // GST Fix
     + // Calculate unit price excluding GST
     + const unitPriceExGst = unitPriceDiscounted / 1.1;
     
     - totalExGst: parseFloat((quantity * unitPriceDiscounted).toFixed(3)),
     + totalExGst: parseFloat((quantity * unitPriceExGst).toFixed(3)),
     
     // Group ID Fix
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
     ```

#### 2. `src/routes/gross-profit-calculator/+page.svelte`
   - FIXED: Total Ex GST calculation in handleDiscountChange function
   - MODIFIED: Updated to pass orderInfo to saveCustomerPricing method
   - DIFF:
     ```diff
     // GST Fix
     + // Calculate Total Ex GST (remove 10% GST from the discounted price)
     + const unitPriceExGst = unitPriceDiscounted / 1.1;
     + const totalExGst = quantity * unitPriceExGst;
     
     // Group ID Fix
     - await gppService.saveCustomerPricing(orderId, orderLines);
     + await gppService.saveCustomerPricing(orderId, orderLines, orderInfo);
     ```

### Technical Improvements:

#### GST Calculation:
- BEFORE: Total Ex GST incorrectly included GST in the calculation
- AFTER: Total Ex GST correctly divides by 1.1 to remove the 10% GST component
- IMPACT: Accurate financial reporting and pricing calculations

#### Price Group ID Mapping:
- BEFORE: Used hardcoded price group ID "1" for all customers
- AFTER: Dynamically retrieves correct price group ID from customer group mapping
- BEFORE: Sent all order lines in a single API call with nested structure
- AFTER: Sends individual API calls per line with simplified payload structure matching API requirements
- IMPACT: Correct customer-specific pricing in Maropost

#### Logging:
- ADDED: Comprehensive logging for:
  - Group mapping API calls and responses
  - Customer info API calls and responses
  - Maropost API calls and responses
- IMPACT: Improved debugging capabilities and transparency

### Testing Instructions:
1. Enter an order ID and submit to load order details
2. Verify Total Ex GST column shows values that are approximately 9.09% lower than Unit Price Disc. (1/1.1 = 0.9091)
3. Select items and click "Apply Customer Pricing to Maropost"
4. Check browser console for "Using price group ID:" log showing correct customer group ID
5. Confirm successful API responses from Maropost

### Note:
This change maintains backward compatibility by falling back to price group ID "1" if mapping fails, ensuring the system continues to function even with incomplete data. 