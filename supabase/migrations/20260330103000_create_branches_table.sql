-- Create a normalized branches table (one row per branch, scoped by tenant/company).
-- Allows duplicate branch names across different tenants, but not within the same tenant.

CREATE OR REPLACE FUNCTION public.is_company_member(target_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF current_user_id = target_company_id THEN
    RETURN true;
  END IF;

  IF to_regclass('public.subusers') IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.subusers s
    WHERE s.company_id = target_company_id
      AND s.auth_user_id = current_user_id
      AND s.status = 'accepted'
  );
END;
$$;

CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT GENERATED ALWAYS AS (
    regexp_replace(lower(btrim(name)), '\s+', ' ', 'g')
  ) STORED,
  address_line1 TEXT NOT NULL DEFAULT '',
  address_line2 TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  province TEXT NOT NULL DEFAULT '',
  area_code TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT branches_name_not_blank CHECK (length(btrim(name)) > 0)
);

-- Tenant-scoped uniqueness for branch names (case/spacing insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS branches_company_normalized_name_uidx
  ON public.branches (company_id, normalized_name);

-- Helpful query indexes.
CREATE INDEX IF NOT EXISTS branches_company_id_idx
  ON public.branches (company_id);

CREATE INDEX IF NOT EXISTS branches_company_name_idx
  ON public.branches (company_id, name);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own branches" ON public.branches;
CREATE POLICY "Users can view own branches"
  ON public.branches FOR SELECT
  USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Users can insert own branches" ON public.branches;
CREATE POLICY "Users can insert own branches"
  ON public.branches FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Users can update own branches" ON public.branches;
CREATE POLICY "Users can update own branches"
  ON public.branches FOR UPDATE
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Users can delete own branches" ON public.branches;
CREATE POLICY "Users can delete own branches"
  ON public.branches FOR DELETE
  USING (public.is_company_member(company_id));

DROP TRIGGER IF EXISTS update_branches_updated_at ON public.branches;
CREATE TRIGGER update_branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
