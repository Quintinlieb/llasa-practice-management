-- Fix client_logos linkage: employee_id -> client_id, and FK -> public.clients(id)
-- Safe to run multiple times.

DO $$
BEGIN
  IF to_regclass('public.client_logos') IS NULL THEN
    RAISE NOTICE 'Table public.client_logos does not exist; skipping migration.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_logos'
      AND column_name = 'employee_id'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_logos'
      AND column_name = 'client_id'
  ) THEN
    ALTER TABLE public.client_logos
      RENAME COLUMN employee_id TO client_id;
  END IF;
END
$$;

DO $$
DECLARE
  rec record;
BEGIN
  IF to_regclass('public.client_logos') IS NULL THEN
    RETURN;
  END IF;

  -- Drop FK constraints bound to employee_id/client_id so we can rebind cleanly.
  FOR rec IN
    SELECT DISTINCT c.conname
    FROM pg_constraint c
    JOIN pg_class t
      ON t.oid = c.conrelid
    JOIN pg_namespace n
      ON n.oid = t.relnamespace
    JOIN unnest(c.conkey) AS ck(attnum)
      ON TRUE
    JOIN pg_attribute a
      ON a.attrelid = t.oid
     AND a.attnum = ck.attnum
    WHERE n.nspname = 'public'
      AND t.relname = 'client_logos'
      AND c.contype = 'f'
      AND a.attname IN ('employee_id', 'client_id')
  LOOP
    EXECUTE format('ALTER TABLE public.client_logos DROP CONSTRAINT IF EXISTS %I', rec.conname);
  END LOOP;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.client_logos') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_logos'
      AND column_name = 'client_id'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.client_logos'::regclass
      AND conname = 'client_logos_client_id_fkey'
  ) THEN
    ALTER TABLE public.client_logos
      ADD CONSTRAINT client_logos_client_id_fkey
      FOREIGN KEY (client_id)
      REFERENCES public.clients(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

