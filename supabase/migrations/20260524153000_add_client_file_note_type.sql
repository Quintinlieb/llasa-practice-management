ALTER TABLE public.client_file_notes
  ADD COLUMN IF NOT EXISTS note_type text;

UPDATE public.client_file_notes
SET note_type = 'Consultation'
WHERE note_type IS NULL
   OR btrim(note_type) = '';

ALTER TABLE public.client_file_notes
  ALTER COLUMN note_type SET DEFAULT 'Consultation',
  ALTER COLUMN note_type SET NOT NULL;

ALTER TABLE public.client_file_notes
  DROP CONSTRAINT IF EXISTS client_file_notes_note_type_check;

ALTER TABLE public.client_file_notes
  ADD CONSTRAINT client_file_notes_note_type_check
  CHECK (
    note_type IN (
      'Incoming Call',
      'Outgoing Call',
      'Email Received',
      'Email Sent',
      'Consultation'
    )
  );

CREATE INDEX IF NOT EXISTS client_file_notes_note_type_idx
  ON public.client_file_notes (note_type);
