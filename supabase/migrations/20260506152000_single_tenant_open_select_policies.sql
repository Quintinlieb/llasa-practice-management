-- Single-tenant mode: allow all authenticated users to read shared data
-- without user-linked company scoping.
DO $$
DECLARE
  table_name text;
  policy_row record;
  target_tables text[] := ARRAY[
    'clients',
    'subusers',
    'client_groups',
    'client_file_notes',
    'membership_contracts',
    'client_logos'
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
  END LOOP;
END
$$;

