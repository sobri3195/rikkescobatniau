
-- ===== Progress Weights config table =====
CREATE TABLE IF NOT EXISTS public.progress_weights (
  key text PRIMARY KEY,
  label text NOT NULL,
  weight numeric NOT NULL CHECK (weight >= 0),
  category text NOT NULL DEFAULT 'general',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.progress_weights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pw_select ON public.progress_weights;
CREATE POLICY pw_select ON public.progress_weights FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS pw_modify ON public.progress_weights;
CREATE POLICY pw_modify ON public.progress_weights FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role]));

-- Seed defaults (matches current hardcoded values)
INSERT INTO public.progress_weights (key, label, weight, category, sort_order) VALUES
  ('identity', 'Identitas Minimal', 5, 'identitas', 10),
  ('test_number', 'No Test Final', 5, 'identitas', 20),
  ('radiology', 'Rontgen', 10, 'penunjang', 30),
  ('ekg', 'EKG / Jantung', 10, 'penunjang', 40),
  ('anamnesis', 'Anamnesis', 10, 'screening', 50),
  ('height', 'Tinggi Badan', 3, 'screening', 60),
  ('weight', 'Berat Badan', 3, 'screening', 70),
  ('waist', 'Lingkar Perut', 3, 'screening', 80),
  ('bmi', 'IMT', 3, 'screening', 90),
  ('juknis', 'Klasifikasi Juknis', 3, 'screening', 100),
  ('section_each', 'Tiap Section Subtim (8 section)', 3.75, 'subtim', 110),
  ('resume', 'Resume / Kesimpulan', 10, 'review', 120),
  ('finalize', 'Finalisasi', 5, 'review', 130)
ON CONFLICT (key) DO NOTHING;

-- Helper to read a weight with fallback
CREATE OR REPLACE FUNCTION public.get_progress_weight(_key text, _default numeric)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT weight FROM public.progress_weights WHERE key = _key AND is_active), _default);
$$;

-- ===== Rewrite compute_exam_progress to read weights from table =====
CREATE OR REPLACE FUNCTION public.compute_exam_progress(p_exam_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
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
  v_section_w numeric;
BEGIN
  SELECT * INTO v_exam FROM exams WHERE id = p_exam_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO v_cand FROM candidates WHERE id = v_exam.candidate_id;
  SELECT * INTO v_mm FROM medical_measurements WHERE exam_id = p_exam_id LIMIT 1;
  SELECT * INTO v_mhf FROM medical_history_forms WHERE exam_id = p_exam_id ORDER BY updated_at DESC NULLS LAST LIMIT 1;

  v_section_w := public.get_progress_weight('section_each', 3.75);

  -- 1) Identitas
  v_w := public.get_progress_weight('identity', 5);
  v_st := CASE WHEN v_cand.full_name IS NOT NULL AND v_cand.full_name <> '' AND v_cand.selection_id IS NOT NULL THEN 'completed' ELSE 'pending' END;
  v_items := v_items || jsonb_build_object('key','identity','label','Identitas Minimal','status',v_st,'weight',v_w);
  v_total := v_total+1; v_total_w := v_total_w+v_w;
  IF v_st='completed' THEN v_done := v_done+1; v_done_w := v_done_w+v_w; END IF;

  -- 2) No Test Final
  v_w := public.get_progress_weight('test_number', 5);
  v_st := CASE WHEN v_cand.test_number IS NOT NULL AND v_cand.test_number <> '' AND v_cand.test_number NOT LIKE 'TMP-%' AND COALESCE(v_cand.test_number_status,'') = 'Final' THEN 'completed' ELSE 'pending' END;
  v_items := v_items || jsonb_build_object('key','test_number','label','No Test Final','status',v_st,'weight',v_w);
  v_total := v_total+1; v_total_w := v_total_w+v_w;
  IF v_st='completed' THEN v_done := v_done+1; v_done_w := v_done_w+v_w; END IF;

  -- 3) Rontgen
  v_w := public.get_progress_weight('radiology', 10);
  v_st := CASE
    WHEN v_exam.radiology_initial_status IN ('Cleared','Submitted','Approved','Locked') THEN 'completed'
    WHEN EXISTS(SELECT 1 FROM exam_radiology WHERE exam_id=p_exam_id AND status IN ('Submitted','Approved','Locked','Cleared')) THEN 'completed'
    WHEN v_exam.radiology_initial_status = 'Draft' OR EXISTS(SELECT 1 FROM exam_radiology WHERE exam_id=p_exam_id AND status = 'Draft') THEN 'in_progress'
    ELSE 'pending' END;
  v_items := v_items || jsonb_build_object('key','radiology','label','Rontgen','status',v_st,'weight',v_w);
  v_total := v_total+1; v_total_w := v_total_w+v_w;
  IF v_st='completed' THEN v_done := v_done+1; v_done_w := v_done_w+v_w; END IF;

  -- 4) EKG
  v_w := public.get_progress_weight('ekg', 10);
  v_st := CASE
    WHEN v_exam.ekg_initial_status IN ('Cleared','Submitted','Approved','Locked') THEN 'completed'
    WHEN EXISTS(SELECT 1 FROM exam_cardiology WHERE exam_id=p_exam_id AND status IN ('Submitted','Approved','Locked','Cleared')) THEN 'completed'
    WHEN v_exam.ekg_initial_status = 'Draft' OR EXISTS(SELECT 1 FROM exam_cardiology WHERE exam_id=p_exam_id AND status = 'Draft') THEN 'in_progress'
    ELSE 'pending' END;
  v_items := v_items || jsonb_build_object('key','ekg','label','EKG / Jantung','status',v_st,'weight',v_w);
  v_total := v_total+1; v_total_w := v_total_w+v_w;
  IF v_st='completed' THEN v_done := v_done+1; v_done_w := v_done_w+v_w; END IF;

  -- 5) Anamnesis
  v_w := public.get_progress_weight('anamnesis', 10);
  v_st := CASE
    WHEN v_mhf.anamnesis_workflow_status IN ('Submitted Peserta','Clear Dokter','Ada Catatan Dokter','Locked') THEN 'completed'
    WHEN v_mhf.anamnesis_workflow_status = 'Perlu Klarifikasi' THEN 'warning'
    WHEN v_mhf.anamnesis_workflow_status = 'Draft Peserta' THEN 'in_progress'
    ELSE 'pending' END;
  v_items := v_items || jsonb_build_object('key','anamnesis','label','Anamnesis','status',v_st,'weight',v_w);
  v_total := v_total+1; v_total_w := v_total_w+v_w;
  IF v_st='completed' THEN v_done := v_done+1; v_done_w := v_done_w+v_w; END IF;

  -- 6) Screening
  v_w := public.get_progress_weight('height', 3);
  v_st := CASE WHEN v_mm.height_cm IS NOT NULL AND v_mm.height_cm > 0 THEN 'completed' ELSE 'pending' END;
  v_items := v_items || jsonb_build_object('key','height','label','Tinggi Badan','status',v_st,'weight',v_w);
  v_total := v_total+1; v_total_w := v_total_w+v_w;
  IF v_st='completed' THEN v_done := v_done+1; v_done_w := v_done_w+v_w; END IF;

  v_w := public.get_progress_weight('weight', 3);
  v_st := CASE WHEN v_mm.weight_kg IS NOT NULL AND v_mm.weight_kg > 0 THEN 'completed' ELSE 'pending' END;
  v_items := v_items || jsonb_build_object('key','weight','label','Berat Badan','status',v_st,'weight',v_w);
  v_total := v_total+1; v_total_w := v_total_w+v_w;
  IF v_st='completed' THEN v_done := v_done+1; v_done_w := v_done_w+v_w; END IF;

  v_w := public.get_progress_weight('waist', 3);
  v_st := CASE WHEN v_mm.chest_or_waist_lp IS NOT NULL AND v_mm.chest_or_waist_lp > 0 THEN 'completed' ELSE 'pending' END;
  v_items := v_items || jsonb_build_object('key','waist','label','Lingkar Perut','status',v_st,'weight',v_w);
  v_total := v_total+1; v_total_w := v_total_w+v_w;
  IF v_st='completed' THEN v_done := v_done+1; v_done_w := v_done_w+v_w; END IF;

  v_w := public.get_progress_weight('bmi', 3);
  v_st := CASE WHEN v_mm.bmi IS NOT NULL AND v_mm.bmi > 0 THEN 'completed' ELSE 'pending' END;
  v_items := v_items || jsonb_build_object('key','bmi','label','IMT','status',v_st,'weight',v_w);
  v_total := v_total+1; v_total_w := v_total_w+v_w;
  IF v_st='completed' THEN v_done := v_done+1; v_done_w := v_done_w+v_w; END IF;

  v_w := public.get_progress_weight('juknis', 3);
  v_st := CASE WHEN v_mm.bmi_classification IS NOT NULL AND v_mm.bmi_classification <> '' THEN 'completed' ELSE 'pending' END;
  v_items := v_items || jsonb_build_object('key','juknis','label','Klasifikasi Juknis','status',v_st,'weight',v_w);
  v_total := v_total+1; v_total_w := v_total_w+v_w;
  IF v_st='completed' THEN v_done := v_done+1; v_done_w := v_done_w+v_w; END IF;

  -- 7) Section subtim
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

  -- 8) Resume
  v_w := public.get_progress_weight('resume', 10);
  SELECT section_status INTO v_st FROM exam_sections WHERE exam_id=p_exam_id AND section_key='resume_kesimpulan' LIMIT 1;
  v_st := CASE WHEN v_st IN ('Submitted','Approved','Locked') THEN 'completed'
               WHEN v_st = 'Draft' THEN 'in_progress'
               ELSE 'pending' END;
  v_items := v_items || jsonb_build_object('key','resume','label','Resume / Kesimpulan','status',v_st,'weight',v_w);
  v_total := v_total+1; v_total_w := v_total_w+v_w;
  IF v_st='completed' THEN v_done := v_done+1; v_done_w := v_done_w+v_w; END IF;

  -- 9) Finalisasi
  v_w := public.get_progress_weight('finalize', 5);
  v_st := CASE WHEN v_exam.exam_status = 'Finalized' THEN 'completed' ELSE 'pending' END;
  v_items := v_items || jsonb_build_object('key','finalize','label','Finalisasi','status',v_st,'weight',v_w);
  v_total := v_total+1; v_total_w := v_total_w+v_w;
  IF v_st='completed' THEN v_done := v_done+1; v_done_w := v_done_w+v_w; END IF;

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
    progress_detail_json = jsonb_build_object('completed', v_done, 'total', v_total, 'percentage', v_pct, 'items', v_items),
    progress_last_calculated_at = now(),
    updated_at = now()
  WHERE id = p_exam_id;
END;
$function$;
