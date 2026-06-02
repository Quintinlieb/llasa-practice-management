DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'main_office_number'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'office_number'
  ) THEN
    ALTER TABLE public.clients RENAME COLUMN main_office_number TO office_number;
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'main_office_number'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'office_number'
  ) THEN
    UPDATE public.clients
    SET office_number = COALESCE(office_number, main_office_number);

    ALTER TABLE public.clients DROP COLUMN main_office_number;
  END IF;
END $$;

ALTER TABLE IF EXISTS public.clients
  ADD COLUMN IF NOT EXISTS office_number text,
  ADD COLUMN IF NOT EXISTS office_email text;
