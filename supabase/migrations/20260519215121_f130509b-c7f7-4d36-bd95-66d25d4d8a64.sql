
-- =========================================
-- EXAMS: Hari-H workflow columns
-- =========================================
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS hari_h_stage text DEFAULT 'Registrasi Awal',
  ADD COLUMN IF NOT EXISTS ekg_initial_status text NOT NULL DEFAULT 'Belum Diisi',
  ADD COLUMN IF NOT EXISTS radiology_initial_status text NOT NULL DEFAULT 'Belum Diisi',
  ADD COLUMN IF NOT EXISTS initial_supporting_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS bypass_initial_reason text,
  ADD COLUMN IF NOT EXISTS bypass_initial_by uuid,
  ADD COLUMN IF NOT EXISTS bypass_initial_at timestamptz,
  ADD COLUMN IF NOT EXISTS bypass_initial_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS bypass_initial_reviewed_by uuid;

-- =========================================
-- CANDIDATES: temporary_id for blank test_number
-- =========================================
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS temporary_id text;

CREATE UNIQUE INDEX IF NOT EXISTS candidates_temporary_id_unique
  ON public.candidates (temporary_id)
  WHERE temporary_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assign_temporary_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq int;
  v_date text;
BEGIN
  IF (NEW.test_number IS NULL OR NEW.test_number = '') AND (NEW.temporary_id IS NULL OR NEW.temporary_id = '') THEN
    v_date := to_char(now(), 'YYYYMMDD');
    SELECT COALESCE(MAX(NULLIF(regexp_replace(temporary_id, '^TMP-\d{8}-', ''), '')::int), 0) + 1
      INTO v_seq
      FROM public.candidates
      WHERE temporary_id LIKE 'TMP-' || v_date || '-%';
    NEW.temporary_id := 'TMP-' || v_date || '-' || lpad(v_seq::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_candidates_temporary_id ON public.candidates;
CREATE TRIGGER trg_candidates_temporary_id
  BEFORE INSERT ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.assign_temporary_id();

-- =========================================
-- EXAM_CARDIOLOGY & EXAM_RADIOLOGY: attachments
-- =========================================
ALTER TABLE public.exam_cardiology
  ADD COLUMN IF NOT EXISTS attachments_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS examination_type text,
  ADD COLUMN IF NOT EXISTS examined_on date;

ALTER TABLE public.exam_radiology
  ADD COLUMN IF NOT EXISTS attachments_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS examination_type text,
  ADD COLUMN IF NOT EXISTS examined_on date;

-- =========================================
-- HARI_H_SETTINGS
-- =========================================
CREATE TABLE IF NOT EXISTS public.hari_h_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id uuid UNIQUE,
  require_ekg_before_screening boolean NOT NULL DEFAULT true,
  require_radiology_before_screening boolean NOT NULL DEFAULT true,
  require_ekg_before_subteam boolean NOT NULL DEFAULT true,
  require_radiology_before_subteam boolean NOT NULL DEFAULT true,
  allow_bypass_with_reason boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hari_h_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hhs_select_auth ON public.hari_h_settings;
CREATE POLICY hhs_select_auth ON public.hari_h_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS hhs_admin_write ON public.hari_h_settings;
CREATE POLICY hhs_admin_write ON public.hari_h_settings
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role]));

DROP TRIGGER IF EXISTS trg_hhs_touch ON public.hari_h_settings;
CREATE TRIGGER trg_hhs_touch
  BEFORE UPDATE ON public.hari_h_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================
-- STORAGE BUCKET: hari-h-attachments (private)
-- =========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('hari-h-attachments', 'hari-h-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "hari_h_attachments_select" ON storage.objects;
CREATE POLICY "hari_h_attachments_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'hari-h-attachments');

DROP POLICY IF EXISTS "hari_h_attachments_write" ON storage.objects;
CREATE POLICY "hari_h_attachments_write" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'hari-h-attachments' AND
    has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'dokter'::app_role,'kepala_sub_tim'::app_role,'registrasi'::app_role])
  )
  WITH CHECK (
    bucket_id = 'hari-h-attachments' AND
    has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'dokter'::app_role,'kepala_sub_tim'::app_role,'registrasi'::app_role])
  );

-- =========================================
-- update_hari_h_stage(exam_id)
-- =========================================
CREATE OR REPLACE FUNCTION public.update_hari_h_stage(p_exam_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  IF p_exam_id IS NULL THEN RETURN; END IF;

  SELECT * INTO v_exam FROM public.exams WHERE id = p_exam_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO v_cand FROM public.candidates WHERE id = v_exam.candidate_id;

  SELECT COALESCE(status, 'Belum Diisi') INTO v_ekg_status FROM public.exam_cardiology WHERE exam_id = p_exam_id ORDER BY updated_at DESC LIMIT 1;
  IF v_ekg_status IS NULL THEN v_ekg_status := 'Belum Diisi'; END IF;

  SELECT COALESCE(status, 'Belum Diisi') INTO v_rad_status FROM public.exam_radiology WHERE exam_id = p_exam_id ORDER BY updated_at DESC LIMIT 1;
  IF v_rad_status IS NULL THEN v_rad_status := 'Belum Diisi'; END IF;

  -- Map raw status to standardized init status
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

  v_supporting_done := v_ekg_status IN ('Submitted','Approved','Locked','Cleared')
                   AND v_rad_status IN ('Submitted','Approved','Locked','Cleared');

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
  ELSIF v_cand.full_name IS NULL OR v_cand.full_name = '' OR (v_cand.test_number IS NULL AND v_cand.temporary_id IS NULL) THEN
    v_stage := 'Registrasi Awal';
  ELSIF v_ekg_status NOT IN ('Submitted','Approved','Locked','Cleared') THEN
    v_stage := 'Menunggu EKG';
  ELSIF v_rad_status NOT IN ('Submitted','Approved','Locked','Cleared') THEN
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
$$;

-- =========================================
-- Trigger wrappers
-- =========================================
CREATE OR REPLACE FUNCTION public.trg_recompute_hari_h_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam_id uuid := COALESCE(NEW.exam_id, OLD.exam_id);
BEGIN
  IF v_exam_id IS NOT NULL THEN
    PERFORM public.update_hari_h_stage(v_exam_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exam_cardiology_hari_h ON public.exam_cardiology;
CREATE TRIGGER trg_exam_cardiology_hari_h
  AFTER INSERT OR UPDATE OR DELETE ON public.exam_cardiology
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_hari_h_stage();

DROP TRIGGER IF EXISTS trg_exam_radiology_hari_h ON public.exam_radiology;
CREATE TRIGGER trg_exam_radiology_hari_h
  AFTER INSERT OR UPDATE OR DELETE ON public.exam_radiology
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_hari_h_stage();

DROP TRIGGER IF EXISTS trg_exam_sections_hari_h ON public.exam_sections;
CREATE TRIGGER trg_exam_sections_hari_h
  AFTER INSERT OR UPDATE OR DELETE ON public.exam_sections
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_hari_h_stage();
