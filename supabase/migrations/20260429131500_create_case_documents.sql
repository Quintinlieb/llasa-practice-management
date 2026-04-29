-- Case documents table for uploaded/linked supporting files per case.

CREATE TABLE IF NOT EXISTS public.case_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_file_id uuid NOT NULL REFERENCES public.case_files(id) ON DELETE CASCADE,
  document_name text NOT NULL,
  document_category text NOT NULL,
  file_url text NOT NULL,
  uploaded_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT case_documents_document_category_check CHECK (
    document_category IN (
      'Referral Forms',
      'Notices of Set Down',
      'Employer Documents',
      'Employee Documents',
      'Witness Statements',
      'Disciplinary Documents',
      'Bundle / Index',
      'Settlement Agreement',
      'Award / Ruling / Order',
      'Correspondence'
    )
  )
);

CREATE INDEX IF NOT EXISTS case_documents_case_file_id_idx
  ON public.case_documents (case_file_id);

CREATE INDEX IF NOT EXISTS case_documents_document_category_idx
  ON public.case_documents (document_category);

CREATE INDEX IF NOT EXISTS case_documents_created_at_idx
  ON public.case_documents (created_at DESC);

-- Keep updated_at fresh.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'set_case_documents_updated_at'
  ) THEN
    CREATE FUNCTION public.set_case_documents_updated_at()
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
    WHERE tgname = 'trg_case_documents_updated_at'
      AND tgrelid = 'public.case_documents'::regclass
  ) THEN
    CREATE TRIGGER trg_case_documents_updated_at
      BEFORE UPDATE ON public.case_documents
      FOR EACH ROW
      EXECUTE FUNCTION public.set_case_documents_updated_at();
  END IF;
END$$;

ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;

-- RLS through parent case_files ownership (user_id = auth.uid()).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_documents'
      AND policyname = 'case_documents_select_own'
  ) THEN
    CREATE POLICY case_documents_select_own
      ON public.case_documents
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = case_documents.case_file_id
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
      AND tablename = 'case_documents'
      AND policyname = 'case_documents_insert_own'
  ) THEN
    CREATE POLICY case_documents_insert_own
      ON public.case_documents
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = case_documents.case_file_id
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
      AND tablename = 'case_documents'
      AND policyname = 'case_documents_update_own'
  ) THEN
    CREATE POLICY case_documents_update_own
      ON public.case_documents
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = case_documents.case_file_id
            AND cf.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = case_documents.case_file_id
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
      AND tablename = 'case_documents'
      AND policyname = 'case_documents_delete_own'
  ) THEN
    CREATE POLICY case_documents_delete_own
      ON public.case_documents
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = case_documents.case_file_id
            AND cf.user_id = auth.uid()
        )
      );
  END IF;
END$$;
