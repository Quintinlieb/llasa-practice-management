ALTER TABLE public.diary_tasks
  ADD COLUMN IF NOT EXISTS task_type text;

UPDATE public.diary_tasks
SET task_type = 'General Admin'
WHERE task_type IS NULL OR btrim(task_type) = '';

ALTER TABLE public.diary_tasks
  ALTER COLUMN task_type SET DEFAULT 'General Admin';

ALTER TABLE public.diary_tasks
  ALTER COLUMN task_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'diary_tasks_task_type_check'
      AND conrelid = 'public.diary_tasks'::regclass
  ) THEN
    ALTER TABLE public.diary_tasks
      ADD CONSTRAINT diary_tasks_task_type_check CHECK (
        task_type IN (
          'Case Preparation',
          'Check Deadline',
          'Client Update',
          'Consultation',
          'Draft Document',
          'Email / Correspondence',
          'Follow-Up',
          'General Admin',
          'Invoice / Accounts',
          'Internal Review',
          'Phone Call',
          'Prepare Bundle',
          'Request Information',
          'Review Document',
          'Schedule Meeting',
          'Submit / File Document'
        )
      );
  END IF;
END$$;
