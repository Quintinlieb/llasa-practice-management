-- Remove employee naming from membership_contracts and standardize on client_id.
-- Safe to run multiple times.

DO $$
BEGIN
  IF to_regclass('public.membership_contracts') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'membership_contracts'
      AND column_name = 'employee_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'membership_contracts'
      AND column_name = 'client_id'
  ) THEN
    ALTER TABLE public.membership_contracts
      RENAME COLUMN employee_id TO client_id;
  END IF;
END$$;

DO $$
BEGIN
  IF to_regclass('public.membership_contracts') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'membership_contracts'
      AND column_name = 'client_id'
  ) THEN
    -- Ensure FK points to clients table.
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.membership_contracts'::regclass
        AND conname = 'membership_contracts_client_id_fkey'
    ) THEN
      ALTER TABLE public.membership_contracts
        ADD CONSTRAINT membership_contracts_client_id_fkey
        FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
    END IF;

    -- Keep active-contract deactivation function aligned.
    CREATE OR REPLACE FUNCTION public.deactivate_previous_membership_contracts()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    BEGIN
      UPDATE public.membership_contracts
      SET is_active = FALSE
      WHERE client_id = NEW.client_id
        AND company_id = NEW.company_id
        AND id <> NEW.id
        AND is_active = TRUE;
      RETURN NEW;
    END;
    $fn$;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'membership_contracts_deactivate_previous'
        AND tgrelid = 'public.membership_contracts'::regclass
    ) THEN
      CREATE TRIGGER membership_contracts_deactivate_previous
        AFTER INSERT ON public.membership_contracts
        FOR EACH ROW
        EXECUTE FUNCTION public.deactivate_previous_membership_contracts();
    END IF;
  END IF;
END$$;

