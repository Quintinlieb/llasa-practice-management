-- Single-tenant mode: allow all authenticated users to access shared case tables,
-- regardless of which authenticated user originally created the row.
DO $$
DECLARE
  table_name text;
  policy_row record;
  target_tables text[] := ARRAY[
    'case_files',
    'case_dates',
    'case_notes',
    'case_tasks',
    'case_outcomes',
    'case_documents'
  ];
BEGIN
  FOREACH table_name IN ARRAY target_tables LOOP
    IF to_regclass(format('public.%s', table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);

    FOR policy_row IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
        AND cmd = 'SELECT'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_row.policyname, table_name);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      table_name || '_select_all_authenticated',
      table_name
    );

    FOR policy_row IN
      SELECT policyname, cmd
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
        AND cmd IN (''INSERT'', ''UPDATE'', ''DELETE'')
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_row.policyname, table_name);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (true)',
      table_name || '_insert_all_authenticated',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)',
      table_name || '_update_all_authenticated',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (true)',
      table_name || '_delete_all_authenticated',
      table_name
    );
  END LOOP;
END
$$;
