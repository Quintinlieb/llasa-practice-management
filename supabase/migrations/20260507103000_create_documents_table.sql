-- Create a new shared documents registry table for generated documents.
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_name text NOT NULL,
  document_type text NOT NULL,
  client_name text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_by_name text,
  status text NOT NULL DEFAULT 'generated' CHECK (status IN ('draft', 'generated', 'signed', 'archived')),
  file_url text,
  storage_path text,
  generator_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_created_at_idx
  ON public.documents (created_at DESC);

CREATE INDEX IF NOT EXISTS documents_document_type_idx
  ON public.documents (document_type);

CREATE INDEX IF NOT EXISTS documents_client_name_idx
  ON public.documents (client_name);

CREATE INDEX IF NOT EXISTS documents_created_by_idx
  ON public.documents (created_by);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS documents_select_all_authenticated ON public.documents;
DROP POLICY IF EXISTS documents_insert_all_authenticated ON public.documents;
DROP POLICY IF EXISTS documents_update_all_authenticated ON public.documents;
DROP POLICY IF EXISTS documents_delete_all_authenticated ON public.documents;

CREATE POLICY documents_select_all_authenticated
  ON public.documents
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY documents_insert_all_authenticated
  ON public.documents
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY documents_update_all_authenticated
  ON public.documents
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY documents_delete_all_authenticated
  ON public.documents
  FOR DELETE
  TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS trg_documents_updated_at ON public.documents;
CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
