-- Create task_notes table for multi-note history per task
create table if not exists public.task_notes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_name text not null,
  author_email text,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_notes_task_id on public.task_notes (task_id);
create index if not exists idx_task_notes_created_at on public.task_notes (created_at desc);

alter table public.task_notes enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'task_notes' and policyname = 'task_notes_select_all') then
    create policy "task_notes_select_all" on public.task_notes for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'task_notes' and policyname = 'task_notes_insert_all') then
    create policy "task_notes_insert_all" on public.task_notes for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'task_notes' and policyname = 'task_notes_delete_all') then
    create policy "task_notes_delete_all" on public.task_notes for delete using (true);
  end if;
end $$;

grant select, insert, delete on public.task_notes to anon, authenticated;
