
-- 1. Add assigned_role column to exam_sections
ALTER TABLE public.exam_sections
  ADD COLUMN IF NOT EXISTS assigned_role text;

-- 2. Rename legacy section_key values to spec keys
UPDATE public.exam_sections SET section_key = 'surat_pernyataan' WHERE section_key = 'pernyataan';
UPDATE public.exam_sections SET section_key = 'pemeriksaan_umum' WHERE section_key = 'pem_umum';
UPDATE public.exam_sections SET section_key = 'ekg_ergo'        WHERE section_key = 'ekg';
UPDATE public.exam_sections SET section_key = 'neurologi'       WHERE section_key = 'neuro';
UPDATE public.exam_sections SET section_key = 'laboratorium'    WHERE section_key = 'lab';
UPDATE public.exam_sections SET section_key = 'radiologi_ro'    WHERE section_key = 'radiologi';
UPDATE public.exam_sections SET section_key = 'audio_tympano'   WHERE section_key = 'audio';
UPDATE public.exam_sections SET section_key = 'jiwa_keswa'      WHERE section_key = 'jiwa';
UPDATE public.exam_sections SET section_key = 'resume_kesimpulan' WHERE section_key = 'resume';
UPDATE public.exam_sections SET section_key = 'kualifikasi_akhir' WHERE section_key = 'kualifikasi';

-- 3. document_exports table
CREATE TABLE IF NOT EXISTS public.document_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id uuid,
  candidate_id uuid,
  exam_id uuid,
  export_type text NOT NULL,
  document_type text NOT NULL,
  file_name text,
  file_url text,
  filter_json jsonb,
  exported_by uuid,
  exported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS doc_exports_select_auth ON public.document_exports;
CREATE POLICY doc_exports_select_auth ON public.document_exports
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS doc_exports_staff_write ON public.document_exports;
CREATE POLICY doc_exports_staff_write ON public.document_exports
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'kepala_sub_tim'::app_role,'dokter'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'kepala_sub_tim'::app_role,'dokter'::app_role]));

-- 4. Trigger: auto-create exam + 25 sections + measurements + summary on new candidate
CREATE OR REPLACE FUNCTION public.create_exam_for_candidate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam_id uuid;
  v_section jsonb;
  v_sections jsonb := '[
    {"k":"identitas","n":"Identitas","r":"registrasi"},
    {"k":"anamnesa","n":"Anamnesa","r":"peserta"},
    {"k":"surat_pernyataan","n":"Surat Pernyataan","r":"peserta"},
    {"k":"pemeriksaan_umum","n":"Pemeriksaan Umum","r":"dokter"},
    {"k":"tanda_vital","n":"Tanda Vital","r":"dokter"},
    {"k":"penyakit_dalam","n":"Penyakit Dalam","r":"dokter"},
    {"k":"ekg_ergo","n":"EKG/Ergo","r":"dokter"},
    {"k":"paru","n":"Paru FVC/FEV1","r":"dokter"},
    {"k":"neurologi","n":"Neurologi","r":"dokter"},
    {"k":"obsgyn","n":"Obsgyn","r":"dokter"},
    {"k":"kulit","n":"Kulit","r":"dokter"},
    {"k":"laboratorium","n":"Laboratorium","r":"dokter"},
    {"k":"radiologi_ro","n":"Radiologi/RO","r":"dokter"},
    {"k":"usg","n":"USG","r":"dokter"},
    {"k":"tht","n":"THT","r":"dokter"},
    {"k":"bedah","n":"Bedah","r":"dokter"},
    {"k":"atas","n":"Atas","r":"dokter"},
    {"k":"bawah","n":"Bawah","r":"dokter"},
    {"k":"audio_tympano","n":"Audio dan Tympano","r":"dokter"},
    {"k":"mata","n":"Mata","r":"dokter"},
    {"k":"gigi","n":"Gigi/Odontogram","r":"dokter"},
    {"k":"jiwa_keswa","n":"Jiwa/Keswa","r":"dokter"},
    {"k":"resume_kesimpulan","n":"Resume/Kesimpulan","r":"kepala_sub_tim"},
    {"k":"rekap_paraf","n":"Rekap Paraf","r":"admin"},
    {"k":"kualifikasi_akhir","n":"Kualifikasi Akhir","r":"kepala_sub_tim"}
  ]'::jsonb;
BEGIN
  -- Don't duplicate if an exam already exists
  IF EXISTS (SELECT 1 FROM public.exams WHERE candidate_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.exams (candidate_id, selection_id, exam_status, progress_percentage)
  VALUES (NEW.id, NEW.selection_id, 'In Progress', 0)
  RETURNING id INTO v_exam_id;

  FOR v_section IN SELECT * FROM jsonb_array_elements(v_sections) LOOP
    INSERT INTO public.exam_sections (exam_id, candidate_id, section_key, section_name, section_status, assigned_role)
    VALUES (v_exam_id, NEW.id, v_section->>'k', v_section->>'n', 'Draft', v_section->>'r');
  END LOOP;

  INSERT INTO public.medical_measurements (exam_id, candidate_id) VALUES (v_exam_id, NEW.id);
  INSERT INTO public.medical_summary (exam_id, candidate_id) VALUES (v_exam_id, NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_exam_for_candidate ON public.candidates;
CREATE TRIGGER trg_create_exam_for_candidate
AFTER INSERT ON public.candidates
FOR EACH ROW EXECUTE FUNCTION public.create_exam_for_candidate();

-- 5. Trigger: recompute exam status + progress on section change
CREATE OR REPLACE FUNCTION public.recompute_exam_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam_id uuid := COALESCE(NEW.exam_id, OLD.exam_id);
  v_total int;
  v_done int;
  v_revision int;
  v_locked int;
  v_status text;
  v_progress numeric;
BEGIN
  IF v_exam_id IS NULL THEN RETURN NEW; END IF;

  SELECT count(*),
         count(*) FILTER (WHERE section_status IN ('Submitted','Approved','Locked')),
         count(*) FILTER (WHERE section_status = 'Revision'),
         count(*) FILTER (WHERE section_status = 'Locked')
  INTO v_total, v_done, v_revision, v_locked
  FROM public.exam_sections WHERE exam_id = v_exam_id;

  v_progress := CASE WHEN v_total = 0 THEN 0 ELSE round(v_done::numeric * 100 / v_total, 1) END;

  IF v_locked = v_total AND v_total > 0 THEN
    v_status := 'Finalized';
  ELSIF v_revision > 0 THEN
    v_status := 'Revision Needed';
  ELSIF v_done = v_total AND v_total > 0 THEN
    v_status := 'Pending Review';
  ELSE
    v_status := 'In Progress';
  END IF;

  UPDATE public.exams
  SET exam_status = CASE WHEN exam_status = 'Finalized' AND v_status <> 'Finalized' THEN exam_status ELSE v_status END,
      progress_percentage = v_progress,
      updated_at = now()
  WHERE id = v_exam_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_exam_status ON public.exam_sections;
CREATE TRIGGER trg_recompute_exam_status
AFTER INSERT OR UPDATE OR DELETE ON public.exam_sections
FOR EACH ROW EXECUTE FUNCTION public.recompute_exam_status();
