-- Rename owner-related columns on clients and add contact detail columns.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'owner'
  ) THEN
    ALTER TABLE public.clients RENAME COLUMN owner TO owner_name;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'client_email'
  ) THEN
    ALTER TABLE public.clients RENAME COLUMN client_email TO owner_email;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'tel_cell'
  ) THEN
    ALTER TABLE public.clients RENAME COLUMN tel_cell TO owner_number;
  END IF;
END $$;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS owner_name TEXT,
  ADD COLUMN IF NOT EXISTS owner_email TEXT,
  ADD COLUMN IF NOT EXISTS owner_number TEXT,
  ADD COLUMN IF NOT EXISTS primary_name TEXT,
  ADD COLUMN IF NOT EXISTS primary_number TEXT,
  ADD COLUMN IF NOT EXISTS primary_email TEXT,
  ADD COLUMN IF NOT EXISTS secondary_name TEXT,
  ADD COLUMN IF NOT EXISTS secondary_number TEXT,
  ADD COLUMN IF NOT EXISTS secondary_email TEXT;
