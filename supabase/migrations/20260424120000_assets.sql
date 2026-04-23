-- Asset records (equipment / serial-tracked items).
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  asset_number text,
  asset_name text,
  model text,
  serial_number text,
  test_date date,
  test_due_date date,
  purchase_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by text,
  created_by_email text,
  updated_by text,
  updated_by_email text,
  deleted_by text,
  deleted_by_email text,
  created_by_name text,
  updated_by_name text,
  deleted_by_name text
);

create index if not exists assets_asset_number_idx on public.assets (asset_number);
create index if not exists assets_serial_number_idx on public.assets (serial_number) where serial_number is not null;

-- Keep updated_at current on row changes (application may also set it explicitly on insert).
create or replace function public.assets_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists assets_set_updated_at on public.assets;
create trigger assets_set_updated_at
  before update on public.assets
  for each row
  execute procedure public.assets_touch_updated_at();

alter table public.assets enable row level security;

-- Match existing public-table pattern (anon + authenticated) used elsewhere in this project.
create policy "assets_insert_anon"
  on public.assets for insert to anon
  with check (true);

create policy "assets_update_anon"
  on public.assets for update to anon
  using (true) with check (true);

create policy "assets_select_anon"
  on public.assets for select to anon
  using (true);

create policy "assets_insert_authenticated"
  on public.assets for insert to authenticated
  with check (true);

create policy "assets_update_authenticated"
  on public.assets for update to authenticated
  using (true) with check (true);

create policy "assets_select_authenticated"
  on public.assets for select to authenticated
  using (true);

grant select, insert, update on public.assets to anon, authenticated;
