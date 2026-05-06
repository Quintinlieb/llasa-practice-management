CREATE TABLE IF NOT EXISTS public.client_file_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  note_date date NOT NULL,
  matter_reference_number text,
  note_content text NOT NULL,
  note_user_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_file_notes_company_client_idx
  ON public.client_file_notes (company_id, client_id, note_date DESC);

CREATE INDEX IF NOT EXISTS client_file_notes_user_idx
  ON public.client_file_notes (note_user_name);

CREATE INDEX IF NOT EXISTS client_file_notes_matter_ref_idx
  ON public.client_file_notes (matter_reference_number);

CREATE OR REPLACE FUNCTION public.set_client_file_notes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_file_notes_updated_at ON public.client_file_notes;

CREATE TRIGGER trg_client_file_notes_updated_at
BEFORE UPDATE ON public.client_file_notes
FOR EACH ROW
EXECUTE FUNCTION public.set_client_file_notes_updated_at();

ALTER TABLE public.client_file_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company users can read client file notes" ON public.client_file_notes;
CREATE POLICY "Company users can read client file notes"
ON public.client_file_notes
FOR SELECT
USING (auth.uid() = company_id);

DROP POLICY IF EXISTS "Company users can insert client file notes" ON public.client_file_notes;
CREATE POLICY "Company users can insert client file notes"
ON public.client_file_notes
FOR INSERT
WITH CHECK (auth.uid() = company_id);

DROP POLICY IF EXISTS "Company users can update client file notes" ON public.client_file_notes;
CREATE POLICY "Company users can update client file notes"
ON public.client_file_notes
FOR UPDATE
USING (auth.uid() = company_id)
WITH CHECK (auth.uid() = company_id);

DROP POLICY IF EXISTS "Company users can delete client file notes" ON public.client_file_notes;
CREATE POLICY "Company users can delete client file notes"
ON public.client_file_notes
FOR DELETE
USING (auth.uid() = company_id);
