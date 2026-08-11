-- Assigned technician on workshop jobs (board Assign Tech modal)
ALTER TABLE public.workshop
  ADD COLUMN IF NOT EXISTS assigned_tech text NULL,
  ADD COLUMN IF NOT EXISTS assigned_tech_name text NULL;

COMMENT ON COLUMN public.workshop.assigned_tech IS 'Email of assigned workshop technician';
COMMENT ON COLUMN public.workshop.assigned_tech_name IS 'Display name of assigned workshop technician';
