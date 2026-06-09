-- Normalize sheet row parts into a child table (replaces JSON text on sheet rows).

create table if not exists public.machine_inspection_sheet_row_parts (
  id uuid primary key default gen_random_uuid(),
  sheet_row_id uuid not null references public.machine_inspection_sheet_rows (id) on delete cascade,
  sort_order integer not null default 0,
  sku text not null default '',
  name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists machine_inspection_sheet_row_parts_sheet_row_id_idx
  on public.machine_inspection_sheet_row_parts (sheet_row_id, sort_order);

-- Migrate legacy JSON / plain-text parts column into normalized rows.
insert into public.machine_inspection_sheet_row_parts (sheet_row_id, sort_order, sku, name)
select
  sr.id,
  (part.ordinality - 1)::integer as sort_order,
  coalesce(part.value->>'sku', '') as sku,
  coalesce(part.value->>'name', '') as name
from public.machine_inspection_sheet_rows sr
cross join lateral (
  select value, ordinality
  from jsonb_array_elements(
    case
      when sr.parts = '' then '[]'::jsonb
      when sr.parts ~ '^\s*\[' then sr.parts::jsonb
      else jsonb_build_array(jsonb_build_object('sku', '', 'name', sr.parts))
    end
  ) with ordinality as elem(value, ordinality)
) as part
where sr.parts <> ''
  and (
    coalesce(part.value->>'sku', '') <> ''
    or coalesce(part.value->>'name', '') <> ''
  );

alter table public.machine_inspection_sheet_rows
  drop column if exists parts;

drop trigger if exists machine_inspection_sheet_row_parts_set_updated_at
  on public.machine_inspection_sheet_row_parts;
create trigger machine_inspection_sheet_row_parts_set_updated_at
  before update on public.machine_inspection_sheet_row_parts
  for each row execute procedure public.machine_inspection_touch_updated_at();

alter table public.machine_inspection_sheet_row_parts enable row level security;

create policy "machine_inspection_sheet_row_parts_select_anon"
  on public.machine_inspection_sheet_row_parts for select to anon using (true);
create policy "machine_inspection_sheet_row_parts_insert_anon"
  on public.machine_inspection_sheet_row_parts for insert to anon with check (true);
create policy "machine_inspection_sheet_row_parts_update_anon"
  on public.machine_inspection_sheet_row_parts for update to anon using (true) with check (true);
create policy "machine_inspection_sheet_row_parts_delete_anon"
  on public.machine_inspection_sheet_row_parts for delete to anon using (true);

create policy "machine_inspection_sheet_row_parts_select_authenticated"
  on public.machine_inspection_sheet_row_parts for select to authenticated using (true);
create policy "machine_inspection_sheet_row_parts_insert_authenticated"
  on public.machine_inspection_sheet_row_parts for insert to authenticated with check (true);
create policy "machine_inspection_sheet_row_parts_update_authenticated"
  on public.machine_inspection_sheet_row_parts for update to authenticated using (true) with check (true);
create policy "machine_inspection_sheet_row_parts_delete_authenticated"
  on public.machine_inspection_sheet_row_parts for delete to authenticated using (true);

grant select, insert, update, delete on public.machine_inspection_sheet_row_parts to anon, authenticated;
