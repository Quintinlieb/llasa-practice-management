-- Remove legacy employee-related tables that are no longer used.
DROP TABLE IF EXISTS public.employee_licences CASCADE;
DROP TABLE IF EXISTS public.employee_id_documents CASCADE;
DROP TABLE IF EXISTS public.employee_education CASCADE;
DROP TABLE IF EXISTS public.employee_warnings CASCADE;
