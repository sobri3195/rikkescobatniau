
-- ============== juknis_parameter_rules ==============
CREATE TABLE public.juknis_parameter_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id uuid,
  selection_type text,
  gender text,
  parameter_key text NOT NULL,
  parameter_label text,
  min_value numeric,
  max_value numeric,
  unit text,
  classification text,
  is_blocking boolean NOT NULL DEFAULT false,
  notes text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.juknis_parameter_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY jpr_select_auth ON public.juknis_parameter_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY jpr_admin_write ON public.juknis_parameter_rules FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));
CREATE TRIGGER jpr_touch BEFORE UPDATE ON public.juknis_parameter_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============== exam_ent (THT) ==============
CREATE TABLE public.exam_ent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  ear_right text,
  ear_left text,
  nose text,
  throat text,
  larynx text,
  hearing_notes text,
  conclusion text,
  qualification_u text,
  examiner_id uuid,
  examined_at timestamptz,
  status text NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.exam_ent ENABLE ROW LEVEL SECURITY;
CREATE POLICY exam_ent_select_auth ON public.exam_ent FOR SELECT TO authenticated USING (true);
CREATE POLICY exam_ent_staff_write ON public.exam_ent FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'dokter'::app_role,'kepala_sub_tim'::app_role,'registrasi'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'dokter'::app_role,'kepala_sub_tim'::app_role,'registrasi'::app_role]));
CREATE TRIGGER exam_ent_touch BEFORE UPDATE ON public.exam_ent
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_exam_ent_exam ON public.exam_ent(exam_id);

-- ============== exam_neurology ==============
CREATE TABLE public.exam_neurology (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  is_optional boolean NOT NULL DEFAULT true,
  consciousness text,
  cranial_nerves text,
  motoric text,
  sensoric text,
  reflexes text,
  coordination text,
  autonomic text,
  conclusion text,
  qualification_u text,
  examiner_id uuid,
  examined_at timestamptz,
  status text NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.exam_neurology ENABLE ROW LEVEL SECURITY;
CREATE POLICY exam_neuro_select_auth ON public.exam_neurology FOR SELECT TO authenticated USING (true);
CREATE POLICY exam_neuro_staff_write ON public.exam_neurology FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'dokter'::app_role,'kepala_sub_tim'::app_role,'registrasi'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'dokter'::app_role,'kepala_sub_tim'::app_role,'registrasi'::app_role]));
CREATE TRIGGER exam_neuro_touch BEFORE UPDATE ON public.exam_neurology
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_exam_neuro_exam ON public.exam_neurology(exam_id);

-- ============== exam_eye_vision (Mata Lihat/Visus) ==============
CREATE TABLE public.exam_eye_vision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  visus_od text,
  visus_os text,
  visus_corrected_od text,
  visus_corrected_os text,
  refraction_od text,
  refraction_os text,
  color_perception text,
  stereopsis text,
  field_of_vision text,
  conclusion text,
  qualification_l text,
  examiner_id uuid,
  examined_at timestamptz,
  status text NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.exam_eye_vision ENABLE ROW LEVEL SECURITY;
CREATE POLICY exam_eye_vis_select_auth ON public.exam_eye_vision FOR SELECT TO authenticated USING (true);
CREATE POLICY exam_eye_vis_staff_write ON public.exam_eye_vision FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'dokter'::app_role,'kepala_sub_tim'::app_role,'registrasi'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'dokter'::app_role,'kepala_sub_tim'::app_role,'registrasi'::app_role]));
CREATE TRIGGER exam_eye_vis_touch BEFORE UPDATE ON public.exam_eye_vision
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_exam_eye_vis_exam ON public.exam_eye_vision(exam_id);

-- ============== medical_attachments (lampiran terpadu) ==============
CREATE TABLE public.medical_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  section_key text NOT NULL,
  attachment_type text NOT NULL,
  file_name text,
  file_url text NOT NULL,
  file_size bigint,
  mime_type text,
  caption text,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medical_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY med_att_select_auth ON public.medical_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY med_att_staff_write ON public.medical_attachments FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'dokter'::app_role,'kepala_sub_tim'::app_role,'registrasi'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'dokter'::app_role,'kepala_sub_tim'::app_role,'registrasi'::app_role]));
CREATE TRIGGER med_att_touch BEFORE UPDATE ON public.medical_attachments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_med_att_exam ON public.medical_attachments(exam_id, section_key);

-- ============== candidates.test_number_status ==============
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS test_number_status text NOT NULL DEFAULT 'Belum Ada';

-- ============== anamnesa columns in exam_sections ==============
ALTER TABLE public.exam_sections
  ADD COLUMN IF NOT EXISTS anamnesis_status text,
  ADD COLUMN IF NOT EXISTS clear_by uuid,
  ADD COLUMN IF NOT EXISTS clear_at timestamptz,
  ADD COLUMN IF NOT EXISTS clear_note text,
  ADD COLUMN IF NOT EXISTS bypass_reason text,
  ADD COLUMN IF NOT EXISTS bypass_by uuid,
  ADD COLUMN IF NOT EXISTS bypass_at timestamptz,
  ADD COLUMN IF NOT EXISTS bypass_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS bypass_reviewed_at timestamptz;

-- ============== triggers untuk recompute hari_h_stage saat exam_ent/neuro/eye_vision berubah ==============
CREATE TRIGGER trg_hh_ent AFTER INSERT OR UPDATE OR DELETE ON public.exam_ent
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_hari_h_stage();
CREATE TRIGGER trg_hh_neuro AFTER INSERT OR UPDATE OR DELETE ON public.exam_neurology
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_hari_h_stage();
CREATE TRIGGER trg_hh_eye_vis AFTER INSERT OR UPDATE OR DELETE ON public.exam_eye_vision
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_hari_h_stage();
