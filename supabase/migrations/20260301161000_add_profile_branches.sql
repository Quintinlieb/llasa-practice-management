ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS branches_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS branches text[] NOT NULL DEFAULT '{}'::text[];
