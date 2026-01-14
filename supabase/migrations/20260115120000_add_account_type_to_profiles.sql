-- Add account type to profiles for signup selection
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'domestic';
