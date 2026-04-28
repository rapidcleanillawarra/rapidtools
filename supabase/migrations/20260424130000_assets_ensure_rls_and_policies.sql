-- Ensure public.assets is protected with RLS and the same app-facing policies as 20260424120000.
-- (Useful if the table was created in the Supabase SQL editor with RLS off, or a partial apply.)
-- The Svelte app uses the Supabase anon key, so the anon role policies are required for browser access.

alter table public.assets enable row level security;

-- Idempotent: replace with identical definitions
drop policy if exists "assets_insert_anon" on public.assets;
drop policy if exists "assets_update_anon" on public.assets;
drop policy if exists "assets_select_anon" on public.assets;
drop policy if exists "assets_insert_authenticated" on public.assets;
drop policy if exists "assets_update_authenticated" on public.assets;
drop policy if exists "assets_select_authenticated" on public.assets;

create policy "assets_insert_anon" on public.assets for insert to anon
  with check (true);

create policy "assets_update_anon" on public.assets for update to anon
  using (true) with check (true);

create policy "assets_select_anon" on public.assets for select to anon
  using (true);

create policy "assets_insert_authenticated" on public.assets for insert to authenticated
  with check (true);

create policy "assets_update_authenticated" on public.assets for update to authenticated
  using (true) with check (true);

create policy "assets_select_authenticated" on public.assets for select to authenticated
  using (true);

-- Match grants from the original migration
grant select, insert, update on public.assets to anon, authenticated;
