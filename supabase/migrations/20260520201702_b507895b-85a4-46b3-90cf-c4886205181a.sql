-- Add soft-delete metadata and registration notes to candidates
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS delete_reason text,
  ADD COLUMN IF NOT EXISTS registration_notes text;

-- Update Hari-H stage logic to emit "Menunggu Rontgen & EKG" when both missing
CREATE OR REPLACE FUNCTION public.update_hari_h_stage(p_exam_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_exam record;
  v_cand record;
  v_ekg_status text;
  v_rad_status text;
  v_screening_done boolean;
  v_subteam_pending int;
  v_total_sections int;
  v_done_sections int;
  v_stage text;
  v_supporting_done boolean;
  v_ekg_ok boolean;
  v_rad_ok boolean;
BEGIN
  IF p_exam_id IS NULL THEN RETURN; END IF;

  SELECT * INTO v_exam FROM public.exams WHERE id = p_exam_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO v_cand FROM public.candidates WHERE id = v_exam.candidate_id;

  SELECT COALESCE(status, 'Belum Diisi') INTO v_ekg_status FROM public.exam_cardiology WHERE exam_id = p_exam_id ORDER BY updated_at DESC LIMIT 1;
  IF v_ekg_status IS NULL THEN v_ekg_status := 'Belum Diisi'; END IF;

  SELECT COALESCE(status, 'Belum Diisi') INTO v_rad_status FROM public.exam_radiology WHERE exam_id = p_exam_id ORDER BY updated_at DESC LIMIT 1;
  IF v_rad_status IS NULL THEN v_rad_status := 'Belum Diisi'; END IF;

  UPDATE public.exams
     SET ekg_initial_status = CASE
            WHEN v_ekg_status IN ('Submitted','Approved','Locked','Cleared') THEN 'Cleared'
            WHEN v_ekg_status IN ('Draft','Revision') THEN 'Draft'
            ELSE 'Belum Diisi'
         END,
         radiology_initial_status = CASE
            WHEN v_rad_status IN ('Submitted','Approved','Locked','Cleared') THEN 'Cleared'
            WHEN v_rad_status IN ('Draft','Revision') THEN 'Draft'
            ELSE 'Belum Diisi'
         END
   WHERE id = p_exam_id;

  v_ekg_ok := v_ekg_status IN ('Submitted','Approved','Locked','Cleared');
  v_rad_ok := v_rad_status IN ('Submitted','Approved','Locked','Cleared');
  v_supporting_done := v_ekg_ok AND v_rad_ok;

  IF v_supporting_done AND v_exam.initial_supporting_completed_at IS NULL THEN
    UPDATE public.exams SET initial_supporting_completed_at = now() WHERE id = p_exam_id;
  END IF;

  SELECT count(*), count(*) FILTER (WHERE section_status IN ('Submitted','Approved','Locked'))
    INTO v_total_sections, v_done_sections
    FROM public.exam_sections WHERE exam_id = p_exam_id;

  SELECT EXISTS (
    SELECT 1 FROM public.exam_sections
     WHERE exam_id = p_exam_id AND section_key IN ('anamnesa','identitas')
       AND section_status IN ('Submitted','Approved','Locked')
  ) INTO v_screening_done;

  SELECT count(*) INTO v_subteam_pending
    FROM public.exam_sections
   WHERE exam_id = p_exam_id
     AND section_key NOT IN ('identitas','anamnesa','ekg_ergo','radiologi_ro','resume_kesimpulan','rekap_paraf','kualifikasi_akhir')
     AND section_status IN ('Draft','Revision');

  IF v_exam.exam_status = 'Finalized' THEN
    v_stage := 'Finalized';
  ELSIF v_cand.full_name IS NULL OR v_cand.full_name = '' THEN
    v_stage := 'Registrasi Awal';
  ELSIF NOT v_ekg_ok AND NOT v_rad_ok THEN
    v_stage := 'Menunggu Rontgen & EKG';
  ELSIF NOT v_ekg_ok THEN
    v_stage := 'Menunggu EKG';
  ELSIF NOT v_rad_ok THEN
    v_stage := 'Menunggu Rontgen';
  ELSIF NOT v_screening_done THEN
    v_stage := 'Screening Hari-H';
  ELSIF v_subteam_pending > 0 THEN
    v_stage := 'Pemeriksaan Subtim';
  ELSIF v_done_sections = v_total_sections AND v_total_sections > 0 THEN
    v_stage := 'Review';
  ELSE
    v_stage := 'Penunjang Awal Lengkap';
  END IF;

  UPDATE public.exams SET hari_h_stage = v_stage, updated_at = now() WHERE id = p_exam_id;
END;
$function$;