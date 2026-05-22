ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

UPDATE public.profiles
SET auth_user_id = id
WHERE auth_user_id IS NULL;

CREATE INDEX IF NOT EXISTS profiles_auth_user_id_idx
  ON public.profiles (auth_user_id);
