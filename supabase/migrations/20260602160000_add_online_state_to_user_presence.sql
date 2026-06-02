ALTER TABLE public.user_presence
  ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signed_out_at timestamptz;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.user_presence
TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS user_presence_is_online_idx
ON public.user_presence (is_online, last_seen_at DESC);
