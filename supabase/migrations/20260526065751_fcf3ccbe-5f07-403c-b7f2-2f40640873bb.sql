
CREATE OR REPLACE FUNCTION public.delete_personnel_cascade(
  _candidate_id uuid,
  _reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cand record;
  v_counts jsonb := '{}'::jsonb;
  v_n int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Tidak terautentikasi' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_any_role(v_uid, ARRAY['super_admin'::app_role, 'tester'::app_role]) THEN
    RAISE EXCEPTION 'Hanya super_admin yang dapat menghapus peserta secara permanen' USING ERRCODE = '42501';
  END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 3 THEN
    RAISE EXCEPTION 'Alasan penghapusan wajib diisi (minimal 3 karakter)' USING ERRCODE = '22023';
  END IF;

  SELECT id, full_name, test_number, temporary_id, nrp_nip, rank, selection_id
    INTO v_cand
    FROM public.candidates
   WHERE id = _candidate_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Peserta tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  -- Delete rows in tables that don't cascade via FK (use exam_id from this candidate's exams).
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
  WITH d AS (DELETE FROM public.import_session_rows WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('import_session_rows', v_n);
  WITH d AS (DELETE FROM public.candidate_test_number_history WHERE candidate_id = _candidate_id RETURNING 1)
    SELECT count(*) INTO v_n FROM d; v_counts := v_counts || jsonb_build_object('candidate_test_number_history', v_n);

  -- Finally, delete the candidate. FK cascades cover exams, exam_sections,
  -- medical_measurements, medical_summary, candidate_merge_logs.
  DELETE FROM public.candidates WHERE id = _candidate_id;

  -- Audit (snapshot only, no full sensitive payload)
  INSERT INTO public.audit_logs (
    user_id, action, module, record_id, candidate_id, after_data, reason, access_result
  ) VALUES (
    v_uid,
    'delete_personnel_cascade',
    'Peserta',
    _candidate_id,
    _candidate_id,
    jsonb_build_object(
      'snapshot', jsonb_build_object(
        'id', v_cand.id,
        'full_name', v_cand.full_name,
        'test_number', v_cand.test_number,
        'temporary_id', v_cand.temporary_id,
        'rank', v_cand.rank,
        'nrp_nip', v_cand.nrp_nip,
        'selection_id', v_cand.selection_id
      ),
      'related_counts', v_counts
    ),
    _reason,
    'success'
  );

  RETURN jsonb_build_object('ok', true, 'related_counts', v_counts);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_personnel_cascade(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_personnel_cascade(uuid, text) TO authenticated;
