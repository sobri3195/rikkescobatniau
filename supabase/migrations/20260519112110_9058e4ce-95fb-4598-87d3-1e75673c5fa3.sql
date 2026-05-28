
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('super_admin','admin','dokter','registrasi','kepala_sub_tim','viewer');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  rank TEXT,
  nrp_nip TEXT,
  unit TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role = ANY(_roles)) $$;

-- Auto create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (auth_user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email);
  -- default role: viewer
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Selections
CREATE TABLE public.selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  year_label TEXT NOT NULL,
  participant_label TEXT NOT NULL DEFAULT 'Calon Pasis',
  institution_header_line_1 TEXT NOT NULL DEFAULT 'MARKAS BESAR TNI ANGKATAN UDARA',
  institution_header_line_2 TEXT NOT NULL DEFAULT 'PUSAT KESEHATAN',
  report_title TEXT NOT NULL DEFAULT 'HASIL PEMERIKSAAN KESEHATAN',
  report_subtitle TEXT,
  location TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'Draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.selections ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_selections_updated BEFORE UPDATE ON public.selections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Candidates
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id UUID NOT NULL REFERENCES public.selections(id) ON DELETE CASCADE,
  serial_number INT,
  test_number TEXT,
  pok_korp TEXT,
  panda TEXT,
  unit_position TEXT,
  full_name TEXT NOT NULL,
  rank TEXT,
  nrp_nip TEXT,
  generation TEXT,
  birth_place TEXT,
  birth_date DATE,
  gender TEXT,
  group_name TEXT,
  address TEXT,
  phone TEXT,
  combined_identity TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_candidates_selection ON public.candidates(selection_id);
CREATE TRIGGER trg_candidates_updated BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Exams
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL UNIQUE REFERENCES public.candidates(id) ON DELETE CASCADE,
  selection_id UUID NOT NULL REFERENCES public.selections(id) ON DELETE CASCADE,
  exam_status TEXT NOT NULL DEFAULT 'In Progress',
  progress_percentage NUMERIC NOT NULL DEFAULT 0,
  kesum_classification TEXT,
  keswa_status TEXT,
  final_result TEXT,
  final_score NUMERIC,
  finalized_by UUID,
  finalized_at TIMESTAMPTZ,
  unlocked_by UUID,
  unlocked_at TIMESTAMPTZ,
  unlock_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_exams_selection ON public.exams(selection_id);
CREATE TRIGGER trg_exams_updated BEFORE UPDATE ON public.exams FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Exam sections
CREATE TABLE public.exam_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  section_name TEXT NOT NULL,
  section_status TEXT NOT NULL DEFAULT 'Draft',
  classification TEXT,
  findings TEXT,
  notes TEXT,
  examiner_id UUID,
  examined_at TIMESTAMPTZ,
  submitted_by UUID,
  submitted_at TIMESTAMPTZ,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  revision_reason TEXT,
  revision_requested_by UUID,
  revision_requested_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exam_id, section_key)
);
ALTER TABLE public.exam_sections ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sections_exam ON public.exam_sections(exam_id);
CREATE TRIGGER trg_sections_updated BEFORE UPDATE ON public.exam_sections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Medical measurements
CREATE TABLE public.medical_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL UNIQUE REFERENCES public.exams(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  height_cm NUMERIC,
  weight_kg NUMERIC,
  bmi NUMERIC,
  bmi_classification TEXT,
  weight_difference NUMERIC,
  chest_or_waist_lp NUMERIC,
  min_ideal_weight NUMERIC,
  max_ideal_weight NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.medical_measurements ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_mm_updated BEFORE UPDATE ON public.medical_measurements FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Medical summary
CREATE TABLE public.medical_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL UNIQUE REFERENCES public.exams(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  count_b INT NOT NULL DEFAULT 0,
  count_c INT NOT NULL DEFAULT 0,
  count_k1 INT NOT NULL DEFAULT 0,
  count_k2 INT NOT NULL DEFAULT 0,
  kesum_classification TEXT,
  keswa_status TEXT,
  final_result TEXT,
  final_score NUMERIC,
  k1_notes TEXT,
  k2_notes TEXT,
  attention_notes TEXT,
  parade_notes TEXT,
  initial_result TEXT,
  after_parade_result TEXT,
  rakor_result TEXT,
  pra_pantukhir_result TEXT,
  suggestions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.medical_summary ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_ms_updated BEFORE UPDATE ON public.medical_summary FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Audit log
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  module TEXT,
  record_id UUID,
  candidate_id UUID,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =========================
-- RLS Policies
-- =========================

-- profiles: own + read-all if authenticated
CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth_user_id = auth.uid());
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin']::app_role[]));

-- user_roles: select own, admins manage
CREATE POLICY "user_roles_select_auth" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- selections: authenticated read; admin write
CREATE POLICY "selections_select_auth" ON public.selections FOR SELECT TO authenticated USING (true);
CREATE POLICY "selections_admin_write" ON public.selections FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin']::app_role[]));

-- candidates: authenticated read; staff write
CREATE POLICY "candidates_select_auth" ON public.candidates FOR SELECT TO authenticated USING (true);
CREATE POLICY "candidates_staff_write" ON public.candidates FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','registrasi']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','registrasi']::app_role[]));

-- exams + sections + measurements + summary: authenticated read; medical staff write
CREATE POLICY "exams_select_auth" ON public.exams FOR SELECT TO authenticated USING (true);
CREATE POLICY "exams_staff_write" ON public.exams FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','kepala_sub_tim','registrasi']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','kepala_sub_tim','registrasi']::app_role[]));

CREATE POLICY "sections_select_auth" ON public.exam_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "sections_staff_write" ON public.exam_sections FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','kepala_sub_tim','registrasi']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','kepala_sub_tim','registrasi']::app_role[]));

CREATE POLICY "mm_select_auth" ON public.medical_measurements FOR SELECT TO authenticated USING (true);
CREATE POLICY "mm_staff_write" ON public.medical_measurements FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','registrasi']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','registrasi']::app_role[]));

CREATE POLICY "ms_select_auth" ON public.medical_summary FOR SELECT TO authenticated USING (true);
CREATE POLICY "ms_staff_write" ON public.medical_summary FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','kepala_sub_tim']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','dokter','kepala_sub_tim']::app_role[]));

-- audit_logs: select only super_admin/viewer; insert by authenticated
CREATE POLICY "audit_select_admin" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','viewer']::app_role[]));
CREATE POLICY "audit_insert_auth" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
