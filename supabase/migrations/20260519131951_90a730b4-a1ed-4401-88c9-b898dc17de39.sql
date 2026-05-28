
CREATE TABLE IF NOT EXISTS public.medical_history_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  exam_id uuid NOT NULL,
  identity_data_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  family_history_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  personal_history_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  female_health_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  work_history_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  followup_questions_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  other_disease_notes text,
  honesty_statement_accepted boolean NOT NULL DEFAULT false,
  candidate_signature_url text,
  candidate_signed_at timestamptz,
  doctor_signature_url text,
  doctor_examiner_name text,
  doctor_signed_at timestamptz,
  doctor_resume text,
  doctor_notes_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'Draft',
  created_by uuid,
  updated_by uuid,
  submitted_by uuid,
  submitted_at timestamptz,
  returned_to_draft_by uuid,
  returned_to_draft_at timestamptz,
  return_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_id)
);

CREATE INDEX IF NOT EXISTS idx_mhf_candidate ON public.medical_history_forms(candidate_id);
CREATE INDEX IF NOT EXISTS idx_mhf_exam ON public.medical_history_forms(exam_id);

ALTER TABLE public.medical_history_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mhf_select_auth"
  ON public.medical_history_forms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "mhf_staff_write"
  ON public.medical_history_forms FOR ALL
  TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'dokter'::app_role, 'kepala_sub_tim'::app_role, 'registrasi'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'dokter'::app_role, 'kepala_sub_tim'::app_role, 'registrasi'::app_role]));

CREATE TRIGGER trg_mhf_touch_updated_at
  BEFORE UPDATE ON public.medical_history_forms
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();
