DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own
ON public.notifications
FOR UPDATE
TO authenticated
USING (recipient_user_id = auth.uid() OR actor_user_id = auth.uid())
WITH CHECK (recipient_user_id = auth.uid() OR actor_user_id = auth.uid());

DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own
ON public.notifications
FOR DELETE
TO authenticated
USING (recipient_user_id = auth.uid() OR actor_user_id = auth.uid());
