-- Cleanup migration: rename legacy client_logos constraint/index names
-- that still contain "employee_id" to "client_id".
-- Scoped to public.client_logos only.

DO $$
DECLARE
  rec record;
  next_name text;
BEGIN
  IF to_regclass('public.client_logos') IS NULL THEN
    RAISE NOTICE 'Table public.client_logos does not exist; skipping constraint rename cleanup.';
    RETURN;
  END IF;

  FOR rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.client_logos'::regclass
      AND position('employee_id' in conname) > 0
  LOOP
    next_name := replace(rec.conname, 'employee_id', 'client_id');

    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.client_logos'::regclass
        AND conname = next_name
    ) THEN
      RAISE NOTICE 'Constraint target name % already exists; skipping %.', next_name, rec.conname;
    ELSE
      EXECUTE format(
        'ALTER TABLE public.client_logos RENAME CONSTRAINT %I TO %I',
        rec.conname,
        next_name
      );
    END IF;
  END LOOP;
END
$$;

DO $$
DECLARE
  rec record;
  next_name text;
BEGIN
  IF to_regclass('public.client_logos') IS NULL THEN
    RAISE NOTICE 'Table public.client_logos does not exist; skipping index rename cleanup.';
    RETURN;
  END IF;

  FOR rec IN
    SELECT c.relname AS index_name
    FROM pg_index i
    JOIN pg_class c
      ON c.oid = i.indexrelid
    WHERE i.indrelid = 'public.client_logos'::regclass
      AND position('employee_id' in c.relname) > 0
  LOOP
    next_name := replace(rec.index_name, 'employee_id', 'client_id');

    IF to_regclass(format('public.%I', next_name)) IS NOT NULL THEN
      RAISE NOTICE 'Index target name % already exists; skipping %.', next_name, rec.index_name;
    ELSE
      EXECUTE format('ALTER INDEX %I RENAME TO %I', rec.index_name, next_name);
    END IF;
  END LOOP;
END
$$;

