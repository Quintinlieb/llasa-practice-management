ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS file_url text;
