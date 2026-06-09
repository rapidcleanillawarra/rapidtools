# Scheduled Test and Tag - Supabase Integration

Machine inspection data is stored in normalized Supabase tables with the `machine_inspection_` prefix.

## Tables

| Table | Purpose |
|-------|---------|
| `machine_inspection_companies` | Company profile (frequency, color, etc.) |
| `machine_inspection_locations` | Sub-company locations linked to a company |
| `machine_inspection_contacts` | Contacts linked to a location |
| `machine_inspection_notes` | Notes linked to a company |
| `machine_inspection_events` | Calendar appointments |
| `machine_inspection_equipments` | Master equipment list per company |
| `machine_inspection_equipment_placements` | Equipment location per company (can change between periods) |
| `machine_inspection_sheets` | Saved service run (date, company) |
| `machine_inspection_sheet_rows` | Per-service results per equipment |
| `machine_inspection_sheet_row_parts` | Parts (SKU + name) linked to a sheet row |

## Service layer

- `services/companies.ts` — company CRUD and nested location/contact/note writes
- `services/equipments.ts` — equipment and placement upserts
- `services/sheets.ts` — sheet and sheet row save/load
- `services/events.ts` — event CRUD and calendar mapping helpers
- `companies/utils.ts` — validation helpers; re-exports company operations
- `sheet/persistence.ts` — orchestrates sheet save/load with equipments
- `utils/sttEvents.ts` — backward-compatible re-exports for event operations

## Database migrations

Apply via Supabase CLI or dashboard:

```bash
supabase/migrations/20260609120000_machine_inspection.sql
supabase/migrations/20260610120000_machine_inspection_companies_and_sheets.sql
supabase/migrations/20260610130000_machine_inspection_sheet_row_parts.sql
```

## Auth

Firebase Authentication is still used for app login. Supabase stores machine inspection data using the project anon key and RLS policies consistent with other Rapid Tools tables.
