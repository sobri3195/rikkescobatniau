
-- Import sessions
CREATE TABLE public.import_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id uuid,
  file_name text,
  file_size bigint,
  file_url text,
  import_type text NOT NULL DEFAULT 'workbook_rikkes',
  import_strategy text NOT NULL DEFAULT 'candidates_plus_results',
  total_rows integer NOT NULL DEFAULT 0,
  success_rows integer NOT NULL DEFAULT 0,
  failed_rows integer NOT NULL DEFAULT 0,
  warning_rows integer NOT NULL DEFAULT 0,
  skipped_rows integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Draft',
  options_json jsonb,
  mapping_json jsonb,
  detected_sheets_json jsonb,
  started_by uuid,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.import_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY is_select_auth ON public.import_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY is_staff_write ON public.import_sessions FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));
CREATE TRIGGER trg_is_updated BEFORE UPDATE ON public.import_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.import_session_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_session_id uuid NOT NULL REFERENCES public.import_sessions(id) ON DELETE CASCADE,
  row_number integer,
  sheet_name text,
  candidate_id uuid,
  exam_id uuid,
  test_number text,
  full_name text,
  row_status text NOT NULL DEFAULT 'Pending',
  error_messages_json jsonb,
  warning_messages_json jsonb,
  raw_data_json jsonb,
  mapped_data_json jsonb,
  before_data_json jsonb,
  action_taken text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.import_session_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY isr_select_auth ON public.import_session_rows FOR SELECT TO authenticated USING (true);
CREATE POLICY isr_staff_write ON public.import_session_rows FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));
CREATE INDEX idx_isr_session ON public.import_session_rows(import_session_id);

CREATE TABLE public.import_mapping_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  workbook_type text NOT NULL DEFAULT 'rikkes',
  sheet_mapping_json jsonb,
  column_mapping_json jsonb,
  row_pattern_json jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.import_mapping_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY imt_select_auth ON public.import_mapping_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY imt_staff_write ON public.import_mapping_templates FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));
CREATE TRIGGER trg_imt_updated BEFORE UPDATE ON public.import_mapping_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Link import sessions in audit and candidates
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS import_session_id uuid;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS source_import_session_id uuid;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS source_import_session_id uuid;
