ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS primary_job_title TEXT,
  ADD COLUMN IF NOT EXISTS secondary_job_title TEXT;
