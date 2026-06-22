ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

ALTER TABLE public.case_files
  ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS clients_deleted_idx
  ON public.clients (deleted, deleted_at);

CREATE INDEX IF NOT EXISTS documents_deleted_idx
  ON public.documents (deleted, deleted_at);

CREATE INDEX IF NOT EXISTS case_files_deleted_idx
  ON public.case_files (deleted, deleted_at);
