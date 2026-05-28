
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS progress_completed_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_total_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_detail_json jsonb NOT NULL DEFAULT '{"items":[],"completed":0,"total":0,"percentage":0}'::jsonb,
  ADD COLUMN IF NOT EXISTS progress_last_calculated_at timestamptz;

CREATE OR REPLACE FUNCTION public.compute_exam_progress(p_exam_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_exam exams%ROWTYPE;
  v_cand candidates%ROWTYPE;
  v_mm medical_measurements%ROWTYPE;
  v_mhf medical_history_forms%ROWTYPE;
  v_items jsonb := '[]'::jsonb;
  v_total int := 0;
  v_done int := 0;
  v_total_w numeric := 0;
  v_done_w numeric := 0;
  v_pct int;
  v_st text;
  v_w numeric;
  v_sec record;
  v_section_w numeric := 30.0 / 8.0;
BEGIN
  SELECT * INTO v_exam FROM exams WHERE id = p_exam_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO v_cand FROM candidates WHERE id = v_exam.candidate_id;
  SELECT * INTO v_mm FROM medical_measurements WHERE exam_id = p_exam_id LIMIT 1;
  SELECT * INTO v_mhf FROM medical_history_forms WHERE exam_id = p_exam_id ORDER BY updated_at DESC NULLS LAST LIMIT 1;

  -- helper macro: append + tally
  -- 1) Identitas (5)
  v_w := 5;
  v_st := CASE WHEN v_cand.full_name IS NOT NULL AND v_cand.full_name <> '' AND v_cand.selection_id IS NOT NULL THEN 'completed' ELSE 'pending' END;
  v_items := v_items || jsonb_build_object('key','identity','label','Identitas Minimal','status',v_st,'weight',v_w);
  v_total := v_total+1; v_total_w := v_total_w+v_w;
  IF v_st='completed' THEN v_done := v_done+1; v_done_w := v_done_w+v_w; END IF;

  -- 2) No Test Final (5)
  v_w := 5;
  v_st := CASE WHEN v_cand.test_number IS NOT NULL AND v_cand.test_number <> '' AND v_cand.test_number NOT LIKE 'TMP-%' AND COALESCE(v_cand.test_number_status,'') = 'Final' THEN 'completed' ELSE 'pending' END;
  v_items := v_items || jsonb_build_object('key','test_number','label','No Test Final','status',v_st,'weight',v_w);
  v_total := v_total+1; v_total_w := v_total_w+v_w;
  IF v_st='completed' THEN v_done := v_done+1; v_done_w := v_done_w+v_w; END IF;

  -- 3) Rontgen (10)
  v_w := 10;
  v_st := CASE
    WHEN v_exam.radiology_initial_status IN ('Cleared','Submitted','Approved','Locked') THEN 'completed'
    WHEN EXISTS(SELECT 1 FROM exam_radiology WHERE exam_id=p_exam_id AND status IN ('Submitted','Approved','Locked','Cleared')) THEN 'completed'
    WHEN v_exam.radiology_initial_status = 'Draft' OR EXISTS(SELECT 1 FROM exam_radiology WHERE exam_id=p_exam_id AND status = 'Draft') THEN 'in_progress'
    ELSE 'pending' END;
  v_items := v_items || jsonb_build_object('key','radiology','label','Rontgen','status',v_st,'weight',v_w);
  v_total := v_total+1; v_total_w := v_total_w+v_w;
  IF v_st='completed' THEN v_done := v_done+1; v_done_w := v_done_w+v_w; END IF;

  -- 4) EKG (10)
  v_w := 10;
  v_st := CASE
    WHEN v_exam.ekg_initial_status IN ('Cleared','Submitted','Approved','Locked') THEN 'completed'
    WHEN EXISTS(SELECT 1 FROM exam_cardiology WHERE exam_id=p_exam_id AND status IN ('Submitted','Approved','Locked','Cleared')) THEN 'completed'
    WHEN v_exam.ekg_initial_status = 'Draft' OR EXISTS(SELECT 1 FROM exam_cardiology WHERE exam_id=p_exam_id AND status = 'Draft') THEN 'in_progress'
    ELSE 'pending' END;
  v_items := v_items || jsonb_build_object('key','ekg','label','EKG / Jantung','status',v_st,'weight',v_w);
  v_total := v_total+1; v_total_w := v_total_w+v_w;
  IF v_st='completed' THEN v_done := v_done+1; v_done_w := v_done_w+v_w; END IF;

  -- 5) Anamnesis (10)
  v_w := 10;
  v_st := CASE
    WHEN v_mhf.anamnesis_workflow_status IN ('Submitted Peserta','Clear Dokter','Ada Catatan Dokter','Locked') THEN 'completed'
    WHEN v_mhf.anamnesis_workflow_status = 'Perlu Klarifikasi' THEN 'warning'
    WHEN v_mhf.anamnesis_workflow_status = 'Draft Peserta' THEN 'in_progress'
    ELSE 'pending' END;
  v_items := v_items || jsonb_build_object('key','anamnesis','label','Anamnesis','status',v_st,'weight',v_w);
  v_total := v_total+1; v_total_w := v_total_w+v_w;
  IF v_st='completed' THEN v_done := v_done+1; v_done_w := v_done_w+v_w; END IF;

  -- 6) Screening Hari-H: TB(3), BB(3), LP(3), IMT(3), Juknis/Klasifikasi(3) = 15
  v_w := 3;
  v_st := CASE WHEN v_mm.height_cm IS NOT NULL AND v_mm.height_cm > 0 THEN 'completed' ELSE 'pending' END;
  v_items := v_items || jsonb_build_object('key','height','label','Tinggi Badan','status',v_st,'weight',v_w);
  v_total := v_total+1; v_total_w := v_total_w+v_w;
  IF v_st='completed' THEN v_done := v_done+1; v_done_w := v_done_w+v_w; END IF;

  v_st := CASE WHEN v_mm.weight_kg IS NOT NULL AND v_mm.weight_kg > 0 THEN 'completed' ELSE 'pending' END;
  v_items := v_items || jsonb_build_object('key','weight','label','Berat Badan','status',v_st,'weight',v_w);
  v_total := v_total+1; v_total_w := v_total_w+v_w;
  IF v_st='completed' THEN v_done := v_done+1; v_done_w := v_done_w+v_w; END IF;

  v_st := CASE WHEN v_mm.chest_or_waist_lp IS NOT NULL AND v_mm.chest_or_waist_lp > 0 THEN 'completed' ELSE 'pending' END;
  v_items := v_items || jsonb_build_object('key','waist','label','Lingkar Perut','status',v_st,'weight',v_w);
  v_total := v_total+1; v_total_w := v_total_w+v_w;
  IF v_st='completed' THEN v_done := v_done+1; v_done_w := v_done_w+v_w; END IF;

  v_st := CASE WHEN v_mm.bmi IS NOT NULL AND v_mm.bmi > 0 THEN 'completed' ELSE 'pending' END;
  v_items := v_items || jsonb_build_object('key','bmi','label','IMT','status',v_st,'weight',v_w);
  v_total := v_total+1; v_total_w := v_total_w+v_w;
  IF v_st='completed' THEN v_done := v_done+1; v_done_w := v_done_w+v_w; END IF;

  v_st := CASE WHEN v_mm.bmi_classification IS NOT NULL AND v_mm.bmi_classification <> '' THEN 'completed' ELSE 'pending' END;
  v_items := v_items || jsonb_build_object('key','juknis','label','Klasifikasi Juknis','status',v_st,'weight',v_w);
  v_total := v_total+1; v_total_w := v_total_w+v_w;
  IF v_st='completed' THEN v_done := v_done+1; v_done_w := v_done_w+v_w; END IF;

  -- 7) Section subtim wajib (8 sections, total 30, ~3.75 each)
  FOR v_sec IN
    SELECT section_key, section_status,
      CASE section_key
        WHEN 'bedah' THEN 'Bedah'
        WHEN 'mata' THEN 'Mata'
        WHEN 'tht' THEN 'THT'
        WHEN 'ekg_ergo' THEN 'EKG/Ergo (Section)'
        WHEN 'radiologi_ro' THEN 'Radiologi (Section)'
        WHEN 'laboratorium' THEN 'Laboratorium'
        WHEN 'gigi' THEN 'Gilut'
        WHEN 'penyakit_dalam' THEN 'Penyakit Dalam'
      END AS lbl
    FROM exam_sections
    WHERE exam_id = p_exam_id
      AND section_key IN ('bedah','mata','tht','ekg_ergo','radiologi_ro','laboratorium','gigi','penyakit_dalam')
  LOOP
    v_st := CASE WHEN v_sec.section_status IN ('Submitted','Approved','Locked') THEN 'completed'
                 WHEN v_sec.section_status = 'Revision' THEN 'warning'
                 WHEN v_sec.section_status = 'Draft' THEN 'in_progress'
                 ELSE 'pending' END;
    v_items := v_items || jsonb_build_object('key','section_'||v_sec.section_key,'label',v_sec.lbl,'status',v_st,'weight',v_section_w);
    v_total := v_total+1; v_total_w := v_total_w+v_section_w;
    IF v_st='completed' THEN v_done := v_done+1; v_done_w := v_done_w+v_section_w; END IF;
  END LOOP;

  -- 8) Resume/Review (10)
  v_w := 10;
  SELECT section_status INTO v_st FROM exam_sections WHERE exam_id=p_exam_id AND section_key='resume_kesimpulan' LIMIT 1;
  v_st := CASE WHEN v_st IN ('Submitted','Approved','Locked') THEN 'completed'
               WHEN v_st = 'Draft' THEN 'in_progress'
               ELSE 'pending' END;
  v_items := v_items || jsonb_build_object('key','resume','label','Resume / Kesimpulan','status',v_st,'weight',v_w);
  v_total := v_total+1; v_total_w := v_total_w+v_w;
  IF v_st='completed' THEN v_done := v_done+1; v_done_w := v_done_w+v_w; END IF;

  -- 9) Finalisasi (5)
  v_w := 5;
  v_st := CASE WHEN v_exam.exam_status = 'Finalized' THEN 'completed' ELSE 'pending' END;
  v_items := v_items || jsonb_build_object('key','finalize','label','Finalisasi','status',v_st,'weight',v_w);
  v_total := v_total+1; v_total_w := v_total_w+v_w;
  IF v_st='completed' THEN v_done := v_done+1; v_done_w := v_done_w+v_w; END IF;

  -- Compute percentage
  IF v_exam.exam_status = 'Finalized' THEN
    v_pct := 100;
  ELSE
    v_pct := CASE WHEN v_total_w > 0 THEN round((v_done_w / v_total_w) * 100)::int ELSE 0 END;
    IF v_pct > 95 THEN v_pct := 95; END IF;
  END IF;

  UPDATE exams SET
    progress_percentage = v_pct,
    progress_completed_count = v_done,
    progress_total_count = v_total,
    progress_detail_json = jsonb_build_object(
      'completed', v_done,
      'total', v_total,
      'percentage', v_pct,
      'items', v_items
    ),
    progress_last_calculated_at = now(),
    updated_at = now()
  WHERE id = p_exam_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.recompute_selection_progress(p_selection_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT id FROM exams WHERE p_selection_id IS NULL OR selection_id = p_selection_id LOOP
    PERFORM public.compute_exam_progress(r.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$fn$;

-- Generic trigger that recomputes progress for the exam referenced by NEW/OLD
CREATE OR REPLACE FUNCTION public.trg_recompute_exam_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_exam_id uuid;
BEGIN
  v_exam_id := COALESCE(NEW.exam_id, OLD.exam_id);
  IF v_exam_id IS NOT NULL THEN
    PERFORM public.compute_exam_progress(v_exam_id);
  END IF;
  RETURN NEW;
END;
$fn$;

-- Trigger on exams itself (for exam_status / initial_status changes) — guard against recursion
CREATE OR REPLACE FUNCTION public.trg_recompute_exam_progress_self()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.exam_status IS NOT DISTINCT FROM OLD.exam_status
     AND NEW.radiology_initial_status IS NOT DISTINCT FROM OLD.radiology_initial_status
     AND NEW.ekg_initial_status IS NOT DISTINCT FROM OLD.ekg_initial_status THEN
    RETURN NEW;
  END IF;
  PERFORM public.compute_exam_progress(NEW.id);
  RETURN NEW;
END;
$fn$;

-- Trigger when candidates change (test_number, full_name)
CREATE OR REPLACE FUNCTION public.trg_recompute_progress_from_candidate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM exams WHERE candidate_id = NEW.id LOOP
    PERFORM public.compute_exam_progress(r.id);
  END LOOP;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_progress_on_sections ON public.exam_sections;
CREATE TRIGGER trg_progress_on_sections
AFTER INSERT OR UPDATE OR DELETE ON public.exam_sections
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_exam_progress();

DROP TRIGGER IF EXISTS trg_progress_on_radiology ON public.exam_radiology;
CREATE TRIGGER trg_progress_on_radiology
AFTER INSERT OR UPDATE OR DELETE ON public.exam_radiology
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_exam_progress();

DROP TRIGGER IF EXISTS trg_progress_on_cardiology ON public.exam_cardiology;
CREATE TRIGGER trg_progress_on_cardiology
AFTER INSERT OR UPDATE OR DELETE ON public.exam_cardiology
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_exam_progress();

DROP TRIGGER IF EXISTS trg_progress_on_measurements ON public.medical_measurements;
CREATE TRIGGER trg_progress_on_measurements
AFTER INSERT OR UPDATE OR DELETE ON public.medical_measurements
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_exam_progress();

DROP TRIGGER IF EXISTS trg_progress_on_history ON public.medical_history_forms;
CREATE TRIGGER trg_progress_on_history
AFTER INSERT OR UPDATE OR DELETE ON public.medical_history_forms
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_exam_progress();

DROP TRIGGER IF EXISTS trg_progress_on_exam_self ON public.exams;
CREATE TRIGGER trg_progress_on_exam_self
AFTER INSERT OR UPDATE ON public.exams
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_exam_progress_self();

DROP TRIGGER IF EXISTS trg_progress_on_candidate ON public.candidates;
CREATE TRIGGER trg_progress_on_candidate
AFTER INSERT OR UPDATE ON public.candidates
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_progress_from_candidate();

-- Backfill: recompute for all existing exams
SELECT public.recompute_selection_progress(NULL);
