
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tester';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'dokter_spesialis';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'dokter_gigi';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'radiologi';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lab';

-- Tighten user_roles management to super_admin only
DROP POLICY IF EXISTS user_roles_super_admin_manage ON public.user_roles;
DROP POLICY IF EXISTS user_roles_select_auth ON public.user_roles;
DROP POLICY IF EXISTS user_roles_select_self ON public.user_roles;

CREATE POLICY user_roles_select_self
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY user_roles_super_admin_manage
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
