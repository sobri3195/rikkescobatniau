
REVOKE EXECUTE ON FUNCTION public.is_my_candidate(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_my_exam(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_my_candidate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_my_exam(uuid) TO authenticated;

DROP POLICY IF EXISTS dqc_select_auth ON public.data_quality_checks;
CREATE POLICY dqc_select_staff ON public.data_quality_checks
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS dental_tooth_records_select_auth ON public.dental_tooth_records;
CREATE POLICY dental_tooth_records_select_staff ON public.dental_tooth_records
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS doc_exports_select_auth ON public.document_exports;
CREATE POLICY doc_exports_select_scoped ON public.document_exports
  FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()) OR public.is_my_candidate(candidate_id));

DROP POLICY IF EXISTS is_select_auth ON public.import_sessions;
CREATE POLICY is_select_admin ON public.import_sessions
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','registrasi']::app_role[]));

DROP POLICY IF EXISTS med_att_select_auth ON public.medical_attachments;
CREATE POLICY med_att_select_scoped ON public.medical_attachments
  FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()) OR public.is_my_candidate(candidate_id));

DROP POLICY IF EXISTS mm_select_auth ON public.medical_measurements;
CREATE POLICY mm_select_scoped ON public.medical_measurements
  FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()) OR public.is_my_candidate(candidate_id));

DROP POLICY IF EXISTS ms_select_auth ON public.medical_summary;
CREATE POLICY ms_select_scoped ON public.medical_summary
  FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()) OR public.is_my_candidate(candidate_id));

DROP POLICY IF EXISTS rm_select_auth ON public.review_marks;
CREATE POLICY rm_select_staff ON public.review_marks
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS rfs_select_auth ON public.rikkes_form_sections;
CREATE POLICY rfs_select_scoped ON public.rikkes_form_sections
  FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()) OR public.is_my_candidate(candidate_id));

DROP POLICY IF EXISTS sector_signoffs_select_auth ON public.sector_signoffs;
CREATE POLICY sector_signoffs_select_staff ON public.sector_signoffs
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS unlock_select_auth ON public.unlock_logs;
CREATE POLICY unlock_select_staff ON public.unlock_logs
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
