-- Simplify matter statuses to Active / Inactive only.

UPDATE public.case_files
SET status = CASE
  WHEN lower(coalesce(status, '')) = 'active' THEN 'Active'
  ELSE 'Inactive'
END;

ALTER TABLE public.case_files
  DROP CONSTRAINT IF EXISTS case_files_status_check;

ALTER TABLE public.case_files
  ADD CONSTRAINT case_files_status_check CHECK (
    status IN ('Active', 'Inactive')
  );
