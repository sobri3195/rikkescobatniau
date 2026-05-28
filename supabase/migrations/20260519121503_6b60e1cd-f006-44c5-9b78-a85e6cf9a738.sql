
-- ===== formula_rule_sets =====
CREATE TABLE public.formula_rule_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_name text NOT NULL,
  description text,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'Draft',
  is_default boolean NOT NULL DEFAULT false,
  based_on_rule_set_id uuid,
  effective_from timestamptz,
  effective_until timestamptz,
  created_by uuid,
  activated_by uuid,
  activated_at timestamptz,
  archived_by uuid,
  archived_at timestamptz,
  config_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.formula_rule_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY frs_select_auth ON public.formula_rule_sets FOR SELECT TO authenticated USING (true);
CREATE POLICY frs_admin_write ON public.formula_rule_sets FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));
CREATE TRIGGER frs_touch BEFORE UPDATE ON public.formula_rule_sets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== bmi_rules =====
CREATE TABLE public.bmi_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id uuid NOT NULL REFERENCES public.formula_rule_sets(id) ON DELETE CASCADE,
  min_value numeric,
  max_value numeric,
  classification text NOT NULL,
  label text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bmi_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY bmi_select_auth ON public.bmi_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY bmi_admin_write ON public.bmi_rules FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));
CREATE TRIGGER bmi_touch BEFORE UPDATE ON public.bmi_rules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== kesum_rule_configs =====
CREATE TABLE public.kesum_rule_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id uuid NOT NULL REFERENCES public.formula_rule_sets(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  section_name text,
  is_included boolean NOT NULL DEFAULT true,
  is_required boolean NOT NULL DEFAULT false,
  weight numeric DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kesum_rule_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY krc_select_auth ON public.kesum_rule_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY krc_admin_write ON public.kesum_rule_configs FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));
CREATE TRIGGER krc_touch BEFORE UPDATE ON public.kesum_rule_configs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== keswa_rule_configs =====
CREATE TABLE public.keswa_rule_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id uuid NOT NULL REFERENCES public.formula_rule_sets(id) ON DELETE CASCADE,
  source_section_key text NOT NULL DEFAULT 'jiwa_keswa',
  failure_classification text NOT NULL DEFAULT 'K2',
  pass_result text NOT NULL DEFAULT 'MS',
  fail_result text NOT NULL DEFAULT 'TMS',
  th_result text NOT NULL DEFAULT 'TH',
  incomplete_result text NOT NULL DEFAULT 'Belum Lengkap',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.keswa_rule_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY kwc_select_auth ON public.keswa_rule_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY kwc_admin_write ON public.keswa_rule_configs FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));
CREATE TRIGGER kwc_touch BEFORE UPDATE ON public.keswa_rule_configs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== final_result_rules =====
CREATE TABLE public.final_result_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id uuid NOT NULL REFERENCES public.formula_rule_sets(id) ON DELETE CASCADE,
  condition_key text NOT NULL,
  condition_json jsonb DEFAULT '{}'::jsonb,
  result_value text NOT NULL,
  priority_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.final_result_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY frr_select_auth ON public.final_result_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY frr_admin_write ON public.final_result_rules FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));
CREATE TRIGGER frr_touch BEFORE UPDATE ON public.final_result_rules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== scoring_rules =====
CREATE TABLE public.scoring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id uuid NOT NULL REFERENCES public.formula_rule_sets(id) ON DELETE CASCADE,
  kesum_classification text NOT NULL,
  base_score numeric NOT NULL DEFAULT 0,
  penalty_k2 numeric NOT NULL DEFAULT 0,
  penalty_k1 numeric NOT NULL DEFAULT 0,
  penalty_c numeric NOT NULL DEFAULT 0,
  penalty_th numeric NOT NULL DEFAULT 0,
  minimum_score numeric,
  maximum_score numeric DEFAULT 100,
  applies_to_final_result text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scoring_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY sr_select_auth ON public.scoring_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY sr_admin_write ON public.scoring_rules FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));
CREATE TRIGGER sr_touch BEFORE UPDATE ON public.scoring_rules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== stakes_configs =====
CREATE TABLE public.stakes_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id uuid NOT NULL REFERENCES public.formula_rule_sets(id) ON DELETE CASCADE,
  stakes_key text NOT NULL,
  stakes_label text,
  source_section_keys_json jsonb DEFAULT '[]'::jsonb,
  calculation_mode text NOT NULL DEFAULT 'worst_classification',
  is_enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stakes_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY stk_select_auth ON public.stakes_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY stk_admin_write ON public.stakes_configs FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));
CREATE TRIGGER stk_touch BEFORE UPDATE ON public.stakes_configs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== classification_ranks =====
CREATE TABLE public.classification_ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id uuid NOT NULL REFERENCES public.formula_rule_sets(id) ON DELETE CASCADE,
  classification text NOT NULL,
  rank_value integer NOT NULL,
  label text,
  color_key text,
  is_failure_level boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.classification_ranks ENABLE ROW LEVEL SECURITY;
CREATE POLICY cr_select_auth ON public.classification_ranks FOR SELECT TO authenticated USING (true);
CREATE POLICY cr_admin_write ON public.classification_ranks FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));
CREATE TRIGGER cr_touch BEFORE UPDATE ON public.classification_ranks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== add columns to selections & exams =====
ALTER TABLE public.selections
  ADD COLUMN IF NOT EXISTS active_formula_rule_set_id uuid,
  ADD COLUMN IF NOT EXISTS active_report_template_id uuid,
  ADD COLUMN IF NOT EXISTS active_xlsx_template_id uuid,
  ADD COLUMN IF NOT EXISTS active_pdf_template_id uuid;

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS formula_rule_set_id uuid,
  ADD COLUMN IF NOT EXISTS formula_rule_set_version integer,
  ADD COLUMN IF NOT EXISTS last_calculated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_calculated_by uuid;

-- ===== SEED Default RIKKES Formula 2026 =====
DO $$
DECLARE v_rs uuid;
BEGIN
  INSERT INTO public.formula_rule_sets (rule_set_name, description, version, status, is_default, activated_at, config_json)
  VALUES ('Default RIKKES Formula 2026','Default ruleset sesuai standar RIKKES TNI AU',1,'Active',true, now(),'{}'::jsonb)
  RETURNING id INTO v_rs;

  -- BMI rules
  INSERT INTO public.bmi_rules (rule_set_id, min_value, max_value, classification, label, sort_order) VALUES
    (v_rs, NULL, 14.9, 'K2', 'BMI sangat rendah', 1),
    (v_rs, 14.9, 18.4, 'K1', 'BMI rendah', 2),
    (v_rs, 18.4, 19.9, 'C',  'BMI kurang ideal', 3),
    (v_rs, 19.9, 24.9, 'B',  'BMI ideal', 4),
    (v_rs, 24.9, 26.9, 'C',  'BMI sedikit lebih', 5),
    (v_rs, 26.9, 29.9, 'K1', 'BMI lebih', 6),
    (v_rs, 29.9, NULL, 'K2', 'BMI sangat lebih', 7);

  -- KESUM sections (included)
  INSERT INTO public.kesum_rule_configs (rule_set_id, section_key, section_name, is_included, is_required, sort_order) VALUES
    (v_rs,'pemeriksaan_umum','Pemeriksaan Umum',true,true,1),
    (v_rs,'tanda_vital','Tanda Vital',true,true,2),
    (v_rs,'penyakit_dalam','Penyakit Dalam',true,true,3),
    (v_rs,'ekg_ergo','EKG/Ergo',true,false,4),
    (v_rs,'paru','Paru FVC/FEV1',true,false,5),
    (v_rs,'neurologi','Neurologi',true,false,6),
    (v_rs,'obsgyn','Obsgyn',true,false,7),
    (v_rs,'kulit','Kulit',true,false,8),
    (v_rs,'laboratorium','Laboratorium',true,true,9),
    (v_rs,'radiologi_ro','Radiologi/RO',true,false,10),
    (v_rs,'usg','USG',true,false,11),
    (v_rs,'tht','THT',true,false,12),
    (v_rs,'bedah','Bedah',true,false,13),
    (v_rs,'atas','Atas',true,false,14),
    (v_rs,'bawah','Bawah',true,false,15),
    (v_rs,'audio_tympano','Audio dan Tympano',true,false,16),
    (v_rs,'mata','Mata',true,false,17),
    (v_rs,'gigi','Gigi/Odontogram',true,false,18),
    (v_rs,'bmi_classification','BMI Classification',true,false,19),
    -- excluded
    (v_rs,'identitas','Identitas',false,false,90),
    (v_rs,'anamnesa','Anamnesa',false,false,91),
    (v_rs,'surat_pernyataan','Surat Pernyataan',false,false,92),
    (v_rs,'jiwa_keswa','Jiwa/Keswa',false,false,93),
    (v_rs,'resume_kesimpulan','Resume/Kesimpulan',false,false,94),
    (v_rs,'rekap_paraf','Rekap Paraf',false,false,95),
    (v_rs,'kualifikasi_akhir','Kualifikasi Akhir',false,false,96);

  -- KESWA
  INSERT INTO public.keswa_rule_configs (rule_set_id) VALUES (v_rs);

  -- Final result rules (priority asc = higher priority)
  INSERT INTO public.final_result_rules (rule_set_id, condition_key, result_value, priority_order, condition_json) VALUES
    (v_rs,'incomplete','Belum Lengkap',1,'{"kesum":["Belum Lengkap"],"keswa":["Belum Lengkap"]}'),
    (v_rs,'either_th','TH',2,'{"kesum":["TH"],"keswa":["TH"]}'),
    (v_rs,'kesum_k2','TMS',3,'{"kesum":["K2"]}'),
    (v_rs,'keswa_tms','TMS',4,'{"keswa":["TMS"]}'),
    (v_rs,'default_ms','MS',99,'{}');

  -- Scoring
  INSERT INTO public.scoring_rules (rule_set_id, kesum_classification, base_score, penalty_k2, penalty_k1, penalty_c, penalty_th, minimum_score, maximum_score) VALUES
    (v_rs,'B',85,3,2,1,0,60,100),
    (v_rs,'C',75,3,2,1,0,60,100),
    (v_rs,'K1',65,3,2,1,0,60,100),
    (v_rs,'K2',55,3,2,1,0,0,100);

  -- STAKES
  INSERT INTO public.stakes_configs (rule_set_id, stakes_key, stakes_label, source_section_keys_json, calculation_mode, sort_order) VALUES
    (v_rs,'U','Umum','["pemeriksaan_umum","penyakit_dalam","tanda_vital","laboratorium","radiologi_ro","usg","tht","bedah","ekg_ergo","paru","neurologi","obsgyn","kulit"]','worst_classification',1),
    (v_rs,'A','Atas','["atas"]','direct_section_classification',2),
    (v_rs,'B','Bawah','["bawah"]','direct_section_classification',3),
    (v_rs,'D','Audio/Tympano','["audio_tympano"]','direct_section_classification',4),
    (v_rs,'L','Mata','["mata"]','direct_section_classification',5),
    (v_rs,'G','Gigi','["gigi"]','direct_section_classification',6),
    (v_rs,'J','Jiwa','["jiwa_keswa"]','direct_section_classification',7);

  -- Severity ranks
  INSERT INTO public.classification_ranks (rule_set_id, classification, rank_value, label, color_key, is_failure_level) VALUES
    (v_rs,'K2',1,'K2','red',true),
    (v_rs,'K1',2,'K1','orange',false),
    (v_rs,'C',3,'C','yellow',false),
    (v_rs,'B',4,'B','green',false),
    (v_rs,'TH',0,'TH','gray',false);
END $$;
