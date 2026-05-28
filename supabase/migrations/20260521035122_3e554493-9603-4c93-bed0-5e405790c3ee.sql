
-- ============================================
-- Loop 1: RBAC schema, helpers, and seed
-- ============================================

-- 1. role_permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission_key text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, permission_key)
);
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_permissions_select_all_auth" ON public.role_permissions;
CREATE POLICY "role_permissions_select_all_auth"
  ON public.role_permissions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "role_permissions_admin_write" ON public.role_permissions;
CREATE POLICY "role_permissions_admin_write"
  ON public.role_permissions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP TRIGGER IF EXISTS trg_role_permissions_touch ON public.role_permissions;
CREATE TRIGGER trg_role_permissions_touch
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. user_section_assignments
CREATE TABLE IF NOT EXISTS public.user_section_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  section_name text,
  can_view boolean NOT NULL DEFAULT true,
  can_create boolean NOT NULL DEFAULT false,
  can_update boolean NOT NULL DEFAULT false,
  can_submit boolean NOT NULL DEFAULT false,
  can_approve boolean NOT NULL DEFAULT false,
  can_request_revision boolean NOT NULL DEFAULT false,
  can_upload boolean NOT NULL DEFAULT false,
  can_export boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, section_key)
);
ALTER TABLE public.user_section_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usa_select_self_or_admin" ON public.user_section_assignments;
CREATE POLICY "usa_select_self_or_admin"
  ON public.user_section_assignments FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  );

DROP POLICY IF EXISTS "usa_admin_write" ON public.user_section_assignments;
CREATE POLICY "usa_admin_write"
  ON public.user_section_assignments FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role]));

DROP TRIGGER IF EXISTS trg_usa_touch ON public.user_section_assignments;
CREATE TRIGGER trg_usa_touch
  BEFORE UPDATE ON public.user_section_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_usa_user_active ON public.user_section_assignments(user_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_usa_section ON public.user_section_assignments(section_key);

-- 3. profiles additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS assigned_sections jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS assigned_subteams jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_test_account boolean NOT NULL DEFAULT false;

-- 4. audit_logs additions
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS permission_key text,
  ADD COLUMN IF NOT EXISTS access_result text,
  ADD COLUMN IF NOT EXISTS reason text;

-- 5. has_permission(user, key)
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id
      AND rp.permission_key = _key
      AND rp.allowed = true
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role IN ('super_admin'::app_role, 'tester'::app_role)
  );
$$;

-- 6. user_has_section(user, section, action)
CREATE OR REPLACE FUNCTION public.user_has_section(_user_id uuid, _section text, _action text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v boolean := false;
BEGIN
  IF public.has_any_role(_user_id, ARRAY['super_admin'::app_role, 'tester'::app_role]) THEN
    RETURN true;
  END IF;

  SELECT CASE _action
    WHEN 'view' THEN can_view
    WHEN 'create' THEN can_create
    WHEN 'update' THEN can_update
    WHEN 'submit' THEN can_submit
    WHEN 'approve' THEN can_approve
    WHEN 'request_revision' THEN can_request_revision
    WHEN 'upload' THEN can_upload
    WHEN 'export' THEN can_export
    ELSE false
  END
  INTO v
  FROM public.user_section_assignments
  WHERE user_id = _user_id
    AND section_key = _section
    AND is_active = true
  LIMIT 1;

  RETURN COALESCE(v, false);
END;
$$;

-- 7. log_permission_denied helper
CREATE OR REPLACE FUNCTION public.log_permission_denied(
  _permission_key text,
  _module text DEFAULT NULL,
  _reason text DEFAULT NULL
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.audit_logs (user_id, action, module, permission_key, access_result, reason)
  VALUES (auth.uid(), 'permission_denied', _module, _permission_key, 'denied', _reason);
$$;

-- ============================================
-- 8. Seed default role permissions
-- ============================================
INSERT INTO public.role_permissions (role, permission_key, allowed) VALUES
  -- super_admin & tester: wildcard handled by has_permission shortcut, but seed common keys for visibility
  ('super_admin','*',true),
  ('tester','*',true),

  -- admin
  ('admin','dashboard.view',true),
  ('admin','candidate.view',true),('admin','candidate.create',true),('admin','candidate.update',true),
  ('admin','no_test.view',true),('admin','no_test.create_candidate',true),('admin','no_test.update',true),
  ('admin','no_test.bulk_update',true),('admin','no_test.merge',true),('admin','no_test.delete',true),('admin','no_test.restore',true),
  ('admin','hari_h.view',true),('admin','hari_h.queue.view',true),
  ('admin','hari_h.settings.view',true),('admin','hari_h.settings.update',true),
  ('admin','hari_h.bypass.view',true),('admin','hari_h.bypass.review',true),('admin','hari_h.bypass.create',true),
  ('admin','juknis.view',true),('admin','juknis.create',true),('admin','juknis.update',true),('admin','juknis.delete',true),
  ('admin','export.xlsx',true),('admin','export.pdf',true),('admin','export.draft',true),('admin','export.final',true),
  ('admin','export.history.view',true),
  ('admin','import.view',true),('admin','import.create',true),('admin','import.rollback',true),
  ('admin','audit.view',true),
  ('admin','master_subtim.view',true),('admin','master_subtim.update',true),
  ('admin','section.view_all',true),

  -- kepala_sub_tim
  ('kepala_sub_tim','dashboard.view',true),
  ('kepala_sub_tim','candidate.view',true),
  ('kepala_sub_tim','hari_h.view',true),('kepala_sub_tim','hari_h.queue.view',true),
  ('kepala_sub_tim','section.view_all',true),
  ('kepala_sub_tim','review.view',true),('kepala_sub_tim','review.approve_section',true),('kepala_sub_tim','review.request_revision',true),
  ('kepala_sub_tim','finalization.check',true),('kepala_sub_tim','finalization.create',true),
  ('kepala_sub_tim','hari_h.bypass.view',true),('kepala_sub_tim','hari_h.bypass.review',true),
  ('kepala_sub_tim','export.pdf',true),('kepala_sub_tim','export.xlsx',true),

  -- registrasi
  ('registrasi','dashboard.view',true),
  ('registrasi','candidate.view',true),('registrasi','candidate.create',true),('registrasi','candidate.update',true),
  ('registrasi','no_test.view',true),('registrasi','no_test.create_candidate',true),('registrasi','no_test.update',true),
  ('registrasi','hari_h.view',true),('registrasi','hari_h.queue.view',true),
  ('registrasi','hari_h.screening.view',true),('registrasi','hari_h.screening.update',true),
  ('registrasi','section.anamnesa.view',true),('registrasi','section.anamnesa.update',true),('registrasi','section.anamnesa.submit',true),
  ('registrasi','export.draft',true),

  -- dokter (umum) — base
  ('dokter','dashboard.view',true),
  ('dokter','candidate.view',true),
  ('dokter','hari_h.view',true),('dokter','hari_h.queue.view',true),

  -- dokter_spesialis — base (section-specific via assignment)
  ('dokter_spesialis','dashboard.view',true),
  ('dokter_spesialis','candidate.view',true),
  ('dokter_spesialis','hari_h.view',true),('dokter_spesialis','hari_h.queue.view',true),

  -- dokter_gigi
  ('dokter_gigi','dashboard.view',true),
  ('dokter_gigi','candidate.view',true),
  ('dokter_gigi','hari_h.view',true),('dokter_gigi','hari_h.queue.view',true),
  ('dokter_gigi','section.gilut.view',true),('dokter_gigi','section.gilut.update',true),('dokter_gigi','section.gilut.submit',true),

  -- radiologi
  ('radiologi','dashboard.view',true),
  ('radiologi','candidate.view',true),
  ('radiologi','hari_h.view',true),('radiologi','hari_h.queue.view',true),
  ('radiologi','section.radiology.view',true),('radiologi','section.radiology.update',true),('radiologi','section.radiology.submit',true),
  ('radiologi','section.usg.view',true),('radiologi','section.usg.update',true),('radiologi','section.usg.submit',true),
  ('radiologi','upload.rontgen',true),('radiologi','upload.usg',true),

  -- lab
  ('lab','dashboard.view',true),
  ('lab','candidate.view',true),
  ('lab','hari_h.view',true),('lab','hari_h.queue.view',true),
  ('lab','section.laboratorium.view',true),('lab','section.laboratorium.update',true),('lab','section.laboratorium.submit',true),
  ('lab','upload.lab',true),

  -- viewer
  ('viewer','dashboard.view',true),
  ('viewer','candidate.view',true),
  ('viewer','readonly.all',true),
  ('viewer','audit.view',true)
ON CONFLICT (role, permission_key) DO NOTHING;
