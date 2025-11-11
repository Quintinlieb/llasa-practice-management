-- Replace global unique constraint on employees.id_number with per-company constraint
ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_id_number_unique;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_company_id_id_number_unique UNIQUE (company_id, id_number);

