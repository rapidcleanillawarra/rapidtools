# Orders Past Due Accounts Module Documentation

## Overview
This directory (`src/routes/(protected)/orders-past-due-accounts`) contains the implementation for the "Past Due Accounts" feature (Dashboards > Past Due Accounts). This feature allows users to view, filter, and manage sales orders that are past their payment due date. It integrates with external Power Automate APIs for order data and email conversations, and Supabase for storing per-invoice notes, note views, and invoice tracking status.

## Architecture & File Structure

- **`+page.svelte`**: The main entry point and view controller. Handles data fetching (API & Supabase), state management (filtering, sorting, pagination), and rendering the main table.
- **`pastDueAccounts.ts`**: Shared TypeScript interfaces, constants (column definitions), and helper functions (date parsing, color coding, email/note summaries).
- **`components/`**:
    - **`ColumnVisibilityPills.svelte`**: UI for toggling table column visibility.
    - **`PastDueLegend.svelte`**: Static legend component explaining the color coding for past due days.
    - **`PastDueToolbar.svelte`**: Control bar containing the "PD Counter" filter inputs and action buttons (Apply, Export, Print, Check Completed).
    - **`EmailModal.svelte`**: Modal for viewing email conversations associated with an order.

## Data Flow & Integration

### 1. Fetching Orders (Primary Data)
- **Source**: Power Automate API (HTTPS POST).
- **Trigger**: `fetchOrders()` on `onMount` (or via "Check Completed" button).
- **Logic**:
    - Fetches raw orders (`Dispatched`, `Backorder Approved` states).
    - Calculates `outstandingAmount` (`GrandTotal - sum(OrderPayment)`).
    - Filters out orders with `<= 0.01` outstanding (unless they are being tracked as completed).
    - Calculates "PD Counter" (Days Past Due relative to `now`).
    - **Invoice Tracking Upsert**: Logic exists to track every fetched order in Supabase (`orders_past_due_accounts_invoice_tracking`).
    - **Completion Tracking**: If an order exists in Supabase tracking but ceases to exist in the API response, it is marked as `completed: true`.

### 2. Invoice Tracking & Email Initialization
- **Table**: `orders_past_due_accounts_invoice_tracking`
- **Purpose**: Tracks lifecycle of past due invoices and their email notification status.
- **Logic**:
    - Invoice tracking records are always synchronized when orders are fetched.
    - `fetchEmailTrackingStatus()`: Updates the local state to show if email notifications have been initialized for each order.

### 3. Email Conversations
- **Source**: Different Power Automate API.
- **Trigger**: `fetchEmailConversations()` called after `fetchOrders` if there are orders.
- **Payload**: Sends list of `order_ids` to the API.
- **Display**: Shows "Email Convo" column with preview of latest email and inbound/outbound counts.
- **Data Model**: `EmailConversation` interface (from, body_preview, web_link, has_value).

### 4. Notes System (Enhanced)
- **Tables**:
    - `orders_past_due_accounts_order_notes`: Stores the actual note content.
    - `orders_past_due_accounts_order_note_views`: Tracks which user (`user_email`) viewed which note (`note_id`).
- **Logic**:
    - **Fetching**: `fetchNotesAndViews()` fetches both notes and view records in parallel logic.
    - **Read Receipt**: `getUnreadNotesCount` helper calculates unread notes for the current user.
    - **Auto-read**: When opening notes modal, `markNotesAsViewed` inserts records into `note_views` table.
    - **Creation**: `saveNote` inserts note and immediately marks it as viewed by creator.

## Key Features

### Filtering, Sorting & Pagination
- **Search**: Per-column text search (including searching note content/creator).
- **PD Counter Filter**: Numeric filter (`>`, `<`, `=`) for days past due.
- **Advanced Sorting**: Custom sorters for Numbers, Strings, Dates (`parseDate`), and Currency.
- **Pagination**: Client-side pagination logic (`itemsPerPage`, `currentPage`).

### Persistence
`localStorage` is used deeply to persist user preferences:
- Filter settings (`orders-pd-filter-operator`, `value`)
- UI State (`orders-column-visibility`, `orders-show-legend`, `orders-show-column-visibility`)
- Pagination (`orders-current-page`, `orders-items-per-page`)

### Visual Indicators
- **PD Counter**: Color-coded text and background based on severity (15-25d blue, 26-40d yellow, 41-59d orange, 60+d red).
- **Email Status**: Green text for outbound (from rapidclean), Blue for inbound.

### Export & Print
- **CSV**: Browser-side generation, handles comma escaping and currency formatting.
- **Print**: Opens raw HTML window with printer-friendly styling and auto-triggers print dialog.

## Database Schema (Supabase)

### `orders_past_due_accounts_invoice_tracking`
- `order_id` (PK): Invoice ID.
- `completed` (bool): If the order is no longer past due/active.
- `email_initialized` (bool): If email flow has started.
- `updated_at` (timestamptz).

### `orders_past_due_accounts_order_notes`
- `id` (UUID, PK)
- `order_id` (String): Link to Invoice ID.
- `note` (Text)
- `created_by` (Email)
- `creator_full_name` (Text)
- `created_at` (timestamptz)
- `deleted_at` (timestamptz, nullable)

### `orders_past_due_accounts_order_note_views`
- `note_id` (UUID, FK)
- `user_email` (String)
- `viewed_at` (timestamptz)

## Type Definitions (`pastDueAccounts.ts`)

```typescript
export interface ProcessedOrder {
    customer: string;
    invoice: string;
    pdCounter: number;  // Days past due
    amount: string;     // Outstanding amount ($)
    notes: Note[];
    noteViews: NoteView[];
    emailConversations?: EmailConversation[];
    // ... other fields (contacts, email, dates)
}

export interface Note {
    id: string;
    note: string;
    created_by: string;
    creator_full_name: string | null;
    created_at: string;
    // ...
}
```
