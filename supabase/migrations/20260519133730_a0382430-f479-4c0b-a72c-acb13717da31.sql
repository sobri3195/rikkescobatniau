
-- Master Subtim
CREATE TABLE public.medical_subteams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id uuid,
  section_key text NOT NULL,
  section_name text NOT NULL,
  display_title text NOT NULL,
  responsible_role text,
  doctor_name text,
  doctor_title text,
  rank text,
  nrp text,
  signature_url text,
  location text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medical_subteams ENABLE ROW LEVEL SECURITY;
CREATE POLICY mst_select_auth ON public.medical_subteams FOR SELECT TO authenticated USING (true);
CREATE POLICY mst_admin_write ON public.medical_subteams FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));
CREATE TRIGGER trg_mst_touch BEFORE UPDATE ON public.medical_subteams FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Shared columns helper macro replicated per table
CREATE TABLE public.exam_general (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  exam_id uuid NOT NULL,
  height_cm numeric, weight_kg numeric, leg_length_cm numeric,
  chest_inspiration_cm numeric, chest_expiration_cm numeric,
  anamnesis text, conclusion text, qualification_u text,
  examiner_id uuid, examined_at timestamptz,
  status text NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(exam_id)
);
CREATE TABLE public.exam_eye (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL, exam_id uuid NOT NULL,
  visus_od text, visus_os text, color_blindness text,
  dp_od text, dp_os text, busur_percentage text,
  eso_foria_od text, eso_foria_os text,
  ekso_foria_od text, ekso_foria_os text,
  vertical_foria_od text, vertical_foria_os text,
  contact_lens text, contact_lens_notes text,
  other_notes text, conclusion text,
  qualification_u text, qualification_l text,
  examiner_id uuid, examined_at timestamptz,
  status text NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(exam_id)
);
CREATE TABLE public.exam_dental (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL, exam_id uuid NOT NULL,
  dmf numeric, vital_teeth_count integer, occlusion_contact_count integer,
  dental_abnormality text, oral_abnormality text, jaw_abnormality text,
  oral_hygiene text, conclusion text, qualification_g text,
  examiner_id uuid, examined_at timestamptz,
  status text NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(exam_id)
);
CREATE TABLE public.dental_tooth_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_dental_id uuid NOT NULL REFERENCES public.exam_dental(id) ON DELETE CASCADE,
  tooth_number integer NOT NULL,
  markers_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(exam_dental_id, tooth_number)
);
CREATE TABLE public.exam_internal_medicine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL, exam_id uuid NOT NULL,
  blood_pressure text, pulse text, heart text, lung text, abdomen text,
  conclusion text, qualification_u text,
  examiner_id uuid, examined_at timestamptz,
  status text NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(exam_id)
);
CREATE TABLE public.exam_surgery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL, exam_id uuid NOT NULL,
  general_condition text, upper_extremity text, lower_extremity text,
  spine text, inguinal text, posture text, other_notes text,
  conclusion text, qualification_u text,
  examiner_id uuid, examined_at timestamptz,
  status text NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(exam_id)
);
CREATE TABLE public.exam_usg (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL, exam_id uuid NOT NULL,
  examination text, conclusion text, qualification_u text,
  examiner_id uuid, examined_at timestamptz,
  status text NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(exam_id)
);
CREATE TABLE public.exam_radiology (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL, exam_id uuid NOT NULL,
  examination text, conclusion text, qualification_u text,
  examiner_id uuid, examined_at timestamptz,
  status text NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(exam_id)
);
CREATE TABLE public.exam_cardiology (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL, exam_id uuid NOT NULL,
  examination text, conclusion text, qualification_u text,
  examiner_id uuid, examined_at timestamptz,
  status text NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(exam_id)
);
CREATE TABLE public.sector_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL, exam_id uuid NOT NULL,
  section_key text NOT NULL, section_name text,
  officer_id uuid, officer_name text,
  signature_url text, signed_at timestamptz,
  status text NOT NULL DEFAULT 'Pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(exam_id, section_key)
);

-- Enable RLS + policies + triggers in a loop
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'exam_general','exam_eye','exam_dental','dental_tooth_records',
    'exam_internal_medicine','exam_surgery','exam_usg','exam_radiology',
    'exam_cardiology','sector_signoffs'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)$p$, t||'_select_auth', t);
    EXECUTE format($p$CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'dokter'::app_role,'kepala_sub_tim'::app_role,'registrasi'::app_role])) WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'dokter'::app_role,'kepala_sub_tim'::app_role,'registrasi'::app_role]))$p$, t||'_staff_write', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', 'trg_'||t||'_touch', t);
  END LOOP;
END $$;

-- Extra columns
ALTER TABLE public.document_exports
  ADD COLUMN IF NOT EXISTS template_type text,
  ADD COLUMN IF NOT EXISTS section_key text,
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_finalized boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS generated_from_blanko boolean NOT NULL DEFAULT false;

ALTER TABLE public.exam_sections
  ADD COLUMN IF NOT EXISTS printable_template_key text,
  ADD COLUMN IF NOT EXISTS qualification_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS form_data_json jsonb NOT NULL DEFAULT '{}'::jsonb;
