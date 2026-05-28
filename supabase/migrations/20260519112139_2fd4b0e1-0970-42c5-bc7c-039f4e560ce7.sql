
-- Lock down function execution; only authenticated callers via RLS-protected queries should hit these helpers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- Tighten audit_logs insert to require user_id matches caller
DROP POLICY IF EXISTS "audit_insert_auth" ON public.audit_logs;
CREATE POLICY "audit_insert_self" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
