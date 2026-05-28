ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS signature_storage_path text;

ALTER TABLE IF EXISTS public.subusers
ADD COLUMN IF NOT EXISTS signature_storage_path text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('user-signatures', 'user-signatures', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'user_signatures_storage_select'
  ) THEN
    CREATE POLICY user_signatures_storage_select
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (bucket_id = 'user-signatures');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'user_signatures_storage_insert'
  ) THEN
    CREATE POLICY user_signatures_storage_insert
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'user-signatures');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'user_signatures_storage_update'
  ) THEN
    CREATE POLICY user_signatures_storage_update
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'user-signatures')
      WITH CHECK (bucket_id = 'user-signatures');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'user_signatures_storage_delete'
  ) THEN
    CREATE POLICY user_signatures_storage_delete
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'user-signatures');
  END IF;
END$$;
