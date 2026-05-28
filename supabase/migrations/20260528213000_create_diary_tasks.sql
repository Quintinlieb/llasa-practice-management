CREATE TABLE IF NOT EXISTS public.diary_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  related_matter_id uuid REFERENCES public.case_files(id) ON DELETE SET NULL,
  diary_date date NOT NULL,
  description text NOT NULL,
  assigned_to_user_id uuid NOT NULL,
  assigned_to_name text NOT NULL,
  priority text NOT NULL DEFAULT 'Medium',
  created_by uuid NOT NULL,
  created_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diary_tasks_priority_check CHECK (priority IN ('Low', 'Medium', 'High'))
);

CREATE INDEX IF NOT EXISTS diary_tasks_company_id_idx
  ON public.diary_tasks (company_id);

CREATE INDEX IF NOT EXISTS diary_tasks_client_id_idx
  ON public.diary_tasks (client_id);

CREATE INDEX IF NOT EXISTS diary_tasks_related_matter_id_idx
  ON public.diary_tasks (related_matter_id);

CREATE INDEX IF NOT EXISTS diary_tasks_diary_date_idx
  ON public.diary_tasks (diary_date);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'set_diary_tasks_updated_at'
  ) THEN
    CREATE FUNCTION public.set_diary_tasks_updated_at()
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
    WHERE tgname = 'trg_diary_tasks_updated_at'
      AND tgrelid = 'public.diary_tasks'::regclass
  ) THEN
    CREATE TRIGGER trg_diary_tasks_updated_at
      BEFORE UPDATE ON public.diary_tasks
      FOR EACH ROW
      EXECUTE FUNCTION public.set_diary_tasks_updated_at();
  END IF;
END$$;

ALTER TABLE public.diary_tasks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'diary_tasks'
      AND policyname = 'diary_tasks_select_company'
  ) THEN
    CREATE POLICY diary_tasks_select_company
      ON public.diary_tasks
      FOR SELECT
      USING (
        company_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.subusers s
          WHERE s.auth_user_id = auth.uid()
            AND s.company_id = diary_tasks.company_id
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'diary_tasks'
      AND policyname = 'diary_tasks_insert_company'
  ) THEN
    CREATE POLICY diary_tasks_insert_company
      ON public.diary_tasks
      FOR INSERT
      WITH CHECK (
        company_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.subusers s
          WHERE s.auth_user_id = auth.uid()
            AND s.company_id = diary_tasks.company_id
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'diary_tasks'
      AND policyname = 'diary_tasks_update_company'
  ) THEN
    CREATE POLICY diary_tasks_update_company
      ON public.diary_tasks
      FOR UPDATE
      USING (
        company_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.subusers s
          WHERE s.auth_user_id = auth.uid()
            AND s.company_id = diary_tasks.company_id
        )
      )
      WITH CHECK (
        company_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.subusers s
          WHERE s.auth_user_id = auth.uid()
            AND s.company_id = diary_tasks.company_id
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'diary_tasks'
      AND policyname = 'diary_tasks_delete_company'
  ) THEN
    CREATE POLICY diary_tasks_delete_company
      ON public.diary_tasks
      FOR DELETE
      USING (
        company_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.subusers s
          WHERE s.auth_user_id = auth.uid()
            AND s.company_id = diary_tasks.company_id
        )
      );
  END IF;
END$$;
