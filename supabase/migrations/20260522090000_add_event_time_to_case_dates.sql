-- Add a dedicated event_time column for case dates and backfill legacy time values.

ALTER TABLE public.case_dates
  ADD COLUMN IF NOT EXISTS event_time time;

UPDATE public.case_dates
SET event_time = substring(description from 'Time:\s*(\d{2}:\d{2})')::time
WHERE event_time IS NULL
  AND description ~* '^Time:\s*\d{2}:\d{2}$';
