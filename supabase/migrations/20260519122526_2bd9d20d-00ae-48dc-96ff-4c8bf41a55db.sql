
-- ============================================================
-- PHASE 9A: QA Infrastructure
-- ============================================================

-- 1. qa_test_cases
CREATE TABLE public.qa_test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_code text NOT NULL UNIQUE,
  title text NOT NULL,
  module text NOT NULL,
  feature text,
  description text,
  precondition text,
  steps_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected_result text,
  priority text NOT NULL DEFAULT 'Medium',
  test_type text NOT NULL DEFAULT 'Functional',
  status text NOT NULL DEFAULT 'Ready',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_test_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_tc_select ON public.qa_test_cases FOR SELECT TO authenticated USING (true);
CREATE POLICY qa_tc_write ON public.qa_test_cases FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));
CREATE TRIGGER trg_qa_tc_updated BEFORE UPDATE ON public.qa_test_cases FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. uat_sessions
CREATE TABLE public.uat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_name text NOT NULL,
  selection_id uuid,
  description text,
  scope_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'Draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.uat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY uat_s_select ON public.uat_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY uat_s_write ON public.uat_sessions FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));
CREATE TRIGGER trg_uat_s_updated BEFORE UPDATE ON public.uat_sessions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. qa_test_runs
CREATE TABLE public.qa_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id uuid NOT NULL REFERENCES public.qa_test_cases(id) ON DELETE CASCADE,
  uat_session_id uuid REFERENCES public.uat_sessions(id) ON DELETE SET NULL,
  run_by uuid,
  run_at timestamptz NOT NULL DEFAULT now(),
  result text NOT NULL DEFAULT 'Not Run',
  actual_result text,
  evidence_url text,
  notes text,
  linked_issue_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_test_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_tr_select ON public.qa_test_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY qa_tr_write ON public.qa_test_runs FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'kepala_sub_tim'::app_role,'dokter'::app_role,'registrasi'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'kepala_sub_tim'::app_role,'dokter'::app_role,'registrasi'::app_role]));
CREATE TRIGGER trg_qa_tr_updated BEFORE UPDATE ON public.qa_test_runs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. qa_issues
CREATE TABLE public.qa_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_code text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  module text,
  severity text NOT NULL DEFAULT 'Medium',
  priority text NOT NULL DEFAULT 'Medium',
  status text NOT NULL DEFAULT 'Open',
  reported_by uuid,
  assigned_to uuid,
  related_test_run_id uuid REFERENCES public.qa_test_runs(id) ON DELETE SET NULL,
  related_candidate_id uuid,
  related_exam_id uuid,
  related_export_id uuid,
  evidence_url text,
  expected_result text,
  actual_result text,
  root_cause text,
  resolution_notes text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_i_select ON public.qa_issues FOR SELECT TO authenticated USING (true);
CREATE POLICY qa_i_write ON public.qa_issues FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'kepala_sub_tim'::app_role,'dokter'::app_role,'registrasi'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'kepala_sub_tim'::app_role,'dokter'::app_role,'registrasi'::app_role]));
CREATE TRIGGER trg_qa_i_updated BEFORE UPDATE ON public.qa_issues FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. uat_feedback
CREATE TABLE public.uat_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uat_session_id uuid REFERENCES public.uat_sessions(id) ON DELETE CASCADE,
  user_id uuid,
  role text,
  module text,
  feedback_type text NOT NULL DEFAULT 'Bug',
  feedback_text text NOT NULL,
  severity text NOT NULL DEFAULT 'Medium',
  status text NOT NULL DEFAULT 'New',
  converted_issue_id uuid REFERENCES public.qa_issues(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.uat_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY uat_f_select ON public.uat_feedback FOR SELECT TO authenticated USING (true);
CREATE POLICY uat_f_insert_self ON public.uat_feedback FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY uat_f_admin_write ON public.uat_feedback FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));
CREATE TRIGGER trg_uat_f_updated BEFORE UPDATE ON public.uat_feedback FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. uat_signoffs
CREATE TABLE public.uat_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uat_session_id uuid REFERENCES public.uat_sessions(id) ON DELETE CASCADE,
  signed_by uuid NOT NULL,
  role text NOT NULL,
  signoff_scope text,
  decision text NOT NULL,
  notes text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.uat_signoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY uat_so_select ON public.uat_signoffs FOR SELECT TO authenticated USING (true);
CREATE POLICY uat_so_write ON public.uat_signoffs FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'kepala_sub_tim'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'kepala_sub_tim'::app_role]));

-- 7. go_live_checklists
CREATE TABLE public.go_live_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_name text NOT NULL,
  selection_id uuid,
  status text NOT NULL DEFAULT 'In Progress',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.go_live_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY glc_select ON public.go_live_checklists FOR SELECT TO authenticated USING (true);
CREATE POLICY glc_write ON public.go_live_checklists FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));
CREATE TRIGGER trg_glc_updated BEFORE UPDATE ON public.go_live_checklists FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 8. go_live_checklist_items
CREATE TABLE public.go_live_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.go_live_checklists(id) ON DELETE CASCADE,
  category text NOT NULL,
  item_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'Not Started',
  is_critical boolean NOT NULL DEFAULT false,
  evidence_url text,
  verified_by uuid,
  verified_at timestamptz,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.go_live_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY glci_select ON public.go_live_checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY glci_write ON public.go_live_checklist_items FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'kepala_sub_tim'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'kepala_sub_tim'::app_role]));
CREATE TRIGGER trg_glci_updated BEFORE UPDATE ON public.go_live_checklist_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 9. qa_test_packs
CREATE TABLE public.qa_test_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_name text NOT NULL,
  description text,
  module text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_test_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_tp_select ON public.qa_test_packs FOR SELECT TO authenticated USING (true);
CREATE POLICY qa_tp_write ON public.qa_test_packs FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));
CREATE TRIGGER trg_qa_tp_updated BEFORE UPDATE ON public.qa_test_packs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 10. qa_test_pack_items
CREATE TABLE public.qa_test_pack_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_pack_id uuid NOT NULL REFERENCES public.qa_test_packs(id) ON DELETE CASCADE,
  test_case_id uuid NOT NULL REFERENCES public.qa_test_cases(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_test_pack_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_tpi_select ON public.qa_test_pack_items FOR SELECT TO authenticated USING (true);
CREATE POLICY qa_tpi_write ON public.qa_test_pack_items FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));

-- 11. formula_validation_cases
CREATE TABLE public.formula_validation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_code text NOT NULL UNIQUE,
  case_name text NOT NULL,
  description text,
  rule_set_id uuid,
  input_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  actual_json jsonb,
  last_result text DEFAULT 'Not Run',
  last_run_at timestamptz,
  last_run_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.formula_validation_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY fvc_select ON public.formula_validation_cases FOR SELECT TO authenticated USING (true);
CREATE POLICY fvc_write ON public.formula_validation_cases FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'kepala_sub_tim'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role,'kepala_sub_tim'::app_role]));
CREATE TRIGGER trg_fvc_updated BEFORE UPDATE ON public.formula_validation_cases FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Helpful indexes
CREATE INDEX idx_qa_test_runs_case ON public.qa_test_runs(test_case_id);
CREATE INDEX idx_qa_test_runs_session ON public.qa_test_runs(uat_session_id);
CREATE INDEX idx_qa_issues_status ON public.qa_issues(status);
CREATE INDEX idx_qa_issues_severity ON public.qa_issues(severity);
CREATE INDEX idx_uat_feedback_session ON public.uat_feedback(uat_session_id);
CREATE INDEX idx_glci_checklist ON public.go_live_checklist_items(checklist_id);

-- Storage bucket for QA evidence (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('qa-evidence', 'qa-evidence', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "qa_evidence_read_auth"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'qa-evidence');

CREATE POLICY "qa_evidence_insert_auth"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'qa-evidence');

CREATE POLICY "qa_evidence_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'qa-evidence' AND owner = auth.uid());

CREATE POLICY "qa_evidence_delete_admin"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'qa-evidence' AND has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'admin'::app_role]));

-- ============================================================
-- SEED DATA
-- ============================================================

-- Default test cases
INSERT INTO public.qa_test_cases (test_case_code, title, module, feature, description, precondition, steps_json, expected_result, priority, test_type, status) VALUES
('TC-AUTH-001','Login sebagai Super Admin','Auth','Login','Verifikasi login super admin','Akun super admin tersedia','[{"step_number":1,"instruction":"Buka /login","expected":"Form login tampil"},{"step_number":2,"instruction":"Input kredensial super admin","expected":"Login berhasil dan diarahkan ke dashboard"}]','Super admin masuk ke dashboard','High','Functional','Ready'),
('TC-AUTH-002','Login sebagai Admin/Panitia','Auth','Login','Verifikasi login admin','Akun admin tersedia','[{"step_number":1,"instruction":"Login dengan akun admin","expected":"Masuk dashboard dengan menu admin"}]','Admin masuk dengan menu sesuai role','High','Functional','Ready'),
('TC-AUTH-003','Login Petugas Registrasi','Auth','Login','Verifikasi role registrasi','Akun registrasi tersedia','[{"step_number":1,"instruction":"Login","expected":"Akses terbatas pada identitas peserta"}]','Menu terbatas tampil','High','Permission','Ready'),
('TC-AUTH-004','Login Dokter','Auth','Login','Verifikasi role dokter','Akun dokter tersedia','[{"step_number":1,"instruction":"Login","expected":"Bisa akses section pemeriksaan"}]','Section pemeriksaan dapat diakses','High','Permission','Ready'),
('TC-AUTH-005','Login Kepala Sub Tim','Auth','Login','Verifikasi role kepala','Akun kepala tersedia','[{"step_number":1,"instruction":"Login","expected":"Bisa approve dan sign-off"}]','Menu approval tampil','High','Permission','Ready'),
('TC-AUTH-006','Login Viewer/Auditor','Auth','Login','Verifikasi read-only','Akun viewer tersedia','[{"step_number":1,"instruction":"Login","expected":"Semua read-only"}]','Tombol edit tidak tampil','High','Permission','Ready'),
('TC-AUTH-007','Role tidak berwenang ditolak','Auth','Permission','Akses menu terbatas','Login non-admin','[{"step_number":1,"instruction":"Akses /formula-config sebagai dokter","expected":"Ditolak/Redirect"}]','Akses ditolak','Critical','Security','Ready'),

('TC-SEL-001','Create Selection','Master Seleksi','CRUD','Buat seleksi baru','Login admin','[{"step_number":1,"instruction":"Buka /selections, klik Tambah","expected":"Form tampil"},{"step_number":2,"instruction":"Isi nama, tahun, header","expected":"Tersimpan"}]','Selection baru muncul di list','High','Functional','Ready'),
('TC-SEL-002','Update Selection','Master Seleksi','CRUD','Edit seleksi','Selection ada','[{"step_number":1,"instruction":"Edit selection","expected":"Berhasil simpan"}]','Data terupdate','Medium','Functional','Ready'),
('TC-SEL-003','Archive Selection','Master Seleksi','CRUD','Arsipkan seleksi','Selection ada','[{"step_number":1,"instruction":"Archive","expected":"Status berubah"}]','Status archived','Medium','Functional','Ready'),
('TC-SEL-004','Header laporan dari master','Export','Header','Header export ikuti seleksi','Selection ada','[{"step_number":1,"instruction":"Export XLSX","expected":"Header sesuai master"}]','Header benar','High','Functional','Ready'),

('TC-CAN-001','Create Candidate','Master Peserta','CRUD','Buat peserta','Selection ada','[{"step_number":1,"instruction":"Tambah peserta","expected":"Tersimpan"}]','Peserta dibuat','High','Functional','Ready'),
('TC-CAN-002','Duplicate test number ditolak','Master Peserta','Validation','Tolak duplicate','Peserta ada','[{"step_number":1,"instruction":"Buat peserta dengan no test sama","expected":"Error"}]','Validation error','High','Data Quality','Ready'),
('TC-CAN-003','Auto-create exam saat candidate','Master Peserta','Trigger','Trigger DB','Selection ada','[{"step_number":1,"instruction":"Buat peserta","expected":"Exam otomatis dibuat"}]','Exam ada','Critical','Functional','Ready'),
('TC-CAN-004','Auto-create 25 section','Master Peserta','Trigger','Trigger DB','Selection ada','[{"step_number":1,"instruction":"Buat peserta","expected":"25 section dibuat"}]','25 section ada','Critical','Functional','Ready'),
('TC-CAN-005','Edit Candidate','Master Peserta','CRUD','Edit','Peserta ada','[{"step_number":1,"instruction":"Edit","expected":"Tersimpan"}]','Berhasil','Medium','Functional','Ready'),
('TC-CAN-006','Soft delete Candidate','Master Peserta','CRUD','Soft delete','Peserta ada','[{"step_number":1,"instruction":"Delete","expected":"deleted_at terisi"}]','Soft deleted','Medium','Functional','Ready'),

('TC-SEC-001','Save draft section','Section','Workflow','Simpan draft','Exam ada','[{"step_number":1,"instruction":"Isi findings, save draft","expected":"Tersimpan"}]','Draft tersimpan','High','Functional','Ready'),
('TC-SEC-002','Submit section','Section','Workflow','Submit','Draft ada','[{"step_number":1,"instruction":"Submit","expected":"Status Submitted"}]','Status berubah','High','Functional','Ready'),
('TC-SEC-003','Request revision','Section','Workflow','Request revisi','Section submitted','[{"step_number":1,"instruction":"Request revision dengan alasan","expected":"Status Revision"}]','Status berubah','High','Functional','Ready'),
('TC-SEC-004','Approve section','Section','Workflow','Approve','Section submitted','[{"step_number":1,"instruction":"Approve","expected":"Status Approved"}]','Status berubah','High','Functional','Ready'),
('TC-SEC-005','Locked section tidak bisa edit','Section','Lock','Locked','Section locked','[{"step_number":1,"instruction":"Coba edit","expected":"Ditolak"}]','Edit ditolak','Critical','Security','Ready'),

('TC-FRM-001','BMI dihitung benar','Formula','BMI','Hitung BMI','TB & BB ada','[{"step_number":1,"instruction":"TB 170 BB 65","expected":"BMI 22.49"}]','BMI 22.49','Critical','Formula','Ready'),
('TC-FRM-002','BMI classification benar','Formula','BMI','Klasifikasi BMI','BMI ada','[{"step_number":1,"instruction":"BMI 22.49","expected":"Normal"}]','Normal','Critical','Formula','Ready'),
('TC-FRM-003','KESUM B jika semua B','Formula','KESUM','Klasifikasi','Section semua B','[{"step_number":1,"instruction":"Run formula","expected":"KESUM B"}]','KESUM B','Critical','Formula','Ready'),
('TC-FRM-004','KESUM C jika ada C','Formula','KESUM','Klasifikasi','Ada section C','[{"step_number":1,"instruction":"Run","expected":"KESUM C"}]','KESUM C','Critical','Formula','Ready'),
('TC-FRM-005','KESUM K1 jika ada K1','Formula','KESUM','Klasifikasi','Ada K1','[{"step_number":1,"instruction":"Run","expected":"KESUM K1"}]','KESUM K1','Critical','Formula','Ready'),
('TC-FRM-006','KESUM K2 jika ada K2','Formula','KESUM','Klasifikasi','Ada K2','[{"step_number":1,"instruction":"Run","expected":"KESUM K2"}]','KESUM K2','Critical','Formula','Ready'),
('TC-FRM-007','KESWA TMS jika Jiwa K2','Formula','KESWA','Klasifikasi','Jiwa K2','[{"step_number":1,"instruction":"Run","expected":"KESWA TMS"}]','KESWA TMS','Critical','Formula','Ready'),
('TC-FRM-008','Final TMS jika KESUM K2','Formula','Final','Final result','KESUM K2','[{"step_number":1,"instruction":"Run","expected":"TMS"}]','TMS','Critical','Formula','Ready'),
('TC-FRM-009','Final TMS jika KESWA TMS','Formula','Final','Final result','KESWA TMS','[{"step_number":1,"instruction":"Run","expected":"TMS"}]','TMS','Critical','Formula','Ready'),
('TC-FRM-010','Final TH jika ada TH','Formula','Final','Final result','Section TH','[{"step_number":1,"instruction":"Run","expected":"TH"}]','TH','Critical','Formula','Ready'),
('TC-FRM-011','Final Belum Lengkap','Formula','Final','Belum lengkap','Data kurang','[{"step_number":1,"instruction":"Run","expected":"Belum Lengkap"}]','Belum Lengkap','High','Formula','Ready'),
('TC-FRM-012','Final score scoring rule','Formula','Score','Score','Rule aktif','[{"step_number":1,"instruction":"Run","expected":"Score sesuai rule"}]','Sesuai','High','Formula','Ready'),

('TC-REK-001','Tabel rekap dari database','Rekap','Display','Data live','Data ada','[{"step_number":1,"instruction":"Buka /rekap-aplikasi","expected":"Data tampil"}]','Data tampil','High','Functional','Ready'),
('TC-REK-002','3 baris per peserta','Rekap','Display','Pattern 3 row','Data ada','[{"step_number":1,"instruction":"Cek tabel","expected":"3 baris"}]','3 baris','High','UI/UX','Ready'),
('TC-REK-003','Sticky header bekerja','Rekap','UI','Sticky','Data ada','[{"step_number":1,"instruction":"Scroll","expected":"Header tetap"}]','Sticky','Medium','UI/UX','Ready'),
('TC-REK-004','Filter rekap','Rekap','Filter','Filter','Data ada','[{"step_number":1,"instruction":"Apply filter","expected":"Filtered"}]','Filtered','Medium','Functional','Ready'),
('TC-REK-005','Recalculate','Rekap','Action','Recalc','Data ada','[{"step_number":1,"instruction":"Klik Recalculate","expected":"Update"}]','Updated','High','Functional','Ready'),

('TC-XLS-001','Full workbook 10 sheet','Export','XLSX','10 sheet','Data ada','[{"step_number":1,"instruction":"Export full","expected":"10 sheet"}]','10 sheet','High','Export','Ready'),
('TC-XLS-002','Sheet APLIKASI 3 baris','Export','XLSX','3 baris','Data ada','[{"step_number":1,"instruction":"Buka APLIKASI","expected":"3 baris per peserta"}]','3 baris','High','Export','Ready'),
('TC-XLS-003','Sheet Laporan 1 baris','Export','XLSX','1 baris','Data ada','[{"step_number":1,"instruction":"Buka Laporan","expected":"1 baris"}]','1 baris','High','Export','Ready'),
('TC-XLS-004','Sheet RESUME CASIS','Export','XLSX','Resume','Data ada','[{"step_number":1,"instruction":"Buka RESUME","expected":"Ada"}]','Resume ada','High','Export','Ready'),
('TC-XLS-005','Header dari master seleksi','Export','XLSX','Header','Data ada','[{"step_number":1,"instruction":"Cek header","expected":"Sesuai master"}]','Sesuai','High','Export','Ready'),
('TC-XLS-006','Export history tersimpan','Export','XLSX','History','Export selesai','[{"step_number":1,"instruction":"Cek history","expected":"Ada record"}]','Tersimpan','Medium','Functional','Ready'),

('TC-PDF-001','PDF individual','Export','PDF','PDF per peserta','Data ada','[{"step_number":1,"instruction":"Export individual","expected":"PDF dibuat"}]','PDF dibuat','High','Export','Ready'),
('TC-PDF-002','PDF paket lengkap','Export','PDF','Paket','Data ada','[{"step_number":1,"instruction":"Export paket","expected":"PDF lengkap"}]','PDF lengkap','High','Export','Ready'),
('TC-PDF-003','PDF rekap massal','Export','PDF','Rekap','Data ada','[{"step_number":1,"instruction":"Export rekap","expected":"PDF"}]','PDF','High','Export','Ready'),
('TC-PDF-004','Label RAHASIA KEDOKTERAN','Export','PDF','Label','PDF dibuat','[{"step_number":1,"instruction":"Buka PDF","expected":"Label tampil"}]','Label tampil','Critical','Security','Ready'),
('TC-PDF-005','Header resmi','Export','PDF','Header','PDF dibuat','[{"step_number":1,"instruction":"Buka PDF","expected":"Header resmi"}]','Header benar','High','Export','Ready'),

('TC-IMP-001','Upload workbook XLSX','Import','XLSX','Upload','File ada','[{"step_number":1,"instruction":"Upload","expected":"Berhasil"}]','Berhasil','High','Import','Ready'),
('TC-IMP-002','Sheet terdeteksi','Import','XLSX','Detection','Upload selesai','[{"step_number":1,"instruction":"Cek detection","expected":"Sheet dikenali"}]','Dikenali','High','Import','Ready'),
('TC-IMP-003','Mapping APLIKASI 3 baris','Import','XLSX','Mapping','Upload selesai','[{"step_number":1,"instruction":"Parse","expected":"3 baris ter-mapping"}]','Mapping benar','Critical','Import','Ready'),
('TC-IMP-004','Preview sebelum import','Import','XLSX','Preview','Mapping selesai','[{"step_number":1,"instruction":"Preview","expected":"Data tampil"}]','Preview tampil','High','Import','Ready'),
('TC-IMP-005','Duplicate handling','Import','XLSX','Duplicate','Data ada','[{"step_number":1,"instruction":"Import dengan duplicate","expected":"Handled"}]','Handled','High','Import','Ready'),
('TC-IMP-006','Rollback import','Import','XLSX','Rollback','Import selesai','[{"step_number":1,"instruction":"Rollback","expected":"Data dihapus"}]','Rollback OK','High','Import','Ready'),

('TC-TPL-001','Create draft template','Template','Builder','Draft','Login admin','[{"step_number":1,"instruction":"Create draft","expected":"Draft tersimpan"}]','Tersimpan','High','Functional','Ready'),
('TC-TPL-002','Activate template','Template','Builder','Activate','Draft ada','[{"step_number":1,"instruction":"Activate","expected":"Active"}]','Active','High','Functional','Ready'),

('TC-FC-001','Create draft rule set','Formula Config','Builder','Draft','Login admin','[{"step_number":1,"instruction":"Create draft","expected":"Draft"}]','Draft tersimpan','High','Functional','Ready'),
('TC-FC-002','Rule simulator','Formula Config','Simulator','Sim','Rule set ada','[{"step_number":1,"instruction":"Run simulator","expected":"Hasil sesuai"}]','Sesuai','High','Formula','Ready'),
('TC-FC-003','Apply rule ke selection','Formula Config','Apply','Apply','Selection ada','[{"step_number":1,"instruction":"Apply","expected":"Selection update"}]','Updated','High','Functional','Ready'),

('TC-FIN-001','Finalisasi gagal jika kurang','Finalization','Validation','Validation','Data kurang','[{"step_number":1,"instruction":"Finalize","expected":"Ditolak"}]','Ditolak','Critical','Functional','Ready'),
('TC-FIN-002','Finalisasi berhasil','Finalization','Action','OK','Data lengkap','[{"step_number":1,"instruction":"Finalize","expected":"Locked"}]','Locked','Critical','Functional','Ready'),
('TC-FIN-003','Unlock hanya super_admin','Finalization','Security','Unlock','Finalized','[{"step_number":1,"instruction":"Unlock sebagai admin","expected":"Ditolak"},{"step_number":2,"instruction":"Unlock sebagai super_admin","expected":"OK"}]','Hanya super_admin','Critical','Security','Ready'),
('TC-FIN-004','Unlock wajib alasan','Finalization','Validation','Alasan','Finalized','[{"step_number":1,"instruction":"Unlock tanpa alasan","expected":"Ditolak"}]','Ditolak','High','Functional','Ready'),

('TC-AUD-001','Update data tercatat','Audit','Log','Audit log','Data ada','[{"step_number":1,"instruction":"Update data","expected":"Log tercatat"}]','Tercatat','High','Functional','Ready'),
('TC-AUD-002','Export tercatat','Audit','Log','Audit log','Export selesai','[{"step_number":1,"instruction":"Export","expected":"Log"}]','Tercatat','High','Functional','Ready'),
('TC-AUD-003','Unlock tercatat','Audit','Log','Audit log','Unlock','[{"step_number":1,"instruction":"Unlock","expected":"Log dengan alasan"}]','Tercatat','Critical','Security','Ready');

-- Default formula validation cases
INSERT INTO public.formula_validation_cases (case_code, case_name, description, input_json, expected_json) VALUES
('FV-001','Semua B, jiwa B','TB 170 BB 65 semua B','{"height_cm":170,"weight_kg":65,"sections":{"jiwa_keswa":"B","pemeriksaan_umum":"B","tanda_vital":"B","penyakit_dalam":"B","mata":"B","gigi":"B","tht":"B","bedah":"B","neurologi":"B","laboratorium":"B"}}','{"bmi":22.49,"bmi_classification":"Normal","kesum":"B","keswa":"MS","final_result":"MS"}'),
('FV-002','Ada C, jiwa B','Ada C tidak ada K','{"height_cm":170,"weight_kg":65,"sections":{"jiwa_keswa":"B","mata":"C","pemeriksaan_umum":"B"}}','{"kesum":"C","keswa":"MS","final_result":"MS"}'),
('FV-003','Ada K1, jiwa B','K1 ada','{"height_cm":170,"weight_kg":65,"sections":{"jiwa_keswa":"B","mata":"K1"}}','{"kesum":"K1","keswa":"MS","final_result":"MS"}'),
('FV-004','Ada K2, jiwa B','K2 fisik','{"height_cm":170,"weight_kg":65,"sections":{"jiwa_keswa":"B","mata":"K2"}}','{"kesum":"K2","keswa":"MS","final_result":"TMS"}'),
('FV-005','Fisik B, jiwa K2','Jiwa K2','{"height_cm":170,"weight_kg":65,"sections":{"jiwa_keswa":"K2","mata":"B"}}','{"kesum":"B","keswa":"TMS","final_result":"TMS"}'),
('FV-006','Ada TH','Section TH','{"height_cm":170,"weight_kg":65,"sections":{"jiwa_keswa":"B","mata":"TH"}}','{"final_result":"TH"}'),
('FV-007','Data belum lengkap','Section kosong','{"height_cm":170,"weight_kg":65,"sections":{}}','{"final_result":"Belum Lengkap"}');

-- Default regression test packs
INSERT INTO public.qa_test_packs (pack_name, description, module) VALUES
('Core RIKKES Workflow','Test wajib alur utama RIKKES','Core'),
('Formula Calculation','Test perhitungan KESUM/KESWA/Final','Formula'),
('Export XLSX','Test export XLSX multi-sheet','Export'),
('Export PDF','Test export PDF','Export'),
('Import Legacy XLSX','Test import workbook legacy','Import'),
('Permission Security','Test hak akses role','Security'),
('Finalization Locking','Test finalisasi dan unlock','Finalization');

-- Wire pack items
INSERT INTO public.qa_test_pack_items (test_pack_id, test_case_id, sort_order)
SELECT p.id, c.id, ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY c.test_case_code)
FROM public.qa_test_packs p, public.qa_test_cases c
WHERE
  (p.pack_name = 'Core RIKKES Workflow' AND c.module IN ('Auth','Master Seleksi','Master Peserta','Section','Rekap')) OR
  (p.pack_name = 'Formula Calculation' AND c.module = 'Formula') OR
  (p.pack_name = 'Export XLSX' AND c.module = 'Export' AND c.feature = 'XLSX') OR
  (p.pack_name = 'Export PDF' AND c.module = 'Export' AND c.feature = 'PDF') OR
  (p.pack_name = 'Import Legacy XLSX' AND c.module = 'Import') OR
  (p.pack_name = 'Permission Security' AND c.test_type IN ('Security','Permission')) OR
  (p.pack_name = 'Finalization Locking' AND c.module = 'Finalization');
