-- Rename legacy employee_contracts table to membership_contracts.
-- Safe to run multiple times.

DO $$
BEGIN
  -- If new table already exists, nothing to do.
  IF to_regclass('public.membership_contracts') IS NOT NULL THEN
    RETURN;
  END IF;

  -- Rename old table if present.
  IF to_regclass('public.employee_contracts') IS NOT NULL THEN
    ALTER TABLE public.employee_contracts RENAME TO membership_contracts;
  END IF;
END$$;

-- Optional cleanup: rename known trigger names to match the new table naming.
DO $$
BEGIN
  IF to_regclass('public.membership_contracts') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'employee_contracts_deactivate_previous'
      AND tgrelid = 'public.membership_contracts'::regclass
  ) THEN
    ALTER TRIGGER employee_contracts_deactivate_previous
      ON public.membership_contracts
      RENAME TO membership_contracts_deactivate_previous;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_employee_contracts_updated_at'
      AND tgrelid = 'public.membership_contracts'::regclass
  ) THEN
    ALTER TRIGGER update_employee_contracts_updated_at
      ON public.membership_contracts
      RENAME TO update_membership_contracts_updated_at;
  END IF;
END$$;

