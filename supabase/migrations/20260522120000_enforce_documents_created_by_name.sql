UPDATE public.documents
SET created_by_name = 'Unknown User'
WHERE created_by_name IS NULL OR btrim(created_by_name) = '';

ALTER TABLE public.documents
  ALTER COLUMN created_by_name SET DEFAULT 'Unknown User';

ALTER TABLE public.documents
  ALTER COLUMN created_by_name SET NOT NULL;
