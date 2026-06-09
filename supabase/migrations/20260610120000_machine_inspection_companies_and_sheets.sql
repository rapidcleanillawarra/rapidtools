-- Rename schedules → companies and add equipment, placement, sheet tables.

-- 1. Rename parent table
alter table public.machine_inspection_schedules rename to machine_inspection_companies;

-- 2. Rename schedule_id → company_id on child tables
alter table public.machine_inspection_locations rename column schedule_id to company_id;
alter table public.machine_inspection_notes rename column schedule_id to company_id;
alter table public.machine_inspection_events rename column schedule_id to company_id;

-- 3. Rename indexes
alter index if exists machine_inspection_schedules_company_idx
  rename to machine_inspection_companies_company_idx;
alter index if exists machine_inspection_locations_schedule_id_idx
  rename to machine_inspection_locations_company_id_idx;
alter index if exists machine_inspection_notes_schedule_id_idx
  rename to machine_inspection_notes_company_id_idx;
alter index if exists machine_inspection_events_schedule_info_idx
  rename to machine_inspection_events_company_info_idx;
alter index if exists machine_inspection_events_schedule_id_idx
  rename to machine_inspection_events_company_id_idx;

-- 4. Rename trigger
drop trigger if exists machine_inspection_schedules_set_updated_at on public.machine_inspection_companies;
create trigger machine_inspection_companies_set_updated_at
  before update on public.machine_inspection_companies
  for each row execute procedure public.machine_inspection_touch_updated_at();

-- 5. Rename RLS policies on companies table
drop policy if exists "machine_inspection_schedules_select_anon" on public.machine_inspection_companies;
drop policy if exists "machine_inspection_schedules_insert_anon" on public.machine_inspection_companies;
drop policy if exists "machine_inspection_schedules_update_anon" on public.machine_inspection_companies;
drop policy if exists "machine_inspection_schedules_select_authenticated" on public.machine_inspection_companies;
drop policy if exists "machine_inspection_schedules_insert_authenticated" on public.machine_inspection_companies;
drop policy if exists "machine_inspection_schedules_update_authenticated" on public.machine_inspection_companies;

create policy "machine_inspection_companies_select_anon"
  on public.machine_inspection_companies for select to anon using (true);
create policy "machine_inspection_companies_insert_anon"
  on public.machine_inspection_companies for insert to anon with check (true);
create policy "machine_inspection_companies_update_anon"
  on public.machine_inspection_companies for update to anon using (true) with check (true);

create policy "machine_inspection_companies_select_authenticated"
  on public.machine_inspection_companies for select to authenticated using (true);
create policy "machine_inspection_companies_insert_authenticated"
  on public.machine_inspection_companies for insert to authenticated with check (true);
create policy "machine_inspection_companies_update_authenticated"
  on public.machine_inspection_companies for update to authenticated using (true) with check (true);

-- 6. Equipment master list per company
create table if not exists public.machine_inspection_equipments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.machine_inspection_companies (id) on delete cascade,
  rci_tag text not null,
  start_month integer not null default 1 check (start_month between 1 and 12),
  frequency integer not null default 12 check (frequency between 1 and 12),
  sort_order integer not null default 0,
  customer_tag text not null default '',
  equipment_name text not null default '',
  equipment_type text not null default '',
  serial_number text not null default '',
  sku text not null default '',
  size text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, rci_tag)
);

create index if not exists machine_inspection_equipments_company_id_idx
  on public.machine_inspection_equipments (company_id);

-- 7. Equipment placement per company (location can change between periods)
create table if not exists public.machine_inspection_equipment_placements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.machine_inspection_companies (id) on delete cascade,
  rci_tag text not null,
  location_id uuid not null references public.machine_inspection_locations (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, rci_tag)
);

create index if not exists machine_inspection_equipment_placements_company_id_idx
  on public.machine_inspection_equipment_placements (company_id);

create index if not exists machine_inspection_equipment_placements_location_id_idx
  on public.machine_inspection_equipment_placements (location_id);

-- 8. Service run sheets
create table if not exists public.machine_inspection_sheets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.machine_inspection_companies (id) on delete restrict,
  service_date date not null default current_date,
  created_by_uid text,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists machine_inspection_sheets_company_id_idx
  on public.machine_inspection_sheets (company_id);

create index if not exists machine_inspection_sheets_service_date_idx
  on public.machine_inspection_sheets (service_date);

-- 9. Per-service results per equipment
create table if not exists public.machine_inspection_sheet_rows (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.machine_inspection_sheets (id) on delete cascade,
  equipment_id uuid not null references public.machine_inspection_equipments (id) on delete restrict,
  sort_order integer not null default 0,
  result text not null default '' check (result in ('', 'pass', 'fail')),
  workshop_id text not null default '',
  service text not null default '',
  parts text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists machine_inspection_sheet_rows_sheet_id_idx
  on public.machine_inspection_sheet_rows (sheet_id, sort_order);

-- 10. updated_at triggers for new tables
drop trigger if exists machine_inspection_equipments_set_updated_at on public.machine_inspection_equipments;
create trigger machine_inspection_equipments_set_updated_at
  before update on public.machine_inspection_equipments
  for each row execute procedure public.machine_inspection_touch_updated_at();

drop trigger if exists machine_inspection_equipment_placements_set_updated_at on public.machine_inspection_equipment_placements;
create trigger machine_inspection_equipment_placements_set_updated_at
  before update on public.machine_inspection_equipment_placements
  for each row execute procedure public.machine_inspection_touch_updated_at();

drop trigger if exists machine_inspection_sheets_set_updated_at on public.machine_inspection_sheets;
create trigger machine_inspection_sheets_set_updated_at
  before update on public.machine_inspection_sheets
  for each row execute procedure public.machine_inspection_touch_updated_at();

drop trigger if exists machine_inspection_sheet_rows_set_updated_at on public.machine_inspection_sheet_rows;
create trigger machine_inspection_sheet_rows_set_updated_at
  before update on public.machine_inspection_sheet_rows
  for each row execute procedure public.machine_inspection_touch_updated_at();

-- 11. RLS for new tables
alter table public.machine_inspection_equipments enable row level security;
alter table public.machine_inspection_equipment_placements enable row level security;
alter table public.machine_inspection_sheets enable row level security;
alter table public.machine_inspection_sheet_rows enable row level security;

create policy "machine_inspection_equipments_select_anon"
  on public.machine_inspection_equipments for select to anon using (true);
create policy "machine_inspection_equipments_insert_anon"
  on public.machine_inspection_equipments for insert to anon with check (true);
create policy "machine_inspection_equipments_update_anon"
  on public.machine_inspection_equipments for update to anon using (true) with check (true);
create policy "machine_inspection_equipments_delete_anon"
  on public.machine_inspection_equipments for delete to anon using (true);

create policy "machine_inspection_equipments_select_authenticated"
  on public.machine_inspection_equipments for select to authenticated using (true);
create policy "machine_inspection_equipments_insert_authenticated"
  on public.machine_inspection_equipments for insert to authenticated with check (true);
create policy "machine_inspection_equipments_update_authenticated"
  on public.machine_inspection_equipments for update to authenticated using (true) with check (true);
create policy "machine_inspection_equipments_delete_authenticated"
  on public.machine_inspection_equipments for delete to authenticated using (true);

create policy "machine_inspection_equipment_placements_select_anon"
  on public.machine_inspection_equipment_placements for select to anon using (true);
create policy "machine_inspection_equipment_placements_insert_anon"
  on public.machine_inspection_equipment_placements for insert to anon with check (true);
create policy "machine_inspection_equipment_placements_update_anon"
  on public.machine_inspection_equipment_placements for update to anon using (true) with check (true);
create policy "machine_inspection_equipment_placements_delete_anon"
  on public.machine_inspection_equipment_placements for delete to anon using (true);

create policy "machine_inspection_equipment_placements_select_authenticated"
  on public.machine_inspection_equipment_placements for select to authenticated using (true);
create policy "machine_inspection_equipment_placements_insert_authenticated"
  on public.machine_inspection_equipment_placements for insert to authenticated with check (true);
create policy "machine_inspection_equipment_placements_update_authenticated"
  on public.machine_inspection_equipment_placements for update to authenticated using (true) with check (true);
create policy "machine_inspection_equipment_placements_delete_authenticated"
  on public.machine_inspection_equipment_placements for delete to authenticated using (true);

create policy "machine_inspection_sheets_select_anon"
  on public.machine_inspection_sheets for select to anon using (true);
create policy "machine_inspection_sheets_insert_anon"
  on public.machine_inspection_sheets for insert to anon with check (true);
create policy "machine_inspection_sheets_update_anon"
  on public.machine_inspection_sheets for update to anon using (true) with check (true);
create policy "machine_inspection_sheets_delete_anon"
  on public.machine_inspection_sheets for delete to anon using (true);

create policy "machine_inspection_sheets_select_authenticated"
  on public.machine_inspection_sheets for select to authenticated using (true);
create policy "machine_inspection_sheets_insert_authenticated"
  on public.machine_inspection_sheets for insert to authenticated with check (true);
create policy "machine_inspection_sheets_update_authenticated"
  on public.machine_inspection_sheets for update to authenticated using (true) with check (true);
create policy "machine_inspection_sheets_delete_authenticated"
  on public.machine_inspection_sheets for delete to authenticated using (true);

create policy "machine_inspection_sheet_rows_select_anon"
  on public.machine_inspection_sheet_rows for select to anon using (true);
create policy "machine_inspection_sheet_rows_insert_anon"
  on public.machine_inspection_sheet_rows for insert to anon with check (true);
create policy "machine_inspection_sheet_rows_update_anon"
  on public.machine_inspection_sheet_rows for update to anon using (true) with check (true);
create policy "machine_inspection_sheet_rows_delete_anon"
  on public.machine_inspection_sheet_rows for delete to anon using (true);

create policy "machine_inspection_sheet_rows_select_authenticated"
  on public.machine_inspection_sheet_rows for select to authenticated using (true);
create policy "machine_inspection_sheet_rows_insert_authenticated"
  on public.machine_inspection_sheet_rows for insert to authenticated with check (true);
create policy "machine_inspection_sheet_rows_update_authenticated"
  on public.machine_inspection_sheet_rows for update to authenticated using (true) with check (true);
create policy "machine_inspection_sheet_rows_delete_authenticated"
  on public.machine_inspection_sheet_rows for delete to authenticated using (true);

grant select, insert, update, delete on public.machine_inspection_companies to anon, authenticated;
grant select, insert, update, delete on public.machine_inspection_equipments to anon, authenticated;
grant select, insert, update, delete on public.machine_inspection_equipment_placements to anon, authenticated;
grant select, insert, update, delete on public.machine_inspection_sheets to anon, authenticated;
grant select, insert, update, delete on public.machine_inspection_sheet_rows to anon, authenticated;
