-- Add unique constraint on id_number in employees table
ALTER TABLE public.employees ADD CONSTRAINT employees_id_number_unique UNIQUE (id_number);