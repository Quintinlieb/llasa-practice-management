CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL,
  actor_user_id uuid,
  actor_name text,
  notification_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  source_table text,
  source_record_id uuid,
  source_parent_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_type_check CHECK (
    notification_type IN ('mention')
  ),
  CONSTRAINT notifications_read_at_check CHECK (
    (is_read = false AND read_at IS NULL)
    OR (is_read = true)
  )
);

CREATE INDEX IF NOT EXISTS notifications_recipient_created_at_idx
  ON public.notifications (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_recipient_is_read_idx
  ON public.notifications (recipient_user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_source_lookup_idx
  ON public.notifications (source_table, source_record_id);

CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_source_idx
  ON public.notifications (recipient_user_id, notification_type, source_table, source_record_id)
  WHERE source_table IS NOT NULL AND source_record_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_notifications_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON public.notifications;

CREATE TRIGGER trg_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.set_notifications_updated_at();

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own
ON public.notifications
FOR SELECT
TO authenticated
USING (recipient_user_id = auth.uid());

DROP POLICY IF EXISTS notifications_insert_authenticated ON public.notifications;
CREATE POLICY notifications_insert_authenticated
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own
ON public.notifications
FOR UPDATE
TO authenticated
USING (recipient_user_id = auth.uid())
WITH CHECK (recipient_user_id = auth.uid());

DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own
ON public.notifications
FOR DELETE
TO authenticated
USING (recipient_user_id = auth.uid());
