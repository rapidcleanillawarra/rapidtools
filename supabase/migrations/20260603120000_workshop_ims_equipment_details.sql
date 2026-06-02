-- Extra customer / machine fields for IMS inspections (aligned with PM floor scrubber sections)
alter table public.workshop_ims_inspections
  add column if not exists equipment_details jsonb not null default '{}'::jsonb;
