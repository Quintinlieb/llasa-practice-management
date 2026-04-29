-- Case files table for labour/legal matters (CCMA, Bargaining Council, Labour Court, hearings, consultations).
-- Stores the main fields used by the Case Files list/table.

CREATE TABLE IF NOT EXISTS public.case_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  file_number text NOT NULL,
  client_name text NOT NULL,
  parties text NOT NULL,
  case_type text NOT NULL,
  case_subtype text,
  forum text,
  case_number text,
  consultant text,
  current_stage text,
  status text NOT NULL DEFAULT 'Active',
  priority text NOT NULL DEFAULT 'Medium',
  next_date date,
  last_updated timestamptz NOT NULL DEFAULT now(),
  short_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT case_files_status_check CHECK (
    status IN ('Active', 'Pending', 'Awaiting Documents', 'Set Down', 'Settled', 'Closed', 'Archived')
  ),
  CONSTRAINT case_files_case_type_check CHECK (
    case_type IN (
      'CCMA Case',
      'Bargaining Council Case',
      'Labour Court Matter',
      'Disciplinary Hearing',
      'Incapacity Hearing',
      'Retrenchment Consultation',
      'Poor Performance Consultation',
      'Grievance Consultation'
    )
  )
);

-- Optional uniqueness pattern: one file number per user.
CREATE UNIQUE INDEX IF NOT EXISTS case_files_user_id_file_number_key
  ON public.case_files (user_id, file_number);

CREATE INDEX IF NOT EXISTS case_files_user_id_idx
  ON public.case_files (user_id);

CREATE INDEX IF NOT EXISTS case_files_client_id_idx
  ON public.case_files (client_id);

CREATE INDEX IF NOT EXISTS case_files_status_idx
  ON public.case_files (status);

CREATE INDEX IF NOT EXISTS case_files_case_type_idx
  ON public.case_files (case_type);

CREATE INDEX IF NOT EXISTS case_files_next_date_idx
  ON public.case_files (next_date);

-- Keep timestamps current on updates.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'set_case_files_updated_at'
  ) THEN
    CREATE FUNCTION public.set_case_files_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      NEW.updated_at = now();
      NEW.last_updated = now();
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
    WHERE tgname = 'trg_case_files_updated_at'
      AND tgrelid = 'public.case_files'::regclass
  ) THEN
    CREATE TRIGGER trg_case_files_updated_at
      BEFORE UPDATE ON public.case_files
      FOR EACH ROW
      EXECUTE FUNCTION public.set_case_files_updated_at();
  END IF;
END$$;

ALTER TABLE public.case_files ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_files'
      AND policyname = 'case_files_select_own'
  ) THEN
    CREATE POLICY case_files_select_own
      ON public.case_files
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_files'
      AND policyname = 'case_files_insert_own'
  ) THEN
    CREATE POLICY case_files_insert_own
      ON public.case_files
      FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_files'
      AND policyname = 'case_files_update_own'
  ) THEN
    CREATE POLICY case_files_update_own
      ON public.case_files
      FOR UPDATE
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_files'
      AND policyname = 'case_files_delete_own'
  ) THEN
    CREATE POLICY case_files_delete_own
      ON public.case_files
      FOR DELETE
      USING (user_id = auth.uid());
  END IF;
END$$;
