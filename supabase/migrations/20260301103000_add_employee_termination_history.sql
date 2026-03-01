ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS termination_reason TEXT,
  ADD COLUMN IF NOT EXISTS previous_job_title TEXT,
  ADD COLUMN IF NOT EXISTS terminated_at DATE;
