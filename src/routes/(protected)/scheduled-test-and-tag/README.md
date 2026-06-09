# Scheduled Test and Tag - Supabase Integration

Machine inspection data is stored in normalized Supabase tables with the `machine_inspection_` prefix.

## Tables

| Table | Purpose |
|-------|---------|
| `machine_inspection_schedules` | Company schedule profile (frequency, color, etc.) |
| `machine_inspection_locations` | Sub-company locations linked to a schedule |
| `machine_inspection_contacts` | Contacts linked to a location |
| `machine_inspection_notes` | Notes linked to a schedule |
| `machine_inspection_events` | Calendar appointments |

## Service layer

- `services/schedules.ts` — schedule CRUD and nested location/contact/note writes
- `services/events.ts` — event CRUD and calendar mapping helpers
- `companies/utils.ts` — validation helpers; re-exports schedule operations
- `utils/sttEvents.ts` — backward-compatible re-exports for event operations

## Migration from Firestore

Legacy Firestore collections (`stt`, `stt_events`) can be migrated with:

```bash
node scripts/migrate-machine-inspection-from-firestore.mjs
```

Apply the SQL migration first:

```bash
# via Supabase CLI or dashboard
supabase/migrations/20260609120000_machine_inspection.sql
```

## Auth

Firebase Authentication is still used for app login. Supabase stores machine inspection data using the project anon key and RLS policies consistent with other Rapid Tools tables.
