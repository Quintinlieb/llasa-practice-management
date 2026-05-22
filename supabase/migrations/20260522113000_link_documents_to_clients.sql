ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS documents_client_id_idx
  ON public.documents (client_id);
