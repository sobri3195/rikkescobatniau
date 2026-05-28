
-- =====================================================
-- 1) TABEL BYPASS AUDIT
-- =====================================================
CREATE TABLE IF NOT EXISTS public.bypass_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid,
  candidate_id uuid,
  section_key text,
  bypass_type text NOT NULL,            -- 'screening' | 'subteam' | 'finalize' | 'no_test' | 'ekg' | 'radiology'
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  requested_by uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bypass_audit_exam ON public.bypass_audit(exam_id);
CREATE INDEX IF NOT EXISTS idx_bypass_audit_candidate ON public.bypass_audit(candidate_id);
CREATE INDEX IF NOT EXISTS idx_bypass_audit_status ON public.bypass_audit(status);
CREATE INDEX IF NOT EXISTS idx_bypass_audit_requested_at ON public.bypass_audit(requested_at DESC);

ALTER TABLE public.bypass_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bypass_audit_select ON public.bypass_audit;
CREATE POLICY bypass_audit_select ON public.bypass_audit
  FOR SELECT TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['super_admin','admin','kepala_sub_tim']::app_role[])
    OR requested_by = auth.uid()
  );

DROP POLICY IF EXISTS bypass_audit_insert ON public.bypass_audit;
CREATE POLICY bypass_audit_insert ON public.bypass_audit
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

DROP POLICY IF EXISTS bypass_audit_review ON public.bypass_audit;
CREATE POLICY bypass_audit_review ON public.bypass_audit
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','kepala_sub_tim']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','kepala_sub_tim']::app_role[]));

DROP TRIGGER IF EXISTS trg_bypass_audit_touch ON public.bypass_audit;
CREATE TRIGGER trg_bypass_audit_touch
  BEFORE UPDATE ON public.bypass_audit
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bypass_audit;
ALTER PUBLICATION supabase_realtime ADD TABLE public.exam_sections;

-- =====================================================
-- 2) TRIGGER VALIDASI FINALISASI (defense in depth)
-- =====================================================
CREATE OR REPLACE FUNCTION public.enforce_finalize_readiness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cand record;
  v_ekg text;
  v_rad text;
  v_bypass_ok boolean;
BEGIN
  IF NEW.exam_status = 'Finalized'
     AND COALESCE(OLD.exam_status, '') <> 'Finalized' THEN

    SELECT * INTO v_cand FROM public.candidates WHERE id = NEW.candidate_id;

    -- No Test wajib final (bukan TMP-*)
    IF v_cand.test_number IS NULL
       OR v_cand.test_number = ''
       OR v_cand.test_number LIKE 'TMP-%' THEN
      RAISE EXCEPTION 'Finalisasi ditolak: peserta belum punya Nomor Test final'
        USING ERRCODE = 'check_violation';
    END IF;

    -- EKG harus Cleared
    SELECT COALESCE(NEW.ekg_initial_status, 'Belum Diisi') INTO v_ekg;
    SELECT EXISTS (
      SELECT 1 FROM public.bypass_audit
      WHERE exam_id = NEW.id AND bypass_type = 'ekg' AND status = 'approved'
    ) INTO v_bypass_ok;
    IF v_ekg <> 'Cleared' AND NOT v_bypass_ok THEN
      RAISE EXCEPTION 'Finalisasi ditolak: status EKG belum Cleared (atau bypass belum diapprove)'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Radiologi harus Cleared
    SELECT COALESCE(NEW.radiology_initial_status, 'Belum Diisi') INTO v_rad;
    SELECT EXISTS (
      SELECT 1 FROM public.bypass_audit
      WHERE exam_id = NEW.id AND bypass_type = 'radiology' AND status = 'approved'
    ) INTO v_bypass_ok;
    IF v_rad <> 'Cleared' AND NOT v_bypass_ok THEN
      RAISE EXCEPTION 'Finalisasi ditolak: status Rontgen belum Cleared (atau bypass belum diapprove)'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_finalize_readiness ON public.exams;
CREATE TRIGGER trg_enforce_finalize_readiness
  BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.enforce_finalize_readiness();

-- =====================================================
-- 3) RLS SPESIALIS - tambah role klinis yang berhak
-- =====================================================
-- Helper makro: drop policy lama dan buat ulang dengan role lebih luas
-- THT
DROP POLICY IF EXISTS exam_ent_staff_write ON public.exam_ent;
CREATE POLICY exam_ent_staff_write ON public.exam_ent
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','dokter_spesialis','kepala_sub_tim','registrasi']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','dokter_spesialis','kepala_sub_tim','registrasi']::app_role[]));

-- Mata
DROP POLICY IF EXISTS exam_eye_staff_write ON public.exam_eye;
CREATE POLICY exam_eye_staff_write ON public.exam_eye
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','dokter_spesialis','kepala_sub_tim','registrasi']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','dokter_spesialis','kepala_sub_tim','registrasi']::app_role[]));

DROP POLICY IF EXISTS exam_eye_vis_staff_write ON public.exam_eye_vision;
CREATE POLICY exam_eye_vis_staff_write ON public.exam_eye_vision
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','dokter_spesialis','kepala_sub_tim','registrasi']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','dokter_spesialis','kepala_sub_tim','registrasi']::app_role[]));

-- Bedah
DROP POLICY IF EXISTS exam_surgery_staff_write ON public.exam_surgery;
CREATE POLICY exam_surgery_staff_write ON public.exam_surgery
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','dokter_spesialis','kepala_sub_tim','registrasi']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','dokter_spesialis','kepala_sub_tim','registrasi']::app_role[]));

-- Neurologi
DROP POLICY IF EXISTS exam_neuro_staff_write ON public.exam_neurology;
CREATE POLICY exam_neuro_staff_write ON public.exam_neurology
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','dokter_spesialis','kepala_sub_tim','registrasi']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','dokter_spesialis','kepala_sub_tim','registrasi']::app_role[]));

-- Jantung / EKG
DROP POLICY IF EXISTS exam_cardiology_staff_write ON public.exam_cardiology;
CREATE POLICY exam_cardiology_staff_write ON public.exam_cardiology
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','dokter_spesialis','kepala_sub_tim','registrasi']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','dokter_spesialis','kepala_sub_tim','registrasi']::app_role[]));

-- Gigi
DROP POLICY IF EXISTS exam_dental_staff_write ON public.exam_dental;
CREATE POLICY exam_dental_staff_write ON public.exam_dental
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','dokter_gigi','kepala_sub_tim','registrasi']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','dokter_gigi','kepala_sub_tim','registrasi']::app_role[]));

DROP POLICY IF EXISTS dental_tooth_records_staff_write ON public.dental_tooth_records;
CREATE POLICY dental_tooth_records_staff_write ON public.dental_tooth_records
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','dokter_gigi','kepala_sub_tim','registrasi']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','dokter_gigi','kepala_sub_tim','registrasi']::app_role[]));

-- Radiologi
DROP POLICY IF EXISTS exam_radiology_staff_write ON public.exam_radiology;
CREATE POLICY exam_radiology_staff_write ON public.exam_radiology
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','radiologi','kepala_sub_tim','registrasi']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','radiologi','kepala_sub_tim','registrasi']::app_role[]));

DROP POLICY IF EXISTS exam_usg_staff_write ON public.exam_usg;
CREATE POLICY exam_usg_staff_write ON public.exam_usg
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','radiologi','kepala_sub_tim','registrasi']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','radiologi','kepala_sub_tim','registrasi']::app_role[]));
