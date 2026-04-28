-- Ensure public.client_logos supports client-based logo storage used by Clients.tsx
-- Safe to run multiple times.

DO $$
BEGIN
  IF to_regclass('public.client_logos') IS NULL THEN
    CREATE TABLE public.client_logos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id uuid NOT NULL,
      client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
      company_logo_url text,
      logo_url text,
      logo_path text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END$$;

-- Legacy compatibility: if an old employee_id column still exists, migrate data.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_logos'
      AND column_name = 'employee_id'
  ) THEN
    -- Backfill client_id from employee_id when needed.
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'client_logos'
        AND column_name = 'client_id'
    ) THEN
      EXECUTE '
        UPDATE public.client_logos
        SET client_id = employee_id
        WHERE client_id IS NULL AND employee_id IS NOT NULL
      ';
    END IF;
  END IF;
END$$;

-- Required columns for current app logic.
ALTER TABLE public.client_logos
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS company_logo_url text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS logo_path text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Ensure foreign key from client_id -> clients(id).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'client_logos'
      AND column_name = 'client_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.client_logos'::regclass
        AND conname = 'client_logos_client_id_fkey'
    ) THEN
      ALTER TABLE public.client_logos
        ADD CONSTRAINT client_logos_client_id_fkey
        FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
    END IF;
  END IF;
END$$;

-- One logo row per client.
CREATE UNIQUE INDEX IF NOT EXISTS client_logos_client_id_key
  ON public.client_logos (client_id);

-- Useful lookup index for RLS-scoped queries.
CREATE INDEX IF NOT EXISTS client_logos_company_id_idx
  ON public.client_logos (company_id);

-- Keep updated_at fresh.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'set_client_logos_updated_at'
  ) THEN
    CREATE FUNCTION public.set_client_logos_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_client_logos_updated_at'
      AND tgrelid = 'public.client_logos'::regclass
  ) THEN
    CREATE TRIGGER trg_client_logos_updated_at
      BEFORE UPDATE ON public.client_logos
      FOR EACH ROW
      EXECUTE FUNCTION public.set_client_logos_updated_at();
  END IF;
END$$;

-- RLS for per-company access.
ALTER TABLE public.client_logos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'client_logos'
      AND policyname = 'client_logos_select_own_company'
  ) THEN
    CREATE POLICY client_logos_select_own_company
      ON public.client_logos
      FOR SELECT
      USING (company_id = auth.uid());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'client_logos'
      AND policyname = 'client_logos_insert_own_company'
  ) THEN
    CREATE POLICY client_logos_insert_own_company
      ON public.client_logos
      FOR INSERT
      WITH CHECK (company_id = auth.uid());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'client_logos'
      AND policyname = 'client_logos_update_own_company'
  ) THEN
    CREATE POLICY client_logos_update_own_company
      ON public.client_logos
      FOR UPDATE
      USING (company_id = auth.uid())
      WITH CHECK (company_id = auth.uid());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'client_logos'
      AND policyname = 'client_logos_delete_own_company'
  ) THEN
    CREATE POLICY client_logos_delete_own_company
      ON public.client_logos
      FOR DELETE
      USING (company_id = auth.uid());
  END IF;
END$$;

