-- Add domestic profile fields
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS domestic_name TEXT,
ADD COLUMN IF NOT EXISTS domestic_surname TEXT,
ADD COLUMN IF NOT EXISTS domestic_id_number TEXT,
ADD COLUMN IF NOT EXISTS domestic_contact TEXT,
ADD COLUMN IF NOT EXISTS domestic_email TEXT;
