-- Allow accepted subusers to access employee_warnings records for their linked company.

CREATE OR REPLACE FUNCTION public.is_company_member(target_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() = target_company_id
    OR EXISTS (
      SELECT 1
      FROM public.subusers s
      WHERE s.company_id = target_company_id
        AND s.auth_user_id = auth.uid()
        AND s.status = 'accepted'
    );
$$;

DO $$
BEGIN
  IF to_regclass('public.employee_warnings') IS NOT NULL THEN
    ALTER TABLE public.employee_warnings ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can view own employee warnings" ON public.employee_warnings;
    DROP POLICY IF EXISTS "Users can insert own employee warnings" ON public.employee_warnings;
    DROP POLICY IF EXISTS "Users can update own employee warnings" ON public.employee_warnings;
    DROP POLICY IF EXISTS "Users can delete own employee warnings" ON public.employee_warnings;

    CREATE POLICY "Users can view own employee warnings"
      ON public.employee_warnings
      FOR SELECT
      USING (public.is_company_member(company_id));

    CREATE POLICY "Users can insert own employee warnings"
      ON public.employee_warnings
      FOR INSERT
      WITH CHECK (public.is_company_member(company_id));

    CREATE POLICY "Users can update own employee warnings"
      ON public.employee_warnings
      FOR UPDATE
      USING (public.is_company_member(company_id))
      WITH CHECK (public.is_company_member(company_id));

    CREATE POLICY "Users can delete own employee warnings"
      ON public.employee_warnings
      FOR DELETE
      USING (public.is_company_member(company_id));
  END IF;
END;
$$;

