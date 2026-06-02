ALTER TABLE IF EXISTS public.subusers
ADD COLUMN IF NOT EXISTS role text;

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS profile_picture text;

DO $$
DECLARE
  constraint_row record;
BEGIN
  FOR constraint_row IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'subusers'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.subusers DROP CONSTRAINT IF EXISTS %I', constraint_row.conname);
  END LOOP;
END$$;
