
-- Lab exam table
CREATE TABLE public.exam_lab (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  -- Hematologi
  hb text, leukosit text, trombosit text, hematokrit text, eritrosit text, led text,
  diff_basofil text, diff_eosinofil text, diff_neutrofil text, diff_limfosit text, diff_monosit text,
  -- Urinalisa
  urin_warna text, urin_kejernihan text, urin_bj text, urin_ph text,
  urin_protein text, urin_glukosa text, urin_keton text, urin_bilirubin text,
  urin_darah text, urin_nitrit text, urin_leukosit text, urin_sedimen text,
  -- Kimia darah
  gula_darah_puasa text, gula_darah_2jpp text, hba1c text,
  kolesterol_total text, ldl text, hdl text, trigliserida text,
  ureum text, kreatinin text, asam_urat text, sgot text, sgpt text,
  -- Narkoba
  narkoba_amfetamin text, narkoba_metamfetamin text, narkoba_thc text,
  narkoba_opiat text, narkoba_kokain text, narkoba_benzo text,
  narkoba_kesimpulan text,
  -- Meta
  conclusion text,
  qualification_u text,
  examiner_id uuid,
  examined_at timestamptz,
  attachments_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exam_lab_exam ON public.exam_lab(exam_id);
CREATE INDEX idx_exam_lab_candidate ON public.exam_lab(candidate_id);

ALTER TABLE public.exam_lab ENABLE ROW LEVEL SECURITY;

CREATE POLICY exam_lab_select_auth ON public.exam_lab FOR SELECT TO authenticated USING (true);
CREATE POLICY exam_lab_staff_write ON public.exam_lab FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'dokter'::app_role,'lab'::app_role,'kepala_sub_tim'::app_role,'registrasi'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'dokter'::app_role,'lab'::app_role,'kepala_sub_tim'::app_role,'registrasi'::app_role]));

CREATE TRIGGER tg_exam_lab_touch BEFORE UPDATE ON public.exam_lab
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Psychology exam table
CREATE TABLE public.exam_psychology (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  anamnesa text,
  kepribadian text,
  kecerdasan text,
  sikap_kerja text,
  motivasi text,
  emosi text,
  catatan_observasi text,
  conclusion text,
  classification text, -- P-1..P-5
  qualification_u text,
  examiner_id uuid,
  examined_at timestamptz,
  attachments_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exam_psy_exam ON public.exam_psychology(exam_id);
CREATE INDEX idx_exam_psy_candidate ON public.exam_psychology(candidate_id);

ALTER TABLE public.exam_psychology ENABLE ROW LEVEL SECURITY;

CREATE POLICY exam_psy_select_auth ON public.exam_psychology FOR SELECT TO authenticated USING (true);
CREATE POLICY exam_psy_staff_write ON public.exam_psychology FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'dokter'::app_role,'dokter_spesialis'::app_role,'kepala_sub_tim'::app_role,'registrasi'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'dokter'::app_role,'dokter_spesialis'::app_role,'kepala_sub_tim'::app_role,'registrasi'::app_role]));

CREATE TRIGGER tg_exam_psy_touch BEFORE UPDATE ON public.exam_psychology
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
