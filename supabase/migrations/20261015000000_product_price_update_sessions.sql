-- 1. Create table for price update sessions
create table if not exists public.product_price_update_sessions (
  id uuid primary key default gen_random_uuid(),
  session_name text not null,
  user_id text,
  user_email text,
  user_name text,
  user_info jsonb default '{}'::jsonb,
  status text not null default 'active', -- 'active' | 'completed' | 'cancelled'
  items_updated_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_price_update_sessions_user_id on public.product_price_update_sessions (user_id);
create index if not exists idx_price_update_sessions_status on public.product_price_update_sessions (status);
create index if not exists idx_price_update_sessions_created_at on public.product_price_update_sessions (created_at desc);

-- 2. Add session_id to product_price_adjustment
alter table public.product_price_adjustment
  add column if not exists session_id uuid references public.product_price_update_sessions(id) on delete set null;

create index if not exists idx_product_price_adjustment_session_id on public.product_price_adjustment (session_id);

-- 3. Row Level Security policies
alter table public.product_price_update_sessions enable row level security;

create policy "product_price_update_sessions_select_all"
  on public.product_price_update_sessions for select
  using (true);

create policy "product_price_update_sessions_insert_all"
  on public.product_price_update_sessions for insert
  with check (true);

create policy "product_price_update_sessions_update_all"
  on public.product_price_update_sessions for update
  using (true) with check (true);

grant select, insert, update on public.product_price_update_sessions to anon, authenticated;
