INSERT INTO public.role_permissions (role, permission_key, allowed)
VALUES
  ('pimpinan_viewer'::app_role, 'dashboard.view',                     true),
  ('pimpinan_viewer'::app_role, 'dashboard.progress.view',            true),
  ('pimpinan_viewer'::app_role, 'selections.view',                    true),
  ('pimpinan_viewer'::app_role, 'selections.progress.view',           true),
  ('pimpinan_viewer'::app_role, 'report.rekap.view_readonly',         true),
  ('pimpinan_viewer'::app_role, 'report.laporan_tahap.view_readonly', true),
  ('pimpinan_viewer'::app_role, 'report.resume.view_readonly',        true),
  ('pimpinan_viewer'::app_role, 'candidates.view_summary',            true),
  ('pimpinan_viewer'::app_role, 'harih.view_summary',                 true)
ON CONFLICT (role, permission_key) DO UPDATE SET allowed = EXCLUDED.allowed;

CREATE INDEX IF NOT EXISTS idx_exams_selection_status ON public.exams (selection_id, exam_status);
CREATE INDEX IF NOT EXISTS idx_exams_selection_stage  ON public.exams (selection_id, hari_h_stage);
CREATE INDEX IF NOT EXISTS idx_exams_finalized_at     ON public.exams (finalized_at) WHERE finalized_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_candidates_selection   ON public.candidates (selection_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_exams_updated_at       ON public.exams (updated_at DESC);
