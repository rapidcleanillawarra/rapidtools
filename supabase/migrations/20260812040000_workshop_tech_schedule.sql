-- Tech assignment schedule for workshop board Assign Tech modal
CREATE TABLE IF NOT EXISTS public.workshop_tech_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.workshop (id) ON DELETE CASCADE,
  assigned_tech text NULL,
  assigned_tech_name text NULL,
  schedule timestamptz NULL,
  assigned_by text NULL,
  assigned_by_name text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workshop_tech_schedule_workshop_id_key UNIQUE (workshop_id)
);

CREATE INDEX IF NOT EXISTS workshop_tech_schedule_workshop_id_idx
  ON public.workshop_tech_schedule (workshop_id);

CREATE INDEX IF NOT EXISTS workshop_tech_schedule_schedule_idx
  ON public.workshop_tech_schedule (schedule);

COMMENT ON TABLE public.workshop_tech_schedule IS
  'Scheduled technician assignment for a workshop job (one row per workshop)';
COMMENT ON COLUMN public.workshop_tech_schedule.assigned_tech IS
  'Email of assigned workshop technician';
COMMENT ON COLUMN public.workshop_tech_schedule.assigned_tech_name IS
  'Display name of assigned workshop technician';
COMMENT ON COLUMN public.workshop_tech_schedule.schedule IS
  'When the technician is scheduled to work on the job';

ALTER TABLE public.workshop_tech_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY workshop_tech_schedule_select
  ON public.workshop_tech_schedule FOR SELECT USING (true);

CREATE POLICY workshop_tech_schedule_insert
  ON public.workshop_tech_schedule FOR INSERT WITH CHECK (true);

CREATE POLICY workshop_tech_schedule_update
  ON public.workshop_tech_schedule FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY workshop_tech_schedule_delete
  ON public.workshop_tech_schedule FOR DELETE USING (true);
