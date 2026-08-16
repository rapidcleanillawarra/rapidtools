-- Reason recorded when an existing tech schedule or technician is changed
ALTER TABLE public.workshop_tech_schedule
  ADD COLUMN IF NOT EXISTS change_reason text NULL;

COMMENT ON COLUMN public.workshop_tech_schedule.change_reason IS
  'Explanation for changing an existing technician assignment or schedule';
