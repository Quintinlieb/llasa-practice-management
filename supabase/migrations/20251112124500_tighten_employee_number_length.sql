-- Reduce employee_number length limit from 8 characters to 7
ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_employee_number_length_check;

UPDATE public.employees
SET employee_number = UPPER(SUBSTRING(REGEXP_REPLACE(employee_number, '[^a-zA-Z0-9]', '', 'g') FOR 7))
WHERE employee_number IS NOT NULL
  AND employee_number <> ''
  AND (
    employee_number ~* '[^a-z0-9]'
    OR char_length(employee_number) > 7
  );

ALTER TABLE public.employees
  ADD CONSTRAINT employees_employee_number_length_check
  CHECK (
    employee_number IS NULL
    OR employee_number = ''
    OR (
      char_length(employee_number) <= 7
      AND employee_number ~* '^[a-z0-9]+$'
    )
  );
