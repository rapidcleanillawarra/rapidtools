-- HD / HDS inspection and maintenance checklist (IMS)
create table if not exists public.workshop_ims_inspections (
  id uuid primary key default gen_random_uuid(),
  workshop_order_id text,
  inspection_date date not null default (current_date),
  order_no text,
  customer_no text,
  machine_type text,
  type_no text,
  serial_number text,
  year_of_manufacture text,
  purchase_date date,
  tester_name text not null default 'Unknown',
  customer_name text,
  operating_hours_total jsonb not null default '{}'::jsonb,
  operating_hours_since_maintenance jsonb not null default '{}'::jsonb,
  checklist_data jsonb,
  signatures jsonb not null default '{}'::jsonb,
  status text not null default 'completed',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workshop_ims_inspections_inspection_date_idx
  on public.workshop_ims_inspections (inspection_date desc);

create index if not exists workshop_ims_inspections_created_at_idx
  on public.workshop_ims_inspections (created_at desc);

create or replace function public.workshop_ims_inspections_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workshop_ims_inspections_set_updated_at on public.workshop_ims_inspections;
create trigger workshop_ims_inspections_set_updated_at
  before update on public.workshop_ims_inspections
  for each row
  execute procedure public.workshop_ims_inspections_touch_updated_at();

alter table public.workshop_ims_inspections enable row level security;

create policy "workshop_ims_inspections_insert_anon"
  on public.workshop_ims_inspections for insert to anon
  with check (true);

create policy "workshop_ims_inspections_update_anon"
  on public.workshop_ims_inspections for update to anon
  using (true) with check (true);

create policy "workshop_ims_inspections_select_anon"
  on public.workshop_ims_inspections for select to anon
  using (true);

create policy "workshop_ims_inspections_delete_anon"
  on public.workshop_ims_inspections for delete to anon
  using (true);

create policy "workshop_ims_inspections_insert_authenticated"
  on public.workshop_ims_inspections for insert to authenticated
  with check (true);

create policy "workshop_ims_inspections_update_authenticated"
  on public.workshop_ims_inspections for update to authenticated
  using (true) with check (true);

create policy "workshop_ims_inspections_select_authenticated"
  on public.workshop_ims_inspections for select to authenticated
  using (true);

create policy "workshop_ims_inspections_delete_authenticated"
  on public.workshop_ims_inspections for delete to authenticated
  using (true);

grant select, insert, update, delete on public.workshop_ims_inspections to anon, authenticated;
