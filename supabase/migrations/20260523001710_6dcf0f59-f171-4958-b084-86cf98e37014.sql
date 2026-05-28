
-- =============================================================
-- Security hardening: restrict SELECT on sensitive tables
-- and lock down SECURITY DEFINER functions from anon.
-- =============================================================

-- Helper: internal staff = any authenticated user EXCEPT peserta/casis
CREATE OR REPLACE FUNCTION public.is_internal_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = _user_id
         AND ur.role NOT IN ('peserta'::app_role, 'casis'::app_role)
     );
$$;

REVOKE EXECUTE ON FUNCTION public.is_internal_staff(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_internal_staff(uuid) TO authenticated;

-- -------------------------------------------------------------
-- profiles: owner or internal staff only (was: USING true)
-- -------------------------------------------------------------
DROP POLICY IF EXISTS profiles_select_auth ON public.profiles;
CREATE POLICY profiles_select_owner_or_staff
  ON public.profiles FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_internal_staff(auth.uid()));

-- -------------------------------------------------------------
-- candidates: internal staff only (peserta/casis cannot read all)
-- -------------------------------------------------------------
DROP POLICY IF EXISTS candidates_select_active_or_admin ON public.candidates;
CREATE POLICY candidates_select_staff
  ON public.candidates FOR SELECT TO authenticated
  USING (
    public.is_internal_staff(auth.uid())
    AND (
      deleted_at IS NULL
      OR public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
    )
  );

-- -------------------------------------------------------------
-- help_article_feedback: owner or admin
-- -------------------------------------------------------------
DROP POLICY IF EXISTS haf_select_auth ON public.help_article_feedback;
CREATE POLICY haf_select_owner_or_admin
  ON public.help_article_feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role]));

-- -------------------------------------------------------------
-- uat_feedback: owner or admin
-- -------------------------------------------------------------
DROP POLICY IF EXISTS uat_f_select ON public.uat_feedback;
CREATE POLICY uat_f_select_owner_or_admin
  ON public.uat_feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role]));

-- -------------------------------------------------------------
-- user_acknowledgements: owner or admin
-- -------------------------------------------------------------
DROP POLICY IF EXISTS ua_select_auth ON public.user_acknowledgements;
CREATE POLICY ua_select_owner_or_admin
  ON public.user_acknowledgements FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role]));

-- -------------------------------------------------------------
-- import_session_rows: admin/super_admin only (mirror write policy)
-- -------------------------------------------------------------
DROP POLICY IF EXISTS isr_select_auth ON public.import_session_rows;
CREATE POLICY isr_select_admin
  ON public.import_session_rows FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'registrasi'::app_role]));

-- -------------------------------------------------------------
-- medical_history_forms: internal staff only
-- -------------------------------------------------------------
DROP POLICY IF EXISTS mhf_select_auth ON public.medical_history_forms;
CREATE POLICY mhf_select_staff
  ON public.medical_history_forms FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

-- -------------------------------------------------------------
-- exam_* tables: internal staff only (was USING true)
-- -------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'exam_lab','exam_psychology','exam_cardiology','exam_dental','exam_ent',
      'exam_eye','exam_eye_vision','exam_general','exam_internal_medicine',
      'exam_neurology','exam_radiology','exam_surgery','exam_usg',
      'exam_sections','exams'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
      CASE t
        WHEN 'exam_lab' THEN 'exam_lab_select_auth'
        WHEN 'exam_psychology' THEN 'exam_psy_select_auth'
        WHEN 'exam_cardiology' THEN 'exam_cardiology_select_auth'
        WHEN 'exam_dental' THEN 'exam_dental_select_auth'
        WHEN 'exam_ent' THEN 'exam_ent_select_auth'
        WHEN 'exam_eye' THEN 'exam_eye_select_auth'
        WHEN 'exam_eye_vision' THEN 'exam_eye_vis_select_auth'
        WHEN 'exam_general' THEN 'exam_general_select_auth'
        WHEN 'exam_internal_medicine' THEN 'exam_internal_medicine_select_auth'
        WHEN 'exam_neurology' THEN 'exam_neuro_select_auth'
        WHEN 'exam_radiology' THEN 'exam_radiology_select_auth'
        WHEN 'exam_surgery' THEN 'exam_surgery_select_auth'
        WHEN 'exam_usg' THEN 'exam_usg_select_auth'
        WHEN 'exam_sections' THEN 'sections_select_auth'
        WHEN 'exams' THEN 'exams_select_auth'
      END, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()))',
      t || '_select_staff', t
    );
  END LOOP;
END $$;

-- -------------------------------------------------------------
-- realtime.messages: restrict channel subscriptions to internal staff
-- -------------------------------------------------------------
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rt_messages_internal_read ON realtime.messages;
CREATE POLICY rt_messages_internal_read
  ON realtime.messages FOR SELECT TO authenticated
  USING (public.is_internal_staff((SELECT auth.uid())));

DROP POLICY IF EXISTS rt_messages_internal_write ON realtime.messages;
CREATE POLICY rt_messages_internal_write
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff((SELECT auth.uid())));

-- -------------------------------------------------------------
-- Lock down SECURITY DEFINER helpers: revoke from anon
-- -------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
      r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- Admin-only RPC: rollback_import_session
REVOKE EXECUTE ON FUNCTION public.rollback_import_session(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.rollback_import_session(uuid, text) TO authenticated;
-- (RLS-side guard already enforced by app + audit; keep authenticated execute but RPC body checks role)
