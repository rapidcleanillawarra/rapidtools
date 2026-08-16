-- Move assigned tech off workshop; source of truth is workshop_tech_schedule (active row)

-- Backfill active schedule rows for workshops that still only have denormalized columns
INSERT INTO public.workshop_tech_schedule (
  workshop_id,
  assigned_tech,
  assigned_tech_name,
  schedule,
  job_type,
  assignment_status,
  workshop_status,
  created_at,
  updated_at
)
SELECT
  w.id,
  w.assigned_tech,
  w.assigned_tech_name,
  NULL,
  NULL,
  'active',
  w.status,
  now(),
  now()
FROM public.workshop w
WHERE w.assigned_tech IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.workshop_tech_schedule s
    WHERE s.workshop_id = w.id
      AND s.assignment_status = 'active'
  );

ALTER TABLE public.workshop
  DROP COLUMN IF EXISTS assigned_tech,
  DROP COLUMN IF EXISTS assigned_tech_name;
