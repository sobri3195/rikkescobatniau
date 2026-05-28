ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS bag_number text,
  ADD COLUMN IF NOT EXISTS corps text,
  ADD COLUMN IF NOT EXISTS dikma_diktuk text,
  ADD COLUMN IF NOT EXISTS tmt_jabatan date,
  ADD COLUMN IF NOT EXISTS age_text text;

CREATE INDEX IF NOT EXISTS idx_candidates_bag_number ON public.candidates(selection_id, bag_number) WHERE bag_number IS NOT NULL;

INSERT INTO public.role_permissions (role, permission_key, allowed) VALUES
  ('super_admin'::app_role, 'candidate.bulk_import_xlsx', true),
  ('admin'::app_role,       'candidate.bulk_import_xlsx', true),
  ('registrasi'::app_role,  'candidate.bulk_import_xlsx', true),
  ('super_admin'::app_role, 'candidate.download_import_template', true),
  ('admin'::app_role,       'candidate.download_import_template', true),
  ('registrasi'::app_role,  'candidate.download_import_template', true),
  ('super_admin'::app_role, 'candidate.download_import_error_report', true),
  ('admin'::app_role,       'candidate.download_import_error_report', true),
  ('registrasi'::app_role,  'candidate.download_import_error_report', true)
ON CONFLICT (role, permission_key) DO UPDATE SET allowed = true;