-- Add a display name for saved service sheets (e.g. "July 2026").

alter table public.machine_inspection_sheets
  add column if not exists name text not null default '';

update public.machine_inspection_sheets
set name = to_char(service_date, 'FMMonth YYYY')
where name = '';
