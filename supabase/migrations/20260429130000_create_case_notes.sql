-- Case notes table for timeline notes, comms, and hearing preparation updates.

CREATE TABLE IF NOT EXISTS public.case_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_file_id uuid NOT NULL REFERENCES public.case_files(id) ON DELETE CASCADE,
  note_type text NOT NULL,
  note_body text NOT NULL,
  added_by text,
  follow_up_required boolean NOT NULL DEFAULT false,
  follow_up_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT case_notes_note_type_check CHECK (
    note_type IN (
      'Consultation',
      'Phone Call',
      'Email',
      'Hearing Prep',
      'Attendance',
      'Outcome',
      'General Update'
    )
  ),
  CONSTRAINT case_notes_follow_up_date_check CHECK (
    (follow_up_required = false)
    OR (follow_up_required = true AND follow_up_date IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS case_notes_case_file_id_idx
  ON public.case_notes (case_file_id);

CREATE INDEX IF NOT EXISTS case_notes_note_type_idx
  ON public.case_notes (note_type);

CREATE INDEX IF NOT EXISTS case_notes_follow_up_date_idx
  ON public.case_notes (follow_up_date);

CREATE INDEX IF NOT EXISTS case_notes_created_at_idx
  ON public.case_notes (created_at DESC);

-- Keep updated_at fresh.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'set_case_notes_updated_at'
  ) THEN
    CREATE FUNCTION public.set_case_notes_updated_at()
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
    WHERE tgname = 'trg_case_notes_updated_at'
      AND tgrelid = 'public.case_notes'::regclass
  ) THEN
    CREATE TRIGGER trg_case_notes_updated_at
      BEFORE UPDATE ON public.case_notes
      FOR EACH ROW
      EXECUTE FUNCTION public.set_case_notes_updated_at();
  END IF;
END$$;

ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;

-- RLS through parent case_files ownership (user_id = auth.uid()).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_notes'
      AND policyname = 'case_notes_select_own'
  ) THEN
    CREATE POLICY case_notes_select_own
      ON public.case_notes
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = case_notes.case_file_id
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
      AND tablename = 'case_notes'
      AND policyname = 'case_notes_insert_own'
  ) THEN
    CREATE POLICY case_notes_insert_own
      ON public.case_notes
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = case_notes.case_file_id
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
      AND tablename = 'case_notes'
      AND policyname = 'case_notes_update_own'
  ) THEN
    CREATE POLICY case_notes_update_own
      ON public.case_notes
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = case_notes.case_file_id
            AND cf.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = case_notes.case_file_id
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
      AND tablename = 'case_notes'
      AND policyname = 'case_notes_delete_own'
  ) THEN
    CREATE POLICY case_notes_delete_own
      ON public.case_notes
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = case_notes.case_file_id
            AND cf.user_id = auth.uid()
        )
      );
  END IF;
END$$;
