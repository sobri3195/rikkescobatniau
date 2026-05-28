
-- Extend audit_logs
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS device_info text,
  ADD COLUMN IF NOT EXISTS exam_id uuid;

-- Extend document_exports
ALTER TABLE public.document_exports
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS error_message text;

-- unlock_logs
CREATE TABLE IF NOT EXISTS public.unlock_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  unlocked_by uuid NOT NULL,
  unlock_scope text NOT NULL DEFAULT 'full',
  section_keys jsonb,
  reason text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  relocked_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.unlock_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS unlock_select_auth ON public.unlock_logs;
CREATE POLICY unlock_select_auth ON public.unlock_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS unlock_super_admin_write ON public.unlock_logs;
CREATE POLICY unlock_super_admin_write ON public.unlock_logs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_unlock_logs_touch BEFORE UPDATE ON public.unlock_logs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- data_quality_checks
CREATE TABLE IF NOT EXISTS public.data_quality_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id uuid,
  issue_type text NOT NULL,
  issue_level text NOT NULL DEFAULT 'warning',
  candidate_id uuid,
  exam_id uuid,
  section_key text,
  description text,
  status text NOT NULL DEFAULT 'open',
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.data_quality_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dqc_select_auth ON public.data_quality_checks;
CREATE POLICY dqc_select_auth ON public.data_quality_checks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS dqc_staff_write ON public.data_quality_checks;
CREATE POLICY dqc_staff_write ON public.data_quality_checks
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'kepala_sub_tim'::app_role,'dokter'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'kepala_sub_tim'::app_role,'dokter'::app_role]));

CREATE TRIGGER trg_dqc_touch BEFORE UPDATE ON public.data_quality_checks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_unlock_logs_exam ON public.unlock_logs(exam_id);
CREATE INDEX IF NOT EXISTS idx_dqc_selection ON public.data_quality_checks(selection_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_candidate ON public.audit_logs(candidate_id);
