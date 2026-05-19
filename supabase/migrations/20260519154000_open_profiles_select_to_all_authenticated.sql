-- Single-tenant mode: allow all authenticated users to read master-user profile rows.
DO $$
DECLARE
  policy_row record;
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY';

  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', policy_row.policyname);
  END LOOP;

  EXECUTE '
    CREATE POLICY profiles_select_all_authenticated
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (true)
  ';
END
$$;
