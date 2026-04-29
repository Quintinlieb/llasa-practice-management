-- Case tasks table for internal work items linked to a case file.

CREATE TABLE IF NOT EXISTS public.case_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_file_id uuid NOT NULL REFERENCES public.case_files(id) ON DELETE CASCADE,
  task_title text NOT NULL,
  task_description text,
  assigned_to text,
  due_date date,
  priority text NOT NULL DEFAULT 'Medium',
  status text NOT NULL DEFAULT 'Open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT case_tasks_status_check CHECK (
    status IN ('Open', 'In Progress', 'Completed', 'Cancelled')
  ),
  CONSTRAINT case_tasks_priority_check CHECK (
    priority IN ('Low', 'Medium', 'High', 'Urgent')
  )
);

CREATE INDEX IF NOT EXISTS case_tasks_case_file_id_idx
  ON public.case_tasks (case_file_id);

CREATE INDEX IF NOT EXISTS case_tasks_status_idx
  ON public.case_tasks (status);

CREATE INDEX IF NOT EXISTS case_tasks_priority_idx
  ON public.case_tasks (priority);

CREATE INDEX IF NOT EXISTS case_tasks_due_date_idx
  ON public.case_tasks (due_date);

CREATE INDEX IF NOT EXISTS case_tasks_created_at_idx
  ON public.case_tasks (created_at DESC);

-- Keep updated_at fresh.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'set_case_tasks_updated_at'
  ) THEN
    CREATE FUNCTION public.set_case_tasks_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_case_tasks_updated_at'
      AND tgrelid = 'public.case_tasks'::regclass
  ) THEN
    CREATE TRIGGER trg_case_tasks_updated_at
      BEFORE UPDATE ON public.case_tasks
      FOR EACH ROW
      EXECUTE FUNCTION public.set_case_tasks_updated_at();
  END IF;
END$$;

ALTER TABLE public.case_tasks ENABLE ROW LEVEL SECURITY;

-- RLS through parent case_files ownership (user_id = auth.uid()).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_tasks'
      AND policyname = 'case_tasks_select_own'
  ) THEN
    CREATE POLICY case_tasks_select_own
      ON public.case_tasks
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = case_tasks.case_file_id
            AND cf.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_tasks'
      AND policyname = 'case_tasks_insert_own'
  ) THEN
    CREATE POLICY case_tasks_insert_own
      ON public.case_tasks
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = case_tasks.case_file_id
            AND cf.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_tasks'
      AND policyname = 'case_tasks_update_own'
  ) THEN
    CREATE POLICY case_tasks_update_own
      ON public.case_tasks
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = case_tasks.case_file_id
            AND cf.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = case_tasks.case_file_id
            AND cf.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_tasks'
      AND policyname = 'case_tasks_delete_own'
  ) THEN
    CREATE POLICY case_tasks_delete_own
      ON public.case_tasks
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = case_tasks.case_file_id
            AND cf.user_id = auth.uid()
        )
      );
  END IF;
END$$;
