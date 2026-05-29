ALTER TABLE public.diary_tasks
  DROP CONSTRAINT IF EXISTS diary_tasks_task_type_check;

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
