-- Ensure termination-history columns exist so Employees queries don't need runtime fallback.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS termination_reason TEXT,
  ADD COLUMN IF NOT EXISTS previous_job_title TEXT,
  ADD COLUMN IF NOT EXISTS terminated_at DATE;

-- Extension required for fast ILIKE '%...%' lookups.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Core list and sort path for employee table.
CREATE INDEX IF NOT EXISTS employees_company_name_sort_idx
  ON public.employees (company_id, employee_name, employee_surname);

-- Exact-match filters used by the employee table query.
CREATE INDEX IF NOT EXISTS employees_company_status_idx
  ON public.employees (company_id, status);

CREATE INDEX IF NOT EXISTS employees_company_contract_type_idx
  ON public.employees (company_id, contract_type);

-- Trigram indexes for multi-column search fields used with ILIKE '%...%'.
CREATE INDEX IF NOT EXISTS employees_employee_name_trgm_idx
  ON public.employees USING GIN (employee_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS employees_employee_surname_trgm_idx
  ON public.employees USING GIN (employee_surname gin_trgm_ops);

CREATE INDEX IF NOT EXISTS employees_id_number_trgm_idx
  ON public.employees USING GIN (id_number gin_trgm_ops);

CREATE INDEX IF NOT EXISTS employees_employee_number_trgm_idx
  ON public.employees USING GIN (employee_number gin_trgm_ops);

CREATE INDEX IF NOT EXISTS employees_job_title_trgm_idx
  ON public.employees USING GIN (job_title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS employees_branch_trgm_idx
  ON public.employees USING GIN (branch gin_trgm_ops);
