-- 1) Helper: section keys per role
CREATE OR REPLACE FUNCTION public.can_write_rikkes_group(_user_id uuid, _group_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Full access roles
    public.has_any_role(_user_id, ARRAY['super_admin','admin','kepala_sub_tim','tester','registrasi']::app_role[])
    OR
    -- Dokter Umum: only general sections
    (
      public.has_role(_user_id, 'dokter_umum'::app_role)
      AND _group_key IN ('identitas_anamnesis','screening_hari_h','lembar_evaluasi_umum')
    )
    OR
    -- Legacy 'dokter' role: keep broad access for backward compatibility
    public.has_role(_user_id, 'dokter'::app_role)
    OR
    -- Subtim-specific roles
    (public.has_role(_user_id, 'dokter_spesialis'::app_role) AND _group_key IN ('evaluasi_klinis','mata_tht','tht_subtim','mata_visus_subtim','bedah_subtim','neurologi_subtim','psikologi_subtim'))
    OR
    (public.has_role(_user_id, 'dokter_gigi'::app_role) AND _group_key = 'gigi_odontogram')
    OR
    (public.has_role(_user_id, 'radiologi'::app_role) AND _group_key IN ('penunjang'))
    OR
    (public.has_role(_user_id, 'lab'::app_role) AND _group_key = 'laboratorium')
$$;

-- 2) Replace rikkes_form_sections write policy with group-aware variant
DROP POLICY IF EXISTS rfs_staff_write ON public.rikkes_form_sections;
CREATE POLICY rfs_staff_write ON public.rikkes_form_sections
  TO authenticated
  USING (public.can_write_rikkes_group(auth.uid(), group_key))
  WITH CHECK (public.can_write_rikkes_group(auth.uid(), group_key));

-- 3) Update is_general_writer to include dokter_umum (for screening/measurements writes)
CREATE OR REPLACE FUNCTION public.is_general_writer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(_user_id, ARRAY[
    'super_admin'::app_role, 'admin'::app_role, 'tester'::app_role,
    'dokter'::app_role, 'dokter_umum'::app_role,
    'kepala_sub_tim'::app_role, 'registrasi'::app_role
  ])
$$;

-- 4) Seed role_permissions for dokter_umum (idempotent)
INSERT INTO public.role_permissions (role, permission_key, allowed)
SELECT 'dokter_umum'::app_role, k, true
FROM unnest(ARRAY[
  'dashboard.view',
  'harih.view',
  'hari_h.view',
  'hari_h.queue.view',
  'candidates.view_limited',
  'candidate.view',
  'candidate_detail.view',
  'form.identity.view',
  'form.identity.update',
  'form.screening.view',
  'form.screening.update',
  'form.general.view',
  'form.general.update',
  'ekg.status.view',
  'rontgen.status.view',
  'docs.help',
  'docs.sop',
  'anamnesis.doctor.view',
  'anamnesis.doctor.add_note',
  'anamnesis.doctor.request_clarification',
  'anamnesis.doctor.review',
  'anamnesis.doctor.set_clear',
  'anamnesis.doctor.sign',
  'anamnesis.doctor.submit_review'
]) AS k
ON CONFLICT (role, permission_key) DO UPDATE SET allowed = EXCLUDED.allowed;

-- 5) Audit trigger for role changes
CREATE OR REPLACE FUNCTION public.audit_user_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, module, record_id, after_data)
    VALUES (auth.uid(), 'role_assigned', 'User Management', NEW.user_id,
            jsonb_build_object('user_id', NEW.user_id, 'role', NEW.role));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, module, record_id, before_data)
    VALUES (auth.uid(), 'role_revoked', 'User Management', OLD.user_id,
            jsonb_build_object('user_id', OLD.user_id, 'role', OLD.role));
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_user_role_change ON public.user_roles;
CREATE TRIGGER trg_audit_user_role_change
  AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_user_role_change();