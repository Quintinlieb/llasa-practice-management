-- Case dates table for flexible case timeline tracking per case file.

CREATE TABLE IF NOT EXISTS public.case_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_file_id uuid NOT NULL REFERENCES public.case_files(id) ON DELETE CASCADE,
  date_type text NOT NULL,
  date_value date NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT case_dates_date_type_check CHECK (
    date_type IN (
      'Referral Date',
      'Date of Dismissal',
      'Conciliation Date',
      'Arbitration Date',
      'Labour Court Date',
      'Consultation Date',
      'Next Action Date',
      'Deadline Date'
    )
  )
);

-- Prevent duplicates of the same date type per case file.
CREATE UNIQUE INDEX IF NOT EXISTS case_dates_case_file_id_date_type_key
  ON public.case_dates (case_file_id, date_type);

CREATE INDEX IF NOT EXISTS case_dates_case_file_id_idx
  ON public.case_dates (case_file_id);

CREATE INDEX IF NOT EXISTS case_dates_date_type_idx
  ON public.case_dates (date_type);

CREATE INDEX IF NOT EXISTS case_dates_date_value_idx
  ON public.case_dates (date_value);

-- Keep updated_at fresh.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'set_case_dates_updated_at'
  ) THEN
    CREATE FUNCTION public.set_case_dates_updated_at()
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
    WHERE tgname = 'trg_case_dates_updated_at'
      AND tgrelid = 'public.case_dates'::regclass
  ) THEN
    CREATE TRIGGER trg_case_dates_updated_at
      BEFORE UPDATE ON public.case_dates
      FOR EACH ROW
      EXECUTE FUNCTION public.set_case_dates_updated_at();
  END IF;
END$$;

ALTER TABLE public.case_dates ENABLE ROW LEVEL SECURITY;

-- RLS through parent case_files ownership (user_id = auth.uid()).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_dates'
      AND policyname = 'case_dates_select_own'
  ) THEN
    CREATE POLICY case_dates_select_own
      ON public.case_dates
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = case_dates.case_file_id
            AND cf.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_dates'
      AND policyname = 'case_dates_insert_own'
  ) THEN
    CREATE POLICY case_dates_insert_own
      ON public.case_dates
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = case_dates.case_file_id
            AND cf.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_dates'
      AND policyname = 'case_dates_update_own'
  ) THEN
    CREATE POLICY case_dates_update_own
      ON public.case_dates
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = case_dates.case_file_id
            AND cf.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = case_dates.case_file_id
            AND cf.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_dates'
      AND policyname = 'case_dates_delete_own'
  ) THEN
    CREATE POLICY case_dates_delete_own
      ON public.case_dates
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = case_dates.case_file_id
            AND cf.user_id = auth.uid()
        )
      );
  END IF;
END$$;
