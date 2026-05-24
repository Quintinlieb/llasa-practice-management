ALTER TABLE IF EXISTS public.subusers
ADD COLUMN IF NOT EXISTS profile_picture TEXT;
