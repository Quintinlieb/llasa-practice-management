CREATE OR REPLACE FUNCTION public.get_my_notifications(limit_count integer DEFAULT 12)
RETURNS TABLE (
  id uuid,
  actor_name text,
  body text,
  created_at timestamptz,
  is_read boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    n.id,
    n.actor_name,
    n.body,
    n.created_at,
    n.is_read
  FROM public.notifications AS n
  WHERE n.recipient_user_id = auth.uid()
  ORDER BY n.created_at DESC
  LIMIT GREATEST(COALESCE(limit_count, 12), 0);
$$;

REVOKE ALL ON FUNCTION public.get_my_notifications(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_notifications(integer) TO authenticated;
