-- Update case_documents to support description-based uploads and add storage bucket/policies.

ALTER TABLE public.case_documents
  ADD COLUMN IF NOT EXISTS description text;

UPDATE public.case_documents
SET description = COALESCE(NULLIF(description, ''), NULLIF(document_name, ''), 'Document')
WHERE description IS NULL OR description = '';

ALTER TABLE public.case_documents
  ALTER COLUMN description SET NOT NULL;

ALTER TABLE public.case_documents
  ALTER COLUMN document_category DROP NOT NULL;

ALTER TABLE public.case_documents
  DROP CONSTRAINT IF EXISTS case_documents_document_category_check;

CREATE INDEX IF NOT EXISTS case_documents_description_idx
  ON public.case_documents (description);

INSERT INTO storage.buckets (id, name, public)
VALUES ('case-documents', 'case-documents', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'case_documents_storage_select_authenticated'
  ) THEN
    CREATE POLICY case_documents_storage_select_authenticated
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'case-documents' AND auth.role() = 'authenticated');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'case_documents_storage_insert_authenticated'
  ) THEN
    CREATE POLICY case_documents_storage_insert_authenticated
      ON storage.objects
      FOR INSERT
      WITH CHECK (bucket_id = 'case-documents' AND auth.role() = 'authenticated');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'case_documents_storage_update_authenticated'
  ) THEN
    CREATE POLICY case_documents_storage_update_authenticated
      ON storage.objects
      FOR UPDATE
      USING (bucket_id = 'case-documents' AND auth.role() = 'authenticated')
      WITH CHECK (bucket_id = 'case-documents' AND auth.role() = 'authenticated');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'case_documents_storage_delete_authenticated'
  ) THEN
    CREATE POLICY case_documents_storage_delete_authenticated
      ON storage.objects
      FOR DELETE
      USING (bucket_id = 'case-documents' AND auth.role() = 'authenticated');
  END IF;
END$$;
