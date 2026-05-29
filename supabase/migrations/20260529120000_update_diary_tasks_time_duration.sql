ALTER TABLE public.diary_tasks
  DROP CONSTRAINT IF EXISTS diary_tasks_priority_check;

ALTER TABLE public.diary_tasks
  DROP COLUMN IF EXISTS priority,
  ADD COLUMN IF NOT EXISTS task_time time,
  ADD COLUMN IF NOT EXISTS duration text;
