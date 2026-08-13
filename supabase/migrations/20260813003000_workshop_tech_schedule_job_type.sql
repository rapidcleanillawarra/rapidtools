-- Job type for workshop tech assignment schedule
ALTER TABLE public.workshop_tech_schedule
  ADD COLUMN IF NOT EXISTS job_type text NULL;

COMMENT ON COLUMN public.workshop_tech_schedule.job_type IS
  'Type of work scheduled for the assigned technician (e.g. Quote, Repair, Service, Warranty)';
