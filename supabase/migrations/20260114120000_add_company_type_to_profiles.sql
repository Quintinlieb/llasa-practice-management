-- Add company type to profiles for company setup
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS company_type TEXT NOT NULL DEFAULT '(Pty) Ltd';
