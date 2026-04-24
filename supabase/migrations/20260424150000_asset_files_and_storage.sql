-- Link uploaded files/photos in Storage bucket `assets` to asset records.
-- Ensure the public `assets` bucket exists (idempotent; safe if created in the dashboard).
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;

-- RLS: allow app (anon key) to read/write objects under the assets bucket, matching public.assets.
-- Adjust in the dashboard if you use stricter rules.
drop policy if exists "assets_storage_select" on storage.objects;
drop policy if exists "assets_storage_insert" on storage.objects;
drop policy if exists "assets_storage_update" on storage.objects;
drop policy if exists "assets_storage_delete" on storage.objects;

create policy "assets_storage_select" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'assets');

create policy "assets_storage_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'assets');

create policy "assets_storage_update" on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'assets')
  with check (bucket_id = 'assets');

create policy "assets_storage_delete" on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'assets');

-- Metadata rows (one per file)
create table if not exists public.asset_files (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text,
  byte_size bigint,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists asset_files_storage_path_key on public.asset_files (storage_path);
create index if not exists asset_files_asset_id_idx on public.asset_files (asset_id);

alter table public.asset_files enable row level security;

drop policy if exists "asset_files_select_anon" on public.asset_files;
drop policy if exists "asset_files_insert_anon" on public.asset_files;
drop policy if exists "asset_files_delete_anon" on public.asset_files;
drop policy if exists "asset_files_select_authenticated" on public.asset_files;
drop policy if exists "asset_files_insert_authenticated" on public.asset_files;
drop policy if exists "asset_files_delete_authenticated" on public.asset_files;

create policy "asset_files_select_anon" on public.asset_files
  for select to anon
  using (true);

create policy "asset_files_insert_anon" on public.asset_files
  for insert to anon
  with check (true);

create policy "asset_files_delete_anon" on public.asset_files
  for delete to anon
  using (true);

create policy "asset_files_select_authenticated" on public.asset_files
  for select to authenticated
  using (true);

create policy "asset_files_insert_authenticated" on public.asset_files
  for insert to authenticated
  with check (true);

create policy "asset_files_delete_authenticated" on public.asset_files
  for delete to authenticated
  using (true);

grant select, insert, delete on public.asset_files to anon, authenticated;
