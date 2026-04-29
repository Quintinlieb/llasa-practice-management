-- Case outcomes table for final results/closure data per case.

CREATE TABLE IF NOT EXISTS public.case_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_file_id uuid NOT NULL REFERENCES public.case_files(id) ON DELETE CASCADE,
  outcome_type text NOT NULL,
  outcome_date date,
  result text,
  amount_awarded numeric(14,2),
  amount_settled numeric(14,2),
  closing_note text,
  closed_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT case_outcomes_outcome_type_check CHECK (
    outcome_type IN (
      'Dismissal Upheld',
      'Settlement',
      'Award Issued',
      'Case Withdrawn',
      'Matter Closed',
      'Consultation Completed',
      'Hearing Finalised'
    )
  ),
  CONSTRAINT case_outcomes_amount_awarded_non_negative_check CHECK (
    amount_awarded IS NULL OR amount_awarded >= 0
  ),
  CONSTRAINT case_outcomes_amount_settled_non_negative_check CHECK (
    amount_settled IS NULL OR amount_settled >= 0
  )
);

-- Usually one final outcome row per case file.
CREATE UNIQUE INDEX IF NOT EXISTS case_outcomes_case_file_id_key
  ON public.case_outcomes (case_file_id);

CREATE INDEX IF NOT EXISTS case_outcomes_outcome_type_idx
  ON public.case_outcomes (outcome_type);

CREATE INDEX IF NOT EXISTS case_outcomes_outcome_date_idx
  ON public.case_outcomes (outcome_date);

CREATE INDEX IF NOT EXISTS case_outcomes_created_at_idx
  ON public.case_outcomes (created_at DESC);

-- Keep updated_at fresh.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'set_case_outcomes_updated_at'
  ) THEN
    CREATE FUNCTION public.set_case_outcomes_updated_at()
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
    WHERE tgname = 'trg_case_outcomes_updated_at'
      AND tgrelid = 'public.case_outcomes'::regclass
  ) THEN
    CREATE TRIGGER trg_case_outcomes_updated_at
      BEFORE UPDATE ON public.case_outcomes
      FOR EACH ROW
      EXECUTE FUNCTION public.set_case_outcomes_updated_at();
  END IF;
END$$;

ALTER TABLE public.case_outcomes ENABLE ROW LEVEL SECURITY;

-- RLS through parent case_files ownership (user_id = auth.uid()).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_outcomes'
      AND policyname = 'case_outcomes_select_own'
  ) THEN
    CREATE POLICY case_outcomes_select_own
      ON public.case_outcomes
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = case_outcomes.case_file_id
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
      AND tablename = 'case_outcomes'
      AND policyname = 'case_outcomes_insert_own'
  ) THEN
    CREATE POLICY case_outcomes_insert_own
      ON public.case_outcomes
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = case_outcomes.case_file_id
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
      AND tablename = 'case_outcomes'
      AND policyname = 'case_outcomes_update_own'
  ) THEN
    CREATE POLICY case_outcomes_update_own
      ON public.case_outcomes
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = case_outcomes.case_file_id
            AND cf.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = case_outcomes.case_file_id
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
      AND tablename = 'case_outcomes'
      AND policyname = 'case_outcomes_delete_own'
  ) THEN
    CREATE POLICY case_outcomes_delete_own
      ON public.case_outcomes
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = case_outcomes.case_file_id
            AND cf.user_id = auth.uid()
        )
      );
  END IF;
END$$;
