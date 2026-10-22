-- Add assignees JSONB column to tasks table to support multiple assignees per task
alter table public.tasks add column if not exists assignees jsonb default '[]'::jsonb;

-- Create GIN index for fast filtering by assignee within the JSON array
create index if not exists idx_tasks_assignees on public.tasks using gin (assignees);
