ALTER TABLE public.client_file_notes
  DROP CONSTRAINT IF EXISTS client_file_notes_note_type_check;

ALTER TABLE public.client_file_notes
  ADD CONSTRAINT client_file_notes_note_type_check
  CHECK (
    note_type IN (
      'Incoming Call',
      'Outgoing Call',
      'WhatsApp In',
      'WhatsApp Out',
      'Email Received',
      'Email Sent',
      'Consultation'
    )
  );
