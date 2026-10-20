-- Create task_departments table for custom buckets/departments
create table if not exists public.task_departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color_class text,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_departments_name on public.task_departments (name);

alter table public.task_departments enable row level security;

create policy "task_departments_select_all"
  on public.task_departments for select
  using (true);

create policy "task_departments_insert_all"
  on public.task_departments for insert
  with check (true);

create policy "task_departments_delete_all"
  on public.task_departments for delete
  using (true);

grant select, insert, delete on public.task_departments to anon, authenticated;
