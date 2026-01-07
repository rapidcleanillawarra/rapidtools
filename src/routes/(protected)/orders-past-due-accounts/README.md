# Past Due Accounts (Orders)

Route: `/orders-past-due-accounts` (under the `(protected)` group)

This page shows a sortable/filterable list of customer orders where payment is overdue, plus a lightweight notes system (with per-user “unread” tracking) to support follow-ups.

## Files

- `src/routes/(protected)/orders-past-due-accounts/+page.svelte` — main UI + data fetching for orders + notes.
- `src/routes/(protected)/orders-past-due-accounts/pastDueAccounts.ts` — shared types, column definitions, and helpers.
- `src/routes/(protected)/orders-past-due-accounts/components/PastDueToolbar.svelte` — PD filter + export/print actions.
- `src/routes/(protected)/orders-past-due-accounts/components/PastDueLegend.svelte` — PD counter legend (color bands).
- `src/routes/(protected)/orders-past-due-accounts/components/ColumnVisibilityPills.svelte` — column toggles (Customer is always shown).

## Data Sources

### Orders

`fetchOrders()` calls a Power Automate workflow endpoint (HTTP `POST`) and requests orders matching:

- `OrderStatus`: `Dispatched`, `Backorder Approved`
- `PaymentStatus`: `Pending`, `PartialPaid`

The response is mapped into `ProcessedOrder` items with:

- `payments`: sum of payments
- `amount`: outstanding amount (`GrandTotal - payments`)
- `pdCounter`: number of days past due (`now - DatePaymentDue`)
- `dateIssued` and `dueDate`: formatted for display (`en-AU`)

Note: The workflow URL is currently hardcoded in `+page.svelte`. For security, it’s recommended to move this to a server-side `load` or an internal API route and store secrets in private env vars.

### Notes (Supabase)

Two tables are used:

- `orders_past_due_accounts_order_notes`
  - Rows are linked to orders via `order_id` (invoice/order ID).
  - Soft delete is respected via `deleted_at IS NULL`.
- `orders_past_due_accounts_order_note_views`
  - Tracks which user has viewed which note via `(note_id, user_email)`.

When the page loads, it fetches notes for all visible orders, then fetches view records for those note IDs so unread counts can be computed.

## User Identity

User info comes from:

- `$lib/firebase` (`currentUser`) — provides `user.email` used for view tracking and author stamping.
- `$lib/userProfile` (`userProfile`) — used to populate `creator_full_name` when writing a note.

## UI / Behavior

### Table Layout

Each order renders as 3 rows:

1. Customer name (with external customer link when available)
2. Phone (click-to-call when present)
3. Email (mailto link when present)

All non-customer columns use `rowspan="3"` so they visually align with the grouped customer details.

### Filters

- **PD Counter filter**: operator (`>`, `<`, `=`) + value (days). Defaults to `> 30`.
- **Per-column search**: header inputs filter rows by substring matching.
  - The `Notes` column search matches note text and author fields.

### Sorting

Click a column header to sort; click again to toggle ascending/descending. Sorting handles:

- `pdCounter`: numeric
- `payments` / `amount`: numeric strings
- `dateIssued` / `dueDate`: parsed AU dates (`dd/mm/yyyy`)
- everything else: case-insensitive string compare

### Column Visibility

The “Visible Columns” pills toggle columns on/off and are persisted in localStorage.

- Customer is always shown (by design, because it drives the 3-row layout).

### Notes

In the `Notes` column:

- Button label changes based on whether notes exist (`View Notes` vs `Add notes`).
- Unread count badge shows notes that do not have a matching view record for the current user.

Opening the notes modal:

- Fetches the latest notes for that invoice (descending by `created_at`)
- Inserts missing view records for the current user (marking notes as viewed)

Adding a note:

- Inserts a new note row (with `created_by` and optional `creator_full_name`)
- Inserts a view record for the creator (so it doesn’t appear unread to them)

### Export / Print

- **Export CSV**: exports currently filtered rows using currently visible columns (excluding Notes).
- **Print Report**: opens a new window with a printable table (also excludes Notes).

## Persistence (localStorage keys)

`+page.svelte` stores UI preferences under:

- `orders-pd-filter-operator`
- `orders-pd-filter-value`
- `orders-column-visibility`

## Common Maintenance Tasks

- Update columns/labels/default visibility in `pastDueAccounts.ts`.
- If notes/view schemas change, update:
  - `fetchNotesStatus()`
  - `fetchNoteViews()`
  - `markNotesAsViewed()`
  - `saveNote()`

## Development

From repo root:

- `npm run check` — Svelte + TS typechecking
- `npm run lint` — Prettier check + ESLint
- `npm run dev` — local dev server
