-- Machine inspection schedules (replaces Firestore `stt` collection).

create table if not exists public.machine_inspection_schedules (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  start_month smallint not null check (start_month between 1 and 12),
  occurence smallint not null check (occurence between 1 and 12),
  color text not null default '#3b82f6',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  legacy_firestore_id text unique
);

create index if not exists machine_inspection_schedules_company_idx
  on public.machine_inspection_schedules (company)
  where deleted_at is null;

create table if not exists public.machine_inspection_locations (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.machine_inspection_schedules (id) on delete cascade,
  information_id text not null,
  sub_company_name text not null,
  location text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, information_id)
);

create index if not exists machine_inspection_locations_schedule_id_idx
  on public.machine_inspection_locations (schedule_id);

create table if not exists public.machine_inspection_contacts (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.machine_inspection_locations (id) on delete cascade,
  name text not null default '',
  phone text not null default '',
  email text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists machine_inspection_contacts_location_id_idx
  on public.machine_inspection_contacts (location_id);

create table if not exists public.machine_inspection_notes (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.machine_inspection_schedules (id) on delete cascade,
  title text not null default '',
  content text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists machine_inspection_notes_schedule_id_idx
  on public.machine_inspection_notes (schedule_id);

create table if not exists public.machine_inspection_events (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.machine_inspection_schedules (id) on delete restrict,
  information_id text not null,
  company text not null,
  sub_company_name text not null,
  location text not null,
  start_date timestamptz not null,
  end_date timestamptz not null,
  title text not null,
  background_color text not null default '#3b82f6',
  created_by_uid text,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  legacy_firestore_id text unique
);

create index if not exists machine_inspection_events_schedule_info_idx
  on public.machine_inspection_events (schedule_id, information_id)
  where deleted_at is null;

create index if not exists machine_inspection_events_start_date_idx
  on public.machine_inspection_events (start_date)
  where deleted_at is null;

create index if not exists machine_inspection_events_schedule_id_idx
  on public.machine_inspection_events (schedule_id)
  where deleted_at is null;

-- Keep updated_at current on row changes.
create or replace function public.machine_inspection_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists machine_inspection_schedules_set_updated_at on public.machine_inspection_schedules;
create trigger machine_inspection_schedules_set_updated_at
  before update on public.machine_inspection_schedules
  for each row execute procedure public.machine_inspection_touch_updated_at();

drop trigger if exists machine_inspection_locations_set_updated_at on public.machine_inspection_locations;
create trigger machine_inspection_locations_set_updated_at
  before update on public.machine_inspection_locations
  for each row execute procedure public.machine_inspection_touch_updated_at();

drop trigger if exists machine_inspection_contacts_set_updated_at on public.machine_inspection_contacts;
create trigger machine_inspection_contacts_set_updated_at
  before update on public.machine_inspection_contacts
  for each row execute procedure public.machine_inspection_touch_updated_at();

drop trigger if exists machine_inspection_notes_set_updated_at on public.machine_inspection_notes;
create trigger machine_inspection_notes_set_updated_at
  before update on public.machine_inspection_notes
  for each row execute procedure public.machine_inspection_touch_updated_at();

drop trigger if exists machine_inspection_events_set_updated_at on public.machine_inspection_events;
create trigger machine_inspection_events_set_updated_at
  before update on public.machine_inspection_events
  for each row execute procedure public.machine_inspection_touch_updated_at();

-- RLS (match existing public-table pattern used elsewhere in this project).
alter table public.machine_inspection_schedules enable row level security;
alter table public.machine_inspection_locations enable row level security;
alter table public.machine_inspection_contacts enable row level security;
alter table public.machine_inspection_notes enable row level security;
alter table public.machine_inspection_events enable row level security;

create policy "machine_inspection_schedules_select_anon"
  on public.machine_inspection_schedules for select to anon using (true);
create policy "machine_inspection_schedules_insert_anon"
  on public.machine_inspection_schedules for insert to anon with check (true);
create policy "machine_inspection_schedules_update_anon"
  on public.machine_inspection_schedules for update to anon using (true) with check (true);

create policy "machine_inspection_schedules_select_authenticated"
  on public.machine_inspection_schedules for select to authenticated using (true);
create policy "machine_inspection_schedules_insert_authenticated"
  on public.machine_inspection_schedules for insert to authenticated with check (true);
create policy "machine_inspection_schedules_update_authenticated"
  on public.machine_inspection_schedules for update to authenticated using (true) with check (true);

create policy "machine_inspection_locations_select_anon"
  on public.machine_inspection_locations for select to anon using (true);
create policy "machine_inspection_locations_insert_anon"
  on public.machine_inspection_locations for insert to anon with check (true);
create policy "machine_inspection_locations_update_anon"
  on public.machine_inspection_locations for update to anon using (true) with check (true);
create policy "machine_inspection_locations_delete_anon"
  on public.machine_inspection_locations for delete to anon using (true);

create policy "machine_inspection_locations_select_authenticated"
  on public.machine_inspection_locations for select to authenticated using (true);
create policy "machine_inspection_locations_insert_authenticated"
  on public.machine_inspection_locations for insert to authenticated with check (true);
create policy "machine_inspection_locations_update_authenticated"
  on public.machine_inspection_locations for update to authenticated using (true) with check (true);
create policy "machine_inspection_locations_delete_authenticated"
  on public.machine_inspection_locations for delete to authenticated using (true);

create policy "machine_inspection_contacts_select_anon"
  on public.machine_inspection_contacts for select to anon using (true);
create policy "machine_inspection_contacts_insert_anon"
  on public.machine_inspection_contacts for insert to anon with check (true);
create policy "machine_inspection_contacts_update_anon"
  on public.machine_inspection_contacts for update to anon using (true) with check (true);
create policy "machine_inspection_contacts_delete_anon"
  on public.machine_inspection_contacts for delete to anon using (true);

create policy "machine_inspection_contacts_select_authenticated"
  on public.machine_inspection_contacts for select to authenticated using (true);
create policy "machine_inspection_contacts_insert_authenticated"
  on public.machine_inspection_contacts for insert to authenticated with check (true);
create policy "machine_inspection_contacts_update_authenticated"
  on public.machine_inspection_contacts for update to authenticated using (true) with check (true);
create policy "machine_inspection_contacts_delete_authenticated"
  on public.machine_inspection_contacts for delete to authenticated using (true);

create policy "machine_inspection_notes_select_anon"
  on public.machine_inspection_notes for select to anon using (true);
create policy "machine_inspection_notes_insert_anon"
  on public.machine_inspection_notes for insert to anon with check (true);
create policy "machine_inspection_notes_update_anon"
  on public.machine_inspection_notes for update to anon using (true) with check (true);
create policy "machine_inspection_notes_delete_anon"
  on public.machine_inspection_notes for delete to anon using (true);

create policy "machine_inspection_notes_select_authenticated"
  on public.machine_inspection_notes for select to authenticated using (true);
create policy "machine_inspection_notes_insert_authenticated"
  on public.machine_inspection_notes for insert to authenticated with check (true);
create policy "machine_inspection_notes_update_authenticated"
  on public.machine_inspection_notes for update to authenticated using (true) with check (true);
create policy "machine_inspection_notes_delete_authenticated"
  on public.machine_inspection_notes for delete to authenticated using (true);

create policy "machine_inspection_events_select_anon"
  on public.machine_inspection_events for select to anon using (true);
create policy "machine_inspection_events_insert_anon"
  on public.machine_inspection_events for insert to anon with check (true);
create policy "machine_inspection_events_update_anon"
  on public.machine_inspection_events for update to anon using (true) with check (true);

create policy "machine_inspection_events_select_authenticated"
  on public.machine_inspection_events for select to authenticated using (true);
create policy "machine_inspection_events_insert_authenticated"
  on public.machine_inspection_events for insert to authenticated with check (true);
create policy "machine_inspection_events_update_authenticated"
  on public.machine_inspection_events for update to authenticated using (true) with check (true);

grant select, insert, update, delete on public.machine_inspection_schedules to anon, authenticated;
grant select, insert, update, delete on public.machine_inspection_locations to anon, authenticated;
grant select, insert, update, delete on public.machine_inspection_contacts to anon, authenticated;
grant select, insert, update, delete on public.machine_inspection_notes to anon, authenticated;
grant select, insert, update on public.machine_inspection_events to anon, authenticated;
