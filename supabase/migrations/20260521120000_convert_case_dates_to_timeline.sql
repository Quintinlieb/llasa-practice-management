-- Convert case_dates from fixed single-purpose columns into a flexible timeline/event log.

ALTER TABLE public.case_dates
  DROP CONSTRAINT IF EXISTS case_dates_date_type_check;

DROP INDEX IF EXISTS public.case_dates_case_file_id_date_type_key;

ALTER TABLE public.case_dates
  ADD COLUMN IF NOT EXISTS event_label text,
  ADD COLUMN IF NOT EXISTS created_by_name text;

UPDATE public.case_dates
SET created_by_name = COALESCE(NULLIF(created_by_name, ''), 'Unknown User')
WHERE created_by_name IS NULL OR btrim(created_by_name) = '';

ALTER TABLE public.case_dates
  ALTER COLUMN created_by_name SET DEFAULT 'Unknown User';

ALTER TABLE public.case_dates
  ALTER COLUMN created_by_name SET NOT NULL;

CREATE INDEX IF NOT EXISTS case_dates_case_file_id_date_value_idx
  ON public.case_dates (case_file_id, date_value, created_at);
