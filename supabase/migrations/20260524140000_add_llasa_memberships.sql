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
      AND s.status IN ('accepted', 'active')
  );
END;
$$;

CREATE TABLE IF NOT EXISTS public.llasa_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organisation text NOT NULL CHECK (organisation IN ('AHI Employers Organisation', 'SABPP', 'SASLAW')),
  description text NOT NULL,
  owner text NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT llasa_memberships_description_not_blank CHECK (length(btrim(description)) > 0),
  CONSTRAINT llasa_memberships_owner_not_blank CHECK (length(btrim(owner)) > 0)
);

CREATE INDEX IF NOT EXISTS llasa_memberships_company_id_idx
  ON public.llasa_memberships (company_id);

CREATE INDEX IF NOT EXISTS llasa_memberships_company_org_idx
  ON public.llasa_memberships (company_id, organisation);

ALTER TABLE public.llasa_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own llasa memberships" ON public.llasa_memberships;
CREATE POLICY "Users can view own llasa memberships"
  ON public.llasa_memberships FOR SELECT
  USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Users can insert own llasa memberships" ON public.llasa_memberships;
CREATE POLICY "Users can insert own llasa memberships"
  ON public.llasa_memberships FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Users can update own llasa memberships" ON public.llasa_memberships;
CREATE POLICY "Users can update own llasa memberships"
  ON public.llasa_memberships FOR UPDATE
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Users can delete own llasa memberships" ON public.llasa_memberships;
CREATE POLICY "Users can delete own llasa memberships"
  ON public.llasa_memberships FOR DELETE
  USING (public.is_company_member(company_id));

DROP TRIGGER IF EXISTS update_llasa_memberships_updated_at ON public.llasa_memberships;
CREATE TRIGGER update_llasa_memberships_updated_at
  BEFORE UPDATE ON public.llasa_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('llasa-memberships', 'llasa-memberships', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'llasa_memberships_storage_select'
  ) THEN
    CREATE POLICY llasa_memberships_storage_select
      ON storage.objects
      FOR SELECT
      USING (
        bucket_id = 'llasa-memberships'
        AND auth.role() = 'authenticated'
        AND array_length(storage.foldername(name), 1) >= 1
        AND public.is_company_member((storage.foldername(name))[1]::uuid)
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'llasa_memberships_storage_insert'
  ) THEN
    CREATE POLICY llasa_memberships_storage_insert
      ON storage.objects
      FOR INSERT
      WITH CHECK (
        bucket_id = 'llasa-memberships'
        AND auth.role() = 'authenticated'
        AND array_length(storage.foldername(name), 1) >= 1
        AND public.is_company_member((storage.foldername(name))[1]::uuid)
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'llasa_memberships_storage_update'
  ) THEN
    CREATE POLICY llasa_memberships_storage_update
      ON storage.objects
      FOR UPDATE
      USING (
        bucket_id = 'llasa-memberships'
        AND auth.role() = 'authenticated'
        AND array_length(storage.foldername(name), 1) >= 1
        AND public.is_company_member((storage.foldername(name))[1]::uuid)
      )
      WITH CHECK (
        bucket_id = 'llasa-memberships'
        AND auth.role() = 'authenticated'
        AND array_length(storage.foldername(name), 1) >= 1
        AND public.is_company_member((storage.foldername(name))[1]::uuid)
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'llasa_memberships_storage_delete'
  ) THEN
    CREATE POLICY llasa_memberships_storage_delete
      ON storage.objects
      FOR DELETE
      USING (
        bucket_id = 'llasa-memberships'
        AND auth.role() = 'authenticated'
        AND array_length(storage.foldername(name), 1) >= 1
        AND public.is_company_member((storage.foldername(name))[1]::uuid)
      );
  END IF;
END$$;
