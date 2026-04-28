DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'bargaining_council'
  ) THEN
    ALTER TABLE public.clients
      ALTER COLUMN bargaining_council SET DEFAULT 'None';

    UPDATE public.clients
    SET bargaining_council = 'None'
    WHERE bargaining_council IS NULL
       OR btrim(bargaining_council) = '';

    ALTER TABLE public.clients
      ALTER COLUMN bargaining_council SET NOT NULL;
  END IF;
END $$;

