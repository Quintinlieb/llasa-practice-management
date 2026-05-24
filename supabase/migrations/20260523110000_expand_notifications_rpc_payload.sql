CREATE OR REPLACE FUNCTION public.get_my_notifications_for_user(
  target_user_id uuid,
  limit_count integer DEFAULT 12
)
RETURNS TABLE (
  id uuid,
  recipient_user_id uuid,
  actor_name text,
  body text,
  created_at timestamptz,
  is_read boolean,
  source_table text,
  source_record_id uuid,
  source_parent_id uuid,
  metadata jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    n.id,
    n.recipient_user_id,
    n.actor_name,
    n.body,
    n.created_at,
    n.is_read,
    n.source_table,
    n.source_record_id,
    n.source_parent_id,
    n.metadata
  FROM public.notifications AS n
  WHERE target_user_id = auth.uid()
    AND n.recipient_user_id = target_user_id
  ORDER BY n.created_at DESC
  LIMIT GREATEST(COALESCE(limit_count, 12), 0);
$$;

REVOKE ALL ON FUNCTION public.get_my_notifications_for_user(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_notifications_for_user(uuid, integer) TO authenticated;
