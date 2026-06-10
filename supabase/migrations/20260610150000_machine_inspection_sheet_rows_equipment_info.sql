-- Replace row sort_order with a JSON snapshot of equipment info at save time.

alter table public.machine_inspection_sheet_rows
  add column if not exists equipment_info jsonb not null default '{}'::jsonb;

update public.machine_inspection_sheet_rows sr
set equipment_info = jsonb_build_object(
  'tag', coalesce(e.customer_tag, ''),
  'machines', coalesce(e.equipment_name, ''),
  'typeOfMachine', coalesce(e.equipment_type, ''),
  'serialNumber', coalesce(e.serial_number, ''),
  'sku', coalesce(e.sku, ''),
  'size', coalesce(e.size, ''),
  'location', coalesce(l.location, '')
)
from public.machine_inspection_equipments e
left join public.machine_inspection_equipment_placements p
  on p.rci_tag = e.rci_tag
  and p.company_id = e.company_id
left join public.machine_inspection_locations l
  on l.id = p.location_id
where sr.equipment_id = e.id;

drop index if exists public.machine_inspection_sheet_rows_sheet_id_idx;

create index if not exists machine_inspection_sheet_rows_sheet_id_idx
  on public.machine_inspection_sheet_rows (sheet_id);

alter table public.machine_inspection_sheet_rows
  drop column if exists sort_order;
