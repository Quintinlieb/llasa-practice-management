CREATE TABLE IF NOT EXISTS public.llasa_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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

ALTER TABLE public.llasa_memberships
  DROP COLUMN IF EXISTS company_id;

CREATE INDEX IF NOT EXISTS llasa_memberships_organisation_idx
  ON public.llasa_memberships (organisation);

CREATE INDEX IF NOT EXISTS llasa_memberships_uploaded_by_idx
  ON public.llasa_memberships (uploaded_by);

ALTER TABLE public.llasa_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own llasa memberships" ON public.llasa_memberships;
CREATE POLICY "Users can view own llasa memberships"
  ON public.llasa_memberships FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert own llasa memberships" ON public.llasa_memberships;
CREATE POLICY "Users can insert own llasa memberships"
  ON public.llasa_memberships FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "Users can update own llasa memberships" ON public.llasa_memberships;
CREATE POLICY "Users can update own llasa memberships"
  ON public.llasa_memberships FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()))
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid())
    AND auth.uid() = uploaded_by
  );

DROP POLICY IF EXISTS "Users can delete own llasa memberships" ON public.llasa_memberships;
CREATE POLICY "Users can delete own llasa memberships"
  ON public.llasa_memberships FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()));

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
      TO authenticated
      USING (bucket_id = 'llasa-memberships');
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
      TO authenticated
      WITH CHECK (bucket_id = 'llasa-memberships');
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
      TO authenticated
      USING (
        bucket_id = 'llasa-memberships'
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid())
      )
      WITH CHECK (
        bucket_id = 'llasa-memberships'
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid())
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
      TO authenticated
      USING (
        bucket_id = 'llasa-memberships'
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid())
      );
  END IF;
END$$;
