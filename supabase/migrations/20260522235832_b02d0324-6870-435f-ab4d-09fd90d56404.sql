
-- Add new columns to candidates
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS class_group text,
  ADD COLUMN IF NOT EXISTS pnd_code text,
  ADD COLUMN IF NOT EXISTS sort_order integer;

CREATE INDEX IF NOT EXISTS idx_candidates_class_group ON public.candidates(class_group);
CREATE INDEX IF NOT EXISTS idx_candidates_sort_order ON public.candidates(sort_order);

-- Sessions
CREATE TABLE IF NOT EXISTS public.test_number_import_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id uuid REFERENCES public.selections(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_type text,
  source_format text DEFAULT 'KES',
  total_rows integer DEFAULT 0,
  matched_rows integer DEFAULT 0,
  updated_rows integer DEFAULT 0,
  skipped_rows integer DEFAULT 0,
  error_rows integer DEFAULT 0,
  ambiguous_rows integer DEFAULT 0,
  not_found_rows integer DEFAULT 0,
  status text NOT NULL DEFAULT 'Draft',
  options_json jsonb DEFAULT '{}'::jsonb,
  started_by uuid,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_tnis_touch BEFORE UPDATE ON public.test_number_import_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.test_number_import_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tnis_rw ON public.test_number_import_sessions;
CREATE POLICY tnis_rw ON public.test_number_import_sessions
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'registrasi'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'registrasi'::app_role]));

-- Rows
CREATE TABLE IF NOT EXISTS public.test_number_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.test_number_import_sessions(id) ON DELETE CASCADE,
  source_row_number integer,
  candidate_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  exam_id uuid REFERENCES public.exams(id) ON DELETE SET NULL,
  old_test_number text,
  new_test_number text,
  match_confidence text,
  row_status text NOT NULL DEFAULT 'pending',
  raw_data_json jsonb,
  mapped_data_json jsonb,
  error_messages_json jsonb,
  warning_messages_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tnir_session ON public.test_number_import_rows(session_id);
CREATE INDEX IF NOT EXISTS idx_tnir_candidate ON public.test_number_import_rows(candidate_id);

ALTER TABLE public.test_number_import_rows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tnir_rw ON public.test_number_import_rows;
CREATE POLICY tnir_rw ON public.test_number_import_rows
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'registrasi'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'registrasi'::app_role]));
