-- Ensure employee_number values stay alphanumeric and capped at 8 characters
ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_employee_number_length_check;

UPDATE public.employees
SET employee_number = UPPER(SUBSTRING(REGEXP_REPLACE(employee_number, '[^a-zA-Z0-9]', '', 'g') FOR 8))
WHERE employee_number IS NOT NULL
  AND employee_number <> ''
  AND (
    employee_number ~* '[^a-z0-9]'
    OR char_length(employee_number) > 8
  );

ALTER TABLE public.employees
  ADD CONSTRAINT employees_employee_number_length_check
  CHECK (
    employee_number IS NULL
    OR employee_number = ''
    OR (
      char_length(employee_number) <= 8
      AND employee_number ~* '^[a-z0-9]+$'
    )
  );
