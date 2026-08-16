-- One active tech schedule per workshop; keep history of superseded/cancelled rows
ALTER TABLE public.workshop_tech_schedule
  DROP CONSTRAINT IF EXISTS workshop_tech_schedule_workshop_id_key;

ALTER TABLE public.workshop_tech_schedule
  ADD COLUMN IF NOT EXISTS assignment_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS workshop_status text NULL;

COMMENT ON COLUMN public.workshop_tech_schedule.assignment_status IS
  'active | superseded | completed | cancelled — only one active row per workshop';
COMMENT ON COLUMN public.workshop_tech_schedule.workshop_status IS
  'Workshop board status at the time this schedule was created';

-- Ensure existing rows are active (default already applies; explicit for clarity)
UPDATE public.workshop_tech_schedule
SET assignment_status = 'active'
WHERE assignment_status IS NULL OR assignment_status = '';

CREATE UNIQUE INDEX IF NOT EXISTS workshop_tech_schedule_one_active_per_workshop_idx
  ON public.workshop_tech_schedule (workshop_id)
  WHERE assignment_status = 'active';

CREATE INDEX IF NOT EXISTS workshop_tech_schedule_workshop_id_status_idx
  ON public.workshop_tech_schedule (workshop_id, assignment_status);
