-- Remove matter reference number from client file notes.
ALTER TABLE public.client_file_notes
DROP COLUMN IF EXISTS matter_reference_number;
