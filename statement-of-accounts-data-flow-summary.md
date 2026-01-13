# Statement of Accounts - Data Pulling and Database Saving Summary

## Overview
This document summarizes how order data is pulled from the Orders API and saved to the `statement_of_accounts` table in Supabase.

---

## Part 1: Pulling Data from Orders API

### API Endpoint
- **URL**: Power Automate API endpoint (Power Platform)
- **Method**: `POST`
- **Location**: `src/routes/(protected)/statement-of-accounts/statementAccountsApi.ts`
- **Function**: `fetchOrders()`

### API Request

#### Request Body
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

#### Filter Criteria
- **OrderStatus**: Only `["Dispatched"]` orders
- **PaymentStatus**: Only `["Pending", "PartialPaid"]` (orders not fully paid)
- **OutputSelector**: Specifies which fields to retrieve

### API Response
Returns an array of `Order` objects:
```typescript
{
  Order: Order[]
}
```

Each `Order` object contains:
- `ID`, `OrderID`, `Username`
- `GrandTotal`, `OrderPayment[]` (array of payments)
- `DatePlaced`, `DatePaymentDue`
- `BillCompany`, `BillFirstName`, `BillLastName`
- `BillStreetLine1`, `BillCity`, `BillState`, `BillPostCode`, `BillCountry`
- `Email`, `BillPhone` (optional)

---

## Part 2: Data Processing and Transformation

### Processing Flow

#### Step 1: Fetch Orders
- Function: `fetchOrders()` in `statementAccountsApi.ts`
- Called from: `loadStatementAccounts()` in `+page.svelte` (line 188)
- Returns: `Promise<Order[]>`
- Stores raw orders in `rawOrders` variable for later use (printing, PDF generation)

#### Step 2: Calculate Outstanding Amount
- Function: `calculateOutstandingAmount(order: Order)` in `statementAccounts.ts`
- Logic:
  ```
  Outstanding Amount = GrandTotal - Sum(All Payment Amounts)
  ```
- Converts string values to floats for calculation
- Returns the remaining balance

#### Step 3: Get Customer Name
- Function: `getCustomerName(order: Order)` in `statementAccounts.ts`
- Logic:
  - Uses `BillCompany` if available
  - Otherwise: `BillFirstName + " " + BillLastName`

#### Step 4: Aggregate by Customer
- Function: `aggregateByCustomer(orders: Order[])` in `statementAccounts.ts`
- Purpose: Groups orders by customer and calculates totals

**Process:**
1. Creates a `Map<string, {...}>` keyed by customer name
2. For each order:
   - Calculates outstanding amount
   - **Filters out orders with outstanding amount ≤ $0.01** (considered paid off)
   - Gets customer name
   - If customer not in map: creates entry with `{ totalInvoices: 0, grandTotal: 0, username }`
   - Increments `totalInvoices` by 1
   - Adds outstanding amount to `grandTotal`
3. Converts Map to array of `StatementAccount` objects

**Result Structure:**
```typescript
interface StatementAccount {
  customer: string;              // Customer name (BillCompany or First + Last)
  username: string;              // Customer username (from Username field)
  totalInvoices: number;         // Count of orders with outstanding > $0.01
  grandTotal: number;            // Sum of outstanding amounts (rounded to 2 decimals)
  lastSent: string | null;       // Populated from Supabase
  lastCheck: string | null;      // Populated from Supabase
  lastFileGeneration: string | null;  // Populated from Supabase
  oneDriveId: string | null;     // Populated from Supabase
}
```

**Key Business Rules:**
- Orders with outstanding balance ≤ $0.01 are excluded
- Multiple orders per customer are combined
- `grandTotal` is rounded to 2 decimal places
- Uses `username` (from `Username` field) as the unique identifier for database operations

---

## Part 3: Saving to statement_of_accounts Table

### Save Function
- **Location**: `src/routes/(protected)/statement-of-accounts/+page.svelte`
- **Function**: `saveToSupabase()` (lines 28-104)
- **Trigger**: User clicks "Save to Supabase" button (line 405)
- **Table**: `statement_of_accounts` in Supabase

### Save Process Overview

The save process implements a **synchronization pattern** that:
1. Fetches all existing records from the database
2. Compares with current API data
3. Updates existing records
4. Inserts new records
5. Updates the `exists_in_statements_list` flag based on current API data

### Detailed Save Flow

#### Step 1: Extract Current Usernames from API Data
```typescript
const currentApiUsernames = new Set(statementAccounts.map((a) => a.username));
```
- Creates a Set of usernames from the currently loaded aggregated accounts
- Used to determine if a database record "exists in statements list"

#### Step 2: Fetch All Existing Database Records
```typescript
const { data: allDbRecords, error: fetchError } = await supabase
    .from('statement_of_accounts')
    .select('id, customer_username');
```
- Fetches ALL records from `statement_of_accounts` table
- Only selects `id` and `customer_username` fields
- Used for comparison and synchronization

#### Step 3: Process Existing Database Records (Updates)
For each existing database record:
```typescript
updates.push({
    id: record.id,
    customer_username: record.customer_username,
    exists_in_statements_list: currentApiUsernames.has(record.customer_username),
    last_check: timestamp
});
```

**Logic:**
- Updates `exists_in_statements_list` to `true` if username exists in current API data, `false` otherwise
- Updates `last_check` timestamp to current time
- Tracks processed usernames to avoid duplicates

#### Step 4: Process New API Records (Inserts)
For each account in `statementAccounts` that doesn't exist in the database:
```typescript
if (!processedUsernames.has(account.username)) {
    inserts.push({
        customer_username: account.username,
        exists_in_statements_list: true,
        last_check: timestamp
    });
}
```

**Logic:**
- Only inserts records where `username` is not in `processedUsernames` Set
- Sets `exists_in_statements_list: true` (since it's in current API data)
- Sets `last_check` to current timestamp

#### Step 5: Execute Database Operations
```typescript
// Updates: Uses upsert (update or insert based on id)
if (updates.length > 0) {
    promises.push(supabase.from('statement_of_accounts').upsert(updates));
}

// Inserts: Uses insert for new records
if (inserts.length > 0) {
    promises.push(supabase.from('statement_of_accounts').insert(inserts));
}

// Execute in parallel
const results = await Promise.all(promises);
```

**Operations:**
- **Updates**: Uses `upsert()` - updates existing records based on `id`
- **Inserts**: Uses `insert()` - adds new records
- Executes both operations in parallel using `Promise.all()`

### Database Table Structure (Inferred)

Based on the save operations, the `statement_of_accounts` table has at least:

```typescript
{
  id: number | string;                    // Primary key
  customer_username: string;              // Unique identifier (from Username field)
  exists_in_statements_list: boolean;     // Whether customer appears in current API data
  last_check: string;                     // ISO timestamp of last synchronization
  last_sent?: string | null;              // When statement was last sent
  last_file_generation?: string | null;   // When PDF was last generated
  statement_of_accounts_pdf_files_id?: number | null;  // Foreign key to PDF files table
}
```

**Note**: The table also has a relationship with `statement_of_accounts_pdf_files` table (see `check_soa_status` function for usage).

### Key Features of Save Process

1. **Synchronization Pattern**:
   - Compares entire database state with current API state
   - Updates `exists_in_statements_list` flag to reflect current status

2. **Idempotent Operations**:
   - Uses `upsert` for updates (safe to run multiple times)
   - Checks for existing records before inserting

3. **Timestamp Tracking**:
   - Updates `last_check` on every save operation
   - Tracks when data was last synchronized

4. **Data Minimalism**:
   - Only saves `customer_username`, `exists_in_statements_list`, and `last_check`
   - Does NOT save aggregated data like `totalInvoices` or `grandTotal`
   - Aggregated data is calculated on-the-fly from API data

5. **Error Handling**:
   - Catches and logs errors
   - Shows user-friendly toast messages
   - Sets `isSaving` flag to prevent concurrent saves

---

## Complete Data Flow Summary

```
1. User loads page
   ↓
2. loadStatementAccounts() called
   ↓
3. fetchOrders() → API call to Power Automate
   ↓
4. API returns Order[] array
   ↓
5. aggregateByCustomer(orders) → transforms Order[] to StatementAccount[]
   ↓
6. check_soa_status() → enriches with Supabase data (last_sent, last_check, etc.)
   ↓
7. statementAccounts displayed in UI
   ↓
8. User clicks "Save to Supabase"
   ↓
9. saveToSupabase() called
   ↓
10. Fetches all existing records from statement_of_accounts table
   ↓
11. Compares with current statementAccounts
   ↓
12. Creates updates[] and inserts[] arrays
   ↓
13. Executes upsert() for updates and insert() for new records
   ↓
14. Database synchronized with current API state
```

---

## Important Notes

1. **Data Separation**:
   - **API Data** (`statementAccounts`): Aggregated totals, invoice counts, customer names (calculated on-the-fly)
   - **Database Data** (`statement_of_accounts` table): Metadata only (username, existence flag, timestamps)
   - Aggregated financial data is NOT stored in the database; it's always calculated from API data

2. **Username as Key**:
   - `customer_username` (from `Username` field) is the unique identifier
   - Used for matching API data with database records
   - Multiple orders can have the same username (same customer)

3. **exists_in_statements_list Flag**:
   - `true`: Customer appears in current API fetch (has outstanding invoices)
   - `false`: Customer exists in database but no longer has outstanding invoices
   - Allows tracking of customers who previously had outstanding invoices but have since paid

4. **Manual Save**:
   - Saving to database is a **manual action** (user clicks button)
   - Data is loaded automatically on page load
   - Save operation is optional - the page works without saving to database

5. **Raw Orders Preservation**:
   - `rawOrders` variable stores the original `Order[]` array
   - Used for detailed invoice listing in print/PDF generation
   - Not stored in database
