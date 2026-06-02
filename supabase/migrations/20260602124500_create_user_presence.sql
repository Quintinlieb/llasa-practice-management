CREATE TABLE IF NOT EXISTS public.user_presence (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type text,
  profile_id uuid,
  subuser_id uuid,
  display_name text,
  email text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_presence TO authenticated;

DROP POLICY IF EXISTS user_presence_select_all_authenticated ON public.user_presence;
CREATE POLICY user_presence_select_all_authenticated
ON public.user_presence
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS user_presence_insert_own ON public.user_presence;
CREATE POLICY user_presence_insert_own
ON public.user_presence
FOR INSERT
TO authenticated
WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS user_presence_update_own ON public.user_presence;
CREATE POLICY user_presence_update_own
ON public.user_presence
FOR UPDATE
TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS user_presence_delete_own ON public.user_presence;
CREATE POLICY user_presence_delete_own
ON public.user_presence
FOR DELETE
TO authenticated
USING (auth_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS user_presence_last_seen_at_idx
ON public.user_presence (last_seen_at DESC);
