INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'profile_pictures_storage_select'
  ) THEN
    CREATE POLICY profile_pictures_storage_select
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (bucket_id = 'profile-pictures');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'profile_pictures_storage_insert'
  ) THEN
    CREATE POLICY profile_pictures_storage_insert
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'profile-pictures');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'profile_pictures_storage_update'
  ) THEN
    CREATE POLICY profile_pictures_storage_update
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'profile-pictures')
      WITH CHECK (bucket_id = 'profile-pictures');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'profile_pictures_storage_delete'
  ) THEN
    CREATE POLICY profile_pictures_storage_delete
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'profile-pictures');
  END IF;
END$$;
