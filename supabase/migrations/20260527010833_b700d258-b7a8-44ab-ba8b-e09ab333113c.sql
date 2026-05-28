
CREATE OR REPLACE FUNCTION public.soft_delete_candidate_cascade(_candidate_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_counts jsonb := '{}'::jsonb;
  v_n int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Tidak terautentikasi' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_any_role(v_uid, ARRAY['super_admin'::app_role, 'admin'::app_role, 'tester'::app_role]) THEN
    RAISE EXCEPTION 'Hanya admin/super_admin yang dapat menghapus peserta' USING ERRCODE = '42501';
  END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 3 THEN
    RAISE EXCEPTION 'Alasan penghapusan wajib diisi (minimal 3 karakter)' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.candidates WHERE id = _candidate_id) THEN
    RAISE EXCEPTION 'Peserta tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  -- Purge Hari-H / RIKKES operational data (keeps the candidate row for audit/restore).
  WITH d AS (DELETE FROM public.medical_attachments WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('medical_attachments', v_n);
  WITH d AS (DELETE FROM public.document_exports WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('document_exports', v_n);
  WITH d AS (DELETE FROM public.medical_history_forms WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('medical_history_forms', v_n);
  WITH d AS (DELETE FROM public.rikkes_form_sections WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('rikkes_form_sections', v_n);
  WITH d AS (DELETE FROM public.exam_cardiology WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('exam_cardiology', v_n);
  WITH d AS (DELETE FROM public.exam_radiology WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('exam_radiology', v_n);
  WITH d AS (DELETE FROM public.exam_general WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('exam_general', v_n);
  WITH d AS (DELETE FROM public.exam_internal_medicine WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('exam_internal_medicine', v_n);
  WITH d AS (DELETE FROM public.exam_dental WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('exam_dental', v_n);
  WITH d AS (DELETE FROM public.exam_ent WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('exam_ent', v_n);
  WITH d AS (DELETE FROM public.exam_eye WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('exam_eye', v_n);
  WITH d AS (DELETE FROM public.exam_eye_vision WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('exam_eye_vision', v_n);
  WITH d AS (DELETE FROM public.exam_lab WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('exam_lab', v_n);
  WITH d AS (DELETE FROM public.exam_neurology WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('exam_neurology', v_n);
  WITH d AS (DELETE FROM public.exam_psychology WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('exam_psychology', v_n);
  WITH d AS (DELETE FROM public.exam_surgery WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('exam_surgery', v_n);
  WITH d AS (DELETE FROM public.exam_usg WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('exam_usg', v_n);
  WITH d AS (DELETE FROM public.bypass_audit WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('bypass_audit', v_n);
  WITH d AS (DELETE FROM public.data_quality_checks WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('data_quality_checks', v_n);
  WITH d AS (DELETE FROM public.review_marks WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('review_marks', v_n);
  WITH d AS (DELETE FROM public.sector_signoffs WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('sector_signoffs', v_n);
  WITH d AS (DELETE FROM public.unlock_logs WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('unlock_logs', v_n);
  WITH d AS (DELETE FROM public.notifications WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('notifications', v_n);

  -- Drop exams (cascades to exam_sections, medical_measurements, medical_summary).
  WITH d AS (DELETE FROM public.exams WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('exams', v_n);

  -- Soft-delete the candidate row itself (kept for audit / restore).
  UPDATE public.candidates
     SET deleted_at = now(),
         deleted_by = v_uid,
         delete_reason = _reason,
         status = 'Deleted',
         updated_at = now()
   WHERE id = _candidate_id;

  INSERT INTO public.audit_logs (
    user_id, action, module, record_id, candidate_id, after_data, reason, access_result
  ) VALUES (
    v_uid, 'soft_delete_candidate_cascade', 'Peserta',
    _candidate_id, _candidate_id,
    jsonb_build_object('related_counts', v_counts),
    _reason, 'success'
  );

  RETURN jsonb_build_object('ok', true, 'related_counts', v_counts);
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_candidate_cascade(uuid, text) TO authenticated;
