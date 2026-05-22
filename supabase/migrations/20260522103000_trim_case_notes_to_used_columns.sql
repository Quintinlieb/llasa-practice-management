-- Remove legacy case_notes columns no longer used by the Matters UI.

DROP INDEX IF EXISTS public.case_notes_note_type_idx;
DROP INDEX IF EXISTS public.case_notes_follow_up_date_idx;

ALTER TABLE public.case_notes
  DROP CONSTRAINT IF EXISTS case_notes_note_type_check,
  DROP CONSTRAINT IF EXISTS case_notes_follow_up_date_check;

ALTER TABLE public.case_notes
  ALTER COLUMN note_date SET NOT NULL,
  ALTER COLUMN note_content SET NOT NULL,
  ALTER COLUMN note_user_name SET NOT NULL;

ALTER TABLE public.case_notes
  DROP COLUMN IF EXISTS note_type,
  DROP COLUMN IF EXISTS note_body,
  DROP COLUMN IF EXISTS added_by,
  DROP COLUMN IF EXISTS follow_up_required,
  DROP COLUMN IF EXISTS follow_up_date;
