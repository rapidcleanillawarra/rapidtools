# UTC due date storage + Sydney display plan

## Goal

- Save ticket due dates to the database as UTC+0.
- Display/edit due dates in Australia/Sydney time in the UI.

## Scope (primary files)

- `src/routes/(protected)/orders-past-due-accounts/components/TicketModal.svelte` (create)
- `src/routes/(protected)/orders-past-due-accounts/components/EditTicketModal.svelte` (edit)
- `src/routes/(protected)/orders-past-due-accounts/components/ViewTicketsModal.svelte` (display)

## Plan

1. Add a shared timezone helper (prefer Luxon since it is already a dependency) in a new file such as `src/routes/(protected)/orders-past-due-accounts/utils/dueDate.ts`:
   - `sydneyInputToUtcIso(input: string | ''): string | null` using `DateTime.fromISO(input, { zone: 'Australia/Sydney' }).toUTC().toISO()`.
   - `utcIsoToSydneyInput(iso: string | null): string` using `.setZone('Australia/Sydney').toFormat("yyyy-LL-dd'T'HH:mm")` for `datetime-local` inputs.
   - `formatSydneyDisplay(iso: string | null): string` using `.setZone('Australia/Sydney')` with a friendly format.
   - Guard for invalid/empty inputs and legacy non-ISO strings (return empty string or original display string).

2. Update TicketModal (create flow):
   - Convert `dueDate` (Sydney wall time from `datetime-local`) to UTC ISO before insert (`due_date: sydneyInputToUtcIso(dueDate)`), store `null` when empty.
   - Update validation to compare against now using the UTC value (avoid local timezone skew).

3. Update EditTicketModal (edit flow):
   - When pre-populating, convert stored UTC `ticket.due_date` to Sydney input string via `utcIsoToSydneyInput`.
   - When saving, convert `dueDate` back to UTC ISO with the helper.
   - Align validation with Sydney->UTC conversion (compare UTC times).

4. Update ViewTicketsModal (display):
   - Format ticket due dates using `formatSydneyDisplay` so the UI always shows Australia/Sydney time.
   - Update `isPastDue` to parse UTC timestamps and compare to `new Date()` (absolute time).
   - If `order?.dueDate` is used as a fallback and is not ISO, leave it as a plain string or add a safe parse path.

5. Validation:
   - Add a small unit test for the new helper (including an AEST/AEDT boundary example).
   - Manual QA: create + edit a ticket, confirm the DB value is UTC (Z) and the UI shows Sydney time consistently.
