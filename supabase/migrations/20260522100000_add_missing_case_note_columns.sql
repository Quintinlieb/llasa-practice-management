-- Bring case_notes in line with the fields used by the Matters UI.

ALTER TABLE public.case_notes
  ADD COLUMN IF NOT EXISTS note_date date,
  ADD COLUMN IF NOT EXISTS note_content text,
  ADD COLUMN IF NOT EXISTS note_user_name text;

UPDATE public.case_notes
SET
  note_date = COALESCE(note_date, created_at::date),
  note_content = COALESCE(NULLIF(note_content, ''), note_body),
  note_user_name = COALESCE(NULLIF(note_user_name, ''), NULLIF(added_by, ''), 'Unknown User')
WHERE note_date IS NULL
   OR note_content IS NULL
   OR btrim(note_content) = ''
   OR note_user_name IS NULL
   OR btrim(note_user_name) = '';

CREATE INDEX IF NOT EXISTS case_notes_note_date_idx
  ON public.case_notes (note_date DESC);

CREATE INDEX IF NOT EXISTS case_notes_note_user_name_idx
  ON public.case_notes (note_user_name);
