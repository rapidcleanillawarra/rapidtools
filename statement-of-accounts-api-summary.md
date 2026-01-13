# Statement of Accounts - Orders API Data Pull Summary

## Overview
The Statement of Accounts feature fetches order data from a Power Automate API endpoint, processes it to calculate outstanding balances, and aggregates the data by customer to generate account statements.

---

## API Endpoint Configuration

### Endpoint Details
- **Base URL**: `https://default61576f99244849ec8803974b47673f.57.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ef89e5969a8f45778307f167f435253c/triggers/manual/paths/invoke`
- **Query Parameters**: `api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pPhk80gODQOi843ixLjZtPPWqTeXIbIt9ifWZP6CJfY`
- **HTTP Method**: `POST`
- **Content-Type**: `application/json`

### Location in Codebase
File: `src/routes/(protected)/statement-of-accounts/statementAccountsApi.ts`
Function: `fetchOrders()`

---

## API Request Structure

### Request Body
The API expects a JSON payload with the following structure:

```json
{
  "Filter": {
    "OrderStatus": ["Dispatched"],
    "PaymentStatus": ["Pending", "PartialPaid"],
    "OutputSelector": [
      "ID",
      "Username",
      "DatePaymentDue",
      "OrderPayment",
      "GrandTotal",
      "DatePlaced",
      "BillAddress",
      "Email"
    ]
  },
  "action": "GetOrder"
}
```

### Filter Criteria
1. **OrderStatus**: Only fetches orders with status `["Dispatched"]`
2. **PaymentStatus**: Only includes orders with payment status `["Pending", "PartialPaid"]` (i.e., orders that are not fully paid)
3. **OutputSelector**: Specifies which fields to return in the response

### Request Implementation
```typescript
const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        Filter: {
            OrderStatus: ['Dispatched'],
            PaymentStatus: ['Pending', 'PartialPaid'],
            OutputSelector: [
                'ID',
                'Username',
                'DatePaymentDue',
                'OrderPayment',
                'GrandTotal',
                'DatePlaced',
                'BillAddress',
                'Email'
            ]
        },
        action: 'GetOrder'
    })
});
```

---

## API Response Structure

### Response Format
The API returns a JSON object with an `Order` property containing an array of order objects:

```typescript
{
  Order: Order[]
}
```

### Order Interface
Each order object has the following structure (defined in `statementAccounts.ts`):

```typescript
interface Order {
  ID: string;                    // Order ID
  DatePaymentDue: string;        // Payment due date
  BillLastName: string;          // Billing last name
  BillStreetLine1: string;       // Billing street address
  BillState: string;             // Billing state
  BillCountry: string;           // Billing country
  BillPostCode: string;          // Billing postcode
  OrderID: string;               // Order identifier
  OrderPayment: OrderPayment[];  // Array of payment records
  DatePlaced: string;            // Order placement date
  GrandTotal: string;            // Total order amount (as string)
  Username: string;              // Customer username
  BillCity: string;              // Billing city
  BillCompany: string;           // Billing company name (may be empty)
  BillFirstName: string;         // Billing first name
  BillPhone?: string;            // Optional billing phone
  Email?: string;                // Optional customer email
}

interface OrderPayment {
  Amount: string;    // Payment amount (as string)
  Id: string;        // Payment ID
  DatePaid: string;  // Date payment was made
}
```

### Response Handling
```typescript
const data = await response.json();

if (data && data.Order) {
    return data.Order;  // Returns array of Order objects
}

return [];  // Returns empty array if no orders found
```

---

## Data Processing Flow

### 1. Fetch Orders
- Function: `fetchOrders()` in `statementAccountsApi.ts`
- Called from: `loadStatementAccounts()` in `+page.svelte` (line 188)
- Returns: `Promise<Order[]>`

### 2. Calculate Outstanding Amount
- Function: `calculateOutstandingAmount(order: Order)` in `statementAccounts.ts`
- Logic:
  - Starts with `GrandTotal` (converted to number)
  - Subtracts all payment amounts from `OrderPayment` array
  - Returns the remaining outstanding balance

```typescript
function calculateOutstandingAmount(order: Order): number {
    let outstandingAmount = parseFloat(order.GrandTotal);
    if (order.OrderPayment && order.OrderPayment.length > 0) {
        order.OrderPayment.forEach((payment) => {
            outstandingAmount -= parseFloat(payment.Amount);
        });
    }
    return outstandingAmount;
}
```

### 3. Get Customer Name
- Function: `getCustomerName(order: Order)` in `statementAccounts.ts`
- Logic:
  - Uses `BillCompany` if available
  - Otherwise, concatenates `BillFirstName` and `BillLastName`

```typescript
function getCustomerName(order: Order): string {
    return order.BillCompany || `${order.BillFirstName} ${order.BillLastName}`;
}
```

### 4. Aggregate by Customer
- Function: `aggregateByCustomer(orders: Order[])` in `statementAccounts.ts`
- Purpose: Groups orders by customer and calculates totals
- Process:
  1. Creates a Map keyed by customer name
  2. For each order:
     - Calculates outstanding amount
     - **Filters out orders with outstanding amount ≤ 0.01** (essentially paid off)
     - Gets customer name
     - Increments invoice count and adds to grand total
  3. Converts Map to array of `StatementAccount` objects

### 5. Result Structure
After aggregation, the data is transformed into `StatementAccount` objects:

```typescript
interface StatementAccount {
  customer: string;              // Customer name (BillCompany or First + Last)
  username: string;              // Customer username
  totalInvoices: number;         // Count of outstanding invoices
  grandTotal: number;            // Sum of all outstanding amounts (rounded to 2 decimals)
  lastSent: string | null;       // Last time statement was sent (from Supabase)
  lastCheck: string | null;      // Last time account was checked (from Supabase)
  lastFileGeneration: string | null;  // Last PDF generation time (from Supabase)
  oneDriveId: string | null;     // OneDrive file ID (from Supabase)
}
```

---

## Error Handling

### Fetch Errors
- If `response.ok` is false, throws: `new Error('Failed to fetch orders')`
- Catches and re-throws exceptions with console logging
- Error is caught in `loadStatementAccounts()` and displayed to user

### Data Validation
- Checks if `data.Order` exists before returning
- Returns empty array `[]` if no orders found
- Handles cases where `OrderPayment` array is missing or empty

---

## Integration Points

### Component Flow
1. **Page Load**: `onMount()` calls `loadStatementAccounts()` (line 380)
2. **Fetch Data**: `loadStatementAccounts()` calls `fetchOrders()` (line 188)
3. **Store Raw Data**: Raw orders stored in `rawOrders` variable (line 189)
4. **Aggregate Data**: Calls `aggregateByCustomer(orders)` (line 190)
5. **Update State**: Sets `statementAccounts` with aggregated data (line 191)
6. **Enrich with Status**: Calls `check_soa_status()` to fetch Supabase status data (line 194)

### Data Usage
- **Display**: Aggregated `StatementAccount[]` displayed in table
- **Printing**: Raw `Order[]` used for generating print statements (`rawOrders` variable)
- **Document Generation**: Raw orders filtered by customer name for PDF generation

---

## Key Business Rules

1. **Order Filtering**:
   - Only `Dispatched` orders are included
   - Only orders with `Pending` or `PartialPaid` payment status
   - Orders with outstanding balance ≤ $0.01 are excluded from aggregation

2. **Customer Identification**:
   - Primary: `BillCompany` field
   - Fallback: `BillFirstName + BillLastName`
   - Username from `Username` field (used for Supabase synchronization)

3. **Outstanding Balance Calculation**:
   - `Outstanding Amount = GrandTotal - Sum(All Payment Amounts)`
   - All monetary values parsed as floats
   - Final totals rounded to 2 decimal places

4. **Data Aggregation**:
   - Multiple orders per customer are combined
   - `totalInvoices`: Count of orders with outstanding balance > $0.01
   - `grandTotal`: Sum of all outstanding amounts per customer

---

## Additional Notes

- The raw orders are preserved separately (`rawOrders`) for detailed invoice listing in print/PDF generation
- The API uses Power Automate workflow endpoints with signature-based authentication
- Payment data is stored as an array, allowing multiple payments per order
- All date fields are returned as strings (ISO format expected)
- Monetary values are strings in the API response and converted to numbers during processing
