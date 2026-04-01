-- Add subscription-related columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'free';
