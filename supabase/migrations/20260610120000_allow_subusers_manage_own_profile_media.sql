ALTER TABLE IF EXISTS public.subusers
ADD COLUMN IF NOT EXISTS profile_picture text;

ALTER TABLE IF EXISTS public.subusers
ADD COLUMN IF NOT EXISTS signature_storage_path text;

CREATE OR REPLACE FUNCTION public.protect_subuser_self_update_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.auth_user_id THEN
    NEW.id := OLD.id;
    NEW.company_id := OLD.company_id;
    NEW.auth_user_id := OLD.auth_user_id;
    NEW.invited_by := OLD.invited_by;
    NEW.role := OLD.role;
    NEW.status := OLD.status;
    NEW.invited_at := OLD.invited_at;
    NEW.accepted_at := OLD.accepted_at;
    NEW.created_at := OLD.created_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_subuser_self_update_fields ON public.subusers;
CREATE TRIGGER protect_subuser_self_update_fields
  BEFORE UPDATE ON public.subusers
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_subuser_self_update_fields();

DROP POLICY IF EXISTS "Subusers can view own profile row" ON public.subusers;
CREATE POLICY "Subusers can view own profile row"
  ON public.subusers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "Subusers can update own profile media" ON public.subusers;
CREATE POLICY "Subusers can update own profile media"
  ON public.subusers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);
