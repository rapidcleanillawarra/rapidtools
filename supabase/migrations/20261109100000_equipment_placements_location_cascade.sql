-- Allow equipment placements to cascade-delete when a location is deleted.
alter table public.machine_inspection_equipment_placements
  drop constraint if exists machine_inspection_equipment_placements_location_id_fkey,
  add constraint machine_inspection_equipment_placements_location_id_fkey
    foreign key (location_id)
    references public.machine_inspection_locations (id)
    on delete cascade;
