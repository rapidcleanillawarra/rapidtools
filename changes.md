# feat(rebates): Add comprehensive rebate tracking with Supabase integration

This commit transforms the rebates page into a complete rebate management system with company filtering, database integration, and automated calculations.

## Files Modified:

### 1. `src/routes/(protected)/rebates/+page.svelte`

#### **ADDED: Company filter dropdown**
- **Path**: Lines 15-21, 122-133
- **Changes**: Static dropdown with "All Companies", "Diversey", "CleanPlus" options
- **Why**: Enable filtering by rebate company for better organization
- **Impact**: Users can focus on specific company rebates
- **DIFF**:
```diff
+ // Company filter state
+ let selectedCompany = '';
+ const companyOptions = [
+   { value: '', label: 'All Companies' },
+   { value: 'diversey', label: 'Diversey' },
+   { value: 'cleanplus', label: 'CleanPlus' }
+ ];

+ <div class="flex items-center gap-2">
+   <label for="company-select">Company:</label>
+   <select id="company-select" bind:value={selectedCompany}>
+     {#each companyOptions as option}
+       <option value={option.value}>{option.label}</option>
+     {/each}
+   </select>
+ </div>
```

#### **ADDED: Supabase integration for rebate checking**
- **Path**: Lines 3, 25-105
- **Changes**: Integrated Supabase client and rebate table queries
- **Why**: Real-time rebate validation against database
- **Impact**: Automatic rebate detection and calculation for order SKUs
- **DIFF**:
```diff
+ import { supabase } from '$lib/supabase';

+ // Function to check SKUs against rebates table
+ async function checkRebates(orderData: any) {
+   const allSKUs = new Set<string>();
+   orderData.Order?.forEach((order: any) => {
+     order.OrderLine?.forEach((line: any) => {
+       if (line.SKU) allSKUs.add(line.SKU);
+     });
+   });
+   
+   const { data: rebates, error } = await supabase
+     .from('rebates')
+     .select('sku, rebate, company')
+     .in('sku', Array.from(allSKUs));
+ }
```

#### **ADDED: Rebate calculations and totals**
- **Path**: Lines 13-16, 74-97, 278-279, 306-308
- **Changes**: Unit rebate, total rebate per line, grand total calculation
- **Why**: Provide comprehensive financial analysis of rebate opportunities
- **Impact**: Clear visibility of rebate value per SKU and total potential savings
- **DIFF**:
```diff
+ let grandTotalRebate = 0;
+ let ordersWithRebates: string[] = [];

+ // Calculate grand total rebate and collect orders with rebates
+ let totalRebateAmount = 0;
+ orderData.Order?.forEach((order: any) => {
+   order.OrderLine?.forEach((line: any) => {
+     if (rebateLookup[line.SKU]) {
+       const unitRebate = parseFloat(rebateLookup[line.SKU].rebate);
+       const quantity = parseInt(line.Quantity);
+       totalRebateAmount += unitRebate * quantity;
+     }
+   });
+ });

+ <th>Unit Rebate</th>
+ <th>Total Rebate</th>
+ <td>${(parseFloat(rebatesData[line.SKU].rebate) * parseInt(line.Quantity)).toFixed(2)}</td>
```

#### **ADDED: Default date initialization**
- **Path**: Lines 5-9, 181-186
- **Changes**: Auto-populate start date (beginning of month) and end date (today)
- **Why**: Improve user experience with sensible defaults
- **Impact**: Users can immediately run reports without manual date selection
- **DIFF**:
```diff
+ // Date filter state - default to beginning of month and today
+ const today = new Date();
+ const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
+ let startDate = firstOfMonth.toISOString().split('T')[0];
+ let endDate = today.toISOString().split('T')[0];
```

#### **ADDED: Order redirect functionality**
- **Path**: Lines 16, 75-97, 167-178, 392-405
- **Changes**: Button to open control panel with filtered orders containing rebates
- **Why**: Seamless workflow from rebate analysis to order management
- **Impact**: Reduces manual work by auto-filtering relevant orders
- **DIFF**:
```diff
+ // Function to generate and open orders URL
+ function openOrdersWithRebates() {
+   const baseUrl = 'https://www.rapidsupplies.com.au/_cpanel/sales-orders';
+   const orderNumbers = ordersWithRebates.join(',');
+   const url = `${baseUrl}?order_number=in%3A${encodeURIComponent(orderNumbers)}`;
+   window.open(url, '_blank');
+ }

+ <button on:click={openOrdersWithRebates}>
+   View {ordersWithRebates.length} Orders in Control Panel
+ </button>
```

#### **ENHANCED: UI/UX improvements**
- **Path**: Lines 253-268, 270-292, 387-412
- **Changes**: Enhanced table layout, statistics panel, and visual indicators
- **Why**: Better data presentation and user feedback
- **Impact**: Easier identification of rebate opportunities and summary information

## Technical Improvements:

### **Database Integration:**
- **BEFORE**: Static display of order data only
- **AFTER**: Real-time rebate validation against Supabase database
- **Performance**: Batch SKU queries using `IN` clause for optimal performance
- **Security**: Parameterized queries prevent injection attacks

### **Data Processing:**
- **BEFORE**: Manual rebate identification required
- **AFTER**: Automatic rebate detection and calculation
- **Efficiency**: Reduced from manual process to instant analysis

### **User Experience:**
- **BEFORE**: Empty date fields requiring manual input
- **AFTER**: Smart defaults (current month) for immediate usability
- **Workflow**: Direct integration with order management system

## Database Schema:

### **Rebates Table Structure:**
```sql
CREATE TABLE public.rebates (
  sku text not null,
  rebate numeric(12, 8) not null,
  company text not null,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone ('utc'::text, now()),
  constraint rebates_pkey primary key (sku)
) TABLESPACE pg_default;
```

## Endpoints and URLs:

### **External Integration:**
- **Control Panel URL**: `https://www.rapidsupplies.com.au/_cpanel/sales-orders`
- **Query Format**: `?order_number=in%3A{order1}%2C{order2}%2C{order3}`
- **Example**: `?order_number=in%3A25-0010138%2C24-005383`

### **Supabase Queries:**
- **Table**: `rebates`
- **Query**: `SELECT sku, rebate, company FROM rebates WHERE sku IN (...)`
- **Performance**: Optimized batch queries for multiple SKUs

## Testing Instructions:

### **Manual Testing:**
1. **Load page**: Verify default dates are set to current month
2. **Select date range**: Choose custom date range and click Filter
3. **Company filter**: Select "Diversey" or "CleanPlus" from dropdown
4. **Rebate validation**: Verify SKUs with rebates show green badges
5. **Calculations**: Check unit rebate × quantity = total rebate
6. **Order redirect**: Click "View X Orders in Control Panel" button

### **Expected Results:**
- Rebate statistics panel shows coverage percentage
- Only SKUs with rebates display in filtered table
- Grand total matches sum of individual rebate calculations
- Control panel opens with pre-filtered orders containing rebates

### **Database Requirements:**
- Supabase environment variables configured
- `rebates` table populated with test data
- RLS policies configured for read access

## Performance Considerations:

### **Query Optimization:**
- Batch SKU lookups using `IN` clause
- Primary key index on SKU field
- Recommended indexes:
  ```sql
  CREATE INDEX idx_rebates_company ON rebates (company);
  CREATE INDEX idx_rebates_company_sku ON rebates (company, sku);
  ```

### **Memory Usage:**
- Efficient use of Sets for unique SKU collection
- Lookup maps for O(1) rebate access
- Minimal DOM updates through reactive variables

## Error Handling:

### **API Failures:**
- Graceful degradation when Supabase unavailable
- Clear error messages for connection issues
- Fallback to order display without rebate data

### **Data Validation:**
- SKU existence checks before rebate queries
- Numeric validation for rebate calculations
- Empty state handling for no rebate matches

## Breaking Changes:
- **NONE**: All changes are additive and backward compatible

## Dependencies:
- **Added**: `@supabase/supabase-js` (already in project)
- **Environment**: Requires Supabase credentials in environment variables

## Deployment Requirements:
- Ensure Supabase environment variables are configured
- Verify `rebates` table schema matches specification
- Test database connectivity before deployment