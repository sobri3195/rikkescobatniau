
CREATE TABLE IF NOT EXISTS public.rikkes_form_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  group_key text NOT NULL,
  status text NOT NULL DEFAULT 'Draft',
  form_data_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  submitted_by uuid,
  submitted_at timestamptz,
  returned_to_draft_by uuid,
  returned_to_draft_at timestamptz,
  return_reason text,
  approved_by uuid,
  approved_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_id, group_key)
);

CREATE INDEX IF NOT EXISTS idx_rfs_exam ON public.rikkes_form_sections(exam_id);
CREATE INDEX IF NOT EXISTS idx_rfs_candidate ON public.rikkes_form_sections(candidate_id);

ALTER TABLE public.rikkes_form_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rfs_select_auth" ON public.rikkes_form_sections
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "rfs_staff_write" ON public.rikkes_form_sections
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'dokter'::app_role,'kepala_sub_tim'::app_role,'registrasi'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'dokter'::app_role,'kepala_sub_tim'::app_role,'registrasi'::app_role]));

CREATE TRIGGER trg_rfs_touch BEFORE UPDATE ON public.rikkes_form_sections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
