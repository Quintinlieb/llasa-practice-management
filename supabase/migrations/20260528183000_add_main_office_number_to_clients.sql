ALTER TABLE IF EXISTS public.clients
ADD COLUMN IF NOT EXISTS main_office_number text;
