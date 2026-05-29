-- Store matter event duration for case_dates.
ALTER TABLE public.case_dates
  ADD COLUMN IF NOT EXISTS duration text;

UPDATE public.case_dates
SET duration = '1 hour'
WHERE duration IS NULL
  AND event_time IS NOT NULL;
