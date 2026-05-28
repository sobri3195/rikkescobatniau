
-- ============================================================
-- Phase 10A — Documentation, SOP, Acknowledgements, Release Notes,
--             Operation Checklists, Handover Package (struktur)
-- ============================================================

-- 1. HELP ARTICLES
CREATE TABLE IF NOT EXISTS public.help_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  category text NOT NULL,
  role_visibility_json jsonb NOT NULL DEFAULT '["super_admin","admin","kepala_sub_tim","dokter","registrasi","peserta","viewer"]'::jsonb,
  summary text,
  content_markdown text NOT NULL DEFAULT '',
  tags_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'Draft',
  version integer NOT NULL DEFAULT 1,
  helpful_count integer NOT NULL DEFAULT 0,
  not_helpful_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  updated_by uuid,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY ha_select_auth ON public.help_articles FOR SELECT TO authenticated USING (true);
CREATE POLICY ha_admin_write ON public.help_articles FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin']::app_role[]));
CREATE TRIGGER trg_ha_updated_at BEFORE UPDATE ON public.help_articles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. HELP ARTICLE FEEDBACK
CREATE TABLE IF NOT EXISTS public.help_article_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.help_articles(id) ON DELETE CASCADE,
  user_id uuid,
  is_helpful boolean NOT NULL,
  feedback_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.help_article_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY haf_select_auth ON public.help_article_feedback FOR SELECT TO authenticated USING (true);
CREATE POLICY haf_insert_self ON public.help_article_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 3. SOP DOCUMENTS
CREATE TABLE IF NOT EXISTS public.sop_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_code text NOT NULL UNIQUE,
  title text NOT NULL,
  category text NOT NULL,
  role_visibility_json jsonb NOT NULL DEFAULT '["super_admin","admin","kepala_sub_tim","dokter","registrasi","viewer"]'::jsonb,
  objective text,
  scope text,
  prerequisites text,
  procedure_markdown text NOT NULL DEFAULT '',
  expected_output text,
  troubleshooting text,
  security_notes text,
  checklist_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'Draft',
  version integer NOT NULL DEFAULT 1,
  effective_date date,
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sop_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY sop_select_auth ON public.sop_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY sop_admin_write ON public.sop_documents FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','kepala_sub_tim']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','kepala_sub_tim']::app_role[]));
CREATE TRIGGER trg_sop_updated_at BEFORE UPDATE ON public.sop_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. USER ACKNOWLEDGEMENTS
CREATE TABLE IF NOT EXISTS public.user_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_type text NOT NULL,           -- sop | help_article | release_note | training | quick_start
  document_id uuid,
  document_code text,                    -- fallback if no uuid (e.g. release version)
  version integer,
  acknowledgement_text text,
  quiz_score numeric,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ua_user ON public.user_acknowledgements(user_id);
CREATE INDEX IF NOT EXISTS idx_ua_doc ON public.user_acknowledgements(document_type, document_id);
ALTER TABLE public.user_acknowledgements ENABLE ROW LEVEL SECURITY;
CREATE POLICY ua_select_auth ON public.user_acknowledgements FOR SELECT TO authenticated USING (true);
CREATE POLICY ua_insert_self ON public.user_acknowledgements FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY ua_admin_manage ON public.user_acknowledgements FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin']::app_role[]));

-- 5. RELEASE NOTES
CREATE TABLE IF NOT EXISTS public.release_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  title text NOT NULL,
  release_date date NOT NULL DEFAULT CURRENT_DATE,
  summary text,
  changes_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  known_issues_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'Draft',
  published_by uuid,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.release_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY rn_select_auth ON public.release_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY rn_admin_write ON public.release_notes FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin']::app_role[]));
CREATE TRIGGER trg_rn_updated_at BEFORE UPDATE ON public.release_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. HANDOVER PACKAGES (struktur, dipakai di 10C)
CREATE TABLE IF NOT EXISTS public.handover_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_name text NOT NULL,
  selection_id uuid,
  status text NOT NULL DEFAULT 'Draft',
  file_url text,
  checklist_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  generated_by uuid,
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.handover_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY hp_select_auth ON public.handover_packages FOR SELECT TO authenticated USING (true);
CREATE POLICY hp_admin_write ON public.handover_packages FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin']::app_role[]));
CREATE TRIGGER trg_hp_updated_at BEFORE UPDATE ON public.handover_packages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 7. OPERATION CHECKLISTS
CREATE TABLE IF NOT EXISTS public.operation_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id uuid,
  checklist_date date NOT NULL DEFAULT CURRENT_DATE,
  checklist_type text NOT NULL DEFAULT 'daily',
  status text NOT NULL DEFAULT 'In Progress',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.operation_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY oc_select_auth ON public.operation_checklists FOR SELECT TO authenticated USING (true);
CREATE POLICY oc_staff_write ON public.operation_checklists FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','kepala_sub_tim']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','kepala_sub_tim']::app_role[]));
CREATE TRIGGER trg_oc_updated_at BEFORE UPDATE ON public.operation_checklists
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.operation_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.operation_checklists(id) ON DELETE CASCADE,
  category text NOT NULL,
  item_name text NOT NULL,
  status text NOT NULL DEFAULT 'Pending',
  notes text,
  checked_by uuid,
  checked_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.operation_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY oci_select_auth ON public.operation_checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY oci_staff_write ON public.operation_checklist_items FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','kepala_sub_tim']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','admin','kepala_sub_tim']::app_role[]));
CREATE TRIGGER trg_oci_updated_at BEFORE UPDATE ON public.operation_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 8. USER TRAINING PROGRESS (struktur penuh, dipakai 10B)
CREATE TABLE IF NOT EXISTS public.user_training_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text,
  module_key text NOT NULL,
  lesson_key text,
  status text NOT NULL DEFAULT 'in_progress',
  progress_percentage numeric NOT NULL DEFAULT 0,
  quiz_score numeric,
  completed_at timestamptz,
  acknowledgement_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_key, lesson_key)
);
ALTER TABLE public.user_training_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY utp_select_self_or_admin ON public.user_training_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['super_admin','admin']::app_role[]));
CREATE POLICY utp_write_self ON public.user_training_progress FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_utp_updated_at BEFORE UPDATE ON public.user_training_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- SEED DATA: help articles, SOP, release note, daily checklist template
-- ============================================================

-- Help articles
INSERT INTO public.help_articles (title, slug, category, summary, content_markdown, tags_json, status, published_at) VALUES
('Cara Login dan Memahami Role','cara-login','Mulai Menggunakan','Langkah login dan penjelasan role aplikasi.','# Cara Login\n\n1. Buka halaman login.\n2. Masukkan email dan password.\n3. Sistem akan memuat role Anda secara otomatis.\n\n## Role\n- **Super Admin**: akses penuh.\n- **Admin/Panitia**: kelola seleksi, peserta, export.\n- **Kepala Sub Tim**: review & approve.\n- **Dokter**: input section.\n- **Registrasi**: input identitas.\n- **Peserta**: anamnesa & surat pernyataan.\n- **Viewer/Auditor**: read-only.','["login","role","mulai"]','Published', now()),
('Membuat Master Seleksi','membuat-seleksi','Master Seleksi','Cara membuat dan mengaktifkan seleksi.','# Membuat Master Seleksi\n\n1. Buka menu **Master Seleksi**.\n2. Klik **Tambah Seleksi**.\n3. Isi nama, tahun, header institusi, lokasi, dan tanggal.\n4. Simpan dan aktifkan.','["seleksi","master"]','Published', now()),
('Menambah Peserta','menambah-peserta','Master Peserta','Tambah peserta manual atau via import.','# Menambah Peserta\n\n## Manual\n1. Buka **Peserta** → **Tambah Peserta**.\n2. Isi identitas wajib (nama, nomor test, NRP/NIP).\n3. Sistem otomatis membuat exam & section.\n\n## Import\nGunakan menu **Import Data** dengan workbook XLSX.','["peserta","registrasi"]','Published', now()),
('Mengisi Section Pemeriksaan','mengisi-section','Input Pemeriksaan','Cara dokter mengisi dan submit section.','# Mengisi Section\n\n1. Buka detail peserta.\n2. Pilih section sesuai kewenangan.\n3. Isi temuan & klasifikasi (B/C/K1/K2).\n4. **Save Draft** bila belum selesai.\n5. **Submit Section** bila lengkap.','["dokter","section"]','Published', now()),
('Anamnesa dan Surat Pernyataan','anamnesa-surat','Anamnesa','Panduan peserta mengisi anamnesa & TTD.','# Anamnesa & Surat Pernyataan\n\n1. Login sebagai Peserta.\n2. Buka tab **Anamnesa**, jawab seluruh pertanyaan.\n3. Buka **Surat Pernyataan**, baca, tanda tangan digital.\n4. Submit.','["peserta","anamnesa"]','Published', now()),
('Request Revisi Section','revisi-section','Revisi','Cara Admin/Kepala Sub Tim minta revisi.','# Request Revisi\n\n1. Buka section yang sudah submitted.\n2. Klik **Request Revision**.\n3. Tulis alasan jelas.\n4. Petugas akan memperbaiki dan submit ulang.','["revisi","approval"]','Published', now()),
('Finalisasi Pemeriksaan','finalisasi','Finalisasi','Langkah aman finalisasi exam.','# Finalisasi\n\n1. Pastikan seluruh section **Submitted/Approved**.\n2. Cek resume KESUM/KESWA.\n3. Klik **Finalisasi**.\n4. Exam terkunci.','["finalisasi","lock"]','Published', now()),
('Unlock Finalized Exam','unlock-exam','Finalisasi','Membuka kembali exam yang sudah final.','# Unlock\n\nHanya **Super Admin**. Wajib mengisi alasan dan memilih section yang dibuka. Semua dicatat di audit log.','["unlock","super-admin"]','Published', now()),
('Export XLSX Multi-Sheet','export-xlsx','Export XLSX','Ekspor workbook RIKKES.','# Export XLSX\n\n1. Pilih seleksi & filter.\n2. Klik **Generate Workbook**.\n3. Validasi sheet (Identitas, KESUM, KESWA, Resume, dst).\n4. Unduh & simpan.','["export","xlsx"]','Published', now()),
('Export PDF Rekap','export-pdf','Export PDF','Ekspor laporan PDF resmi.','# Export PDF\n\n1. Pilih jenis PDF (per peserta / rekap).\n2. Cek preview.\n3. Generate. Label **RAHASIA KEDOKTERAN** otomatis tampil.','["export","pdf"]','Published', now()),
('Import Workbook RIKKES Lama','import-xlsx','Import XLSX','Migrasi workbook XLSX legacy.','# Import XLSX\n\n1. Upload workbook.\n2. Pilih seleksi tujuan.\n3. Map sheet & kolom.\n4. Preview, resolve duplicate.\n5. Eksekusi import.\n6. Jalankan Data Quality Check.','["import","migrasi"]','Published', now()),
('Membaca Audit Log','audit-log','Audit','Filter & baca audit log.','# Audit Log\n\nGunakan filter modul, user, action, tanggal. Semua perubahan penting tercatat (create, update, submit, finalize, unlock, export).','["audit","keamanan"]','Published', now()),
('FAQ: Tidak Bisa Edit Section','faq-edit-section','FAQ','Penyebab umum section tidak bisa diedit.','# Tidak Bisa Edit Section?\n\n- Section sudah **Submitted/Approved/Locked**.\n- Exam sudah **Finalized**.\n- Role tidak berwenang.\n\nMinta Admin untuk **Request Revision** jika perlu mengubah.','["faq","troubleshoot"]','Published', now()),
('FAQ: KESUM Berbeda dari Perkiraan','faq-kesum','FAQ','Cek classification, BMI, dan rule set aktif.','# KESUM Berbeda?\n\n1. Periksa classification per section (B/C/K1/K2).\n2. Periksa BMI (TB/BB benar?).\n3. Periksa **Formula Rule Set** aktif di seleksi.\n4. Recalculate jika rule baru diaktifkan.','["faq","kesum"]','Published', now()),
('FAQ: Apakah Aplikasi Membuat Diagnosis?','faq-diagnosis','FAQ','Aplikasi hanya rekap administratif.','# Tidak.\n\nAplikasi **tidak** memberi diagnosis medis. Aplikasi merekap input petugas dan menjalankan kalkulasi administratif (BMI, agregasi KESUM/KESWA, MS/TMS/TH) sesuai rule set yang diaktifkan Admin.','["faq","disclaimer"]','Published', now())
ON CONFLICT (slug) DO NOTHING;

-- SOP Documents
INSERT INTO public.sop_documents (sop_code, title, category, objective, scope, prerequisites, procedure_markdown, expected_output, troubleshooting, security_notes, checklist_json, status, version, effective_date) VALUES
('SOP-01','SOP Persiapan Seleksi','Persiapan',
 'Memastikan seleksi siap dijalankan secara digital.','Berlaku untuk Admin/Panitia sebelum membuka pemeriksaan.','Master seleksi belum dibuat.',
 '## Langkah\n1. Buat master seleksi dengan header institusi resmi.\n2. Validasi tanggal, lokasi, dan label peserta.\n3. Setup user & role yang dibutuhkan.\n4. Import peserta atau tambah manual.\n5. Cek duplikasi nomor test.\n6. Jalankan Data Quality Check awal.',
 'Seleksi aktif dengan peserta tervalidasi.','Jika nomor test duplikat, gunakan filter dashboard untuk identifikasi.','Pastikan hanya role berwenang yang membuat seleksi.',
 '[{"label":"Master seleksi dibuat"},{"label":"Header laporan valid"},{"label":"User & role diatur"},{"label":"Peserta diimpor/ditambah"},{"label":"Duplikasi nomor test dicek"},{"label":"Data Quality Check dijalankan"}]', 'Published', 1, CURRENT_DATE),
('SOP-02','SOP Registrasi Peserta','Registrasi',
 'Memastikan identitas peserta benar & lengkap.','Petugas Registrasi.','Seleksi aktif tersedia.',
 '## Langkah\n1. Buka menu Peserta.\n2. Tambah manual atau via import.\n3. Validasi NRP/NIP, nama, nomor test.\n4. Konfirmasi exam & section terbentuk otomatis.\n5. Cek dashboard.',
 'Peserta tersinkron, exam & section ready.','Jika exam tidak terbentuk, periksa trigger create_exam_for_candidate.','Jangan menyimpan data peserta di luar sistem.',
 '[{"label":"Identitas lengkap"},{"label":"Nomor test unik"},{"label":"Exam & section terbentuk"},{"label":"Dashboard terupdate"}]','Published',1,CURRENT_DATE),
('SOP-03','SOP Pengisian Pemeriksaan','Pemeriksaan',
 'Standar petugas mengisi section.','Dokter / petugas subtim.','Peserta sudah teregistrasi.',
 '## Langkah\n1. Buka detail peserta.\n2. Pilih section sesuai kewenangan.\n3. Isi temuan & klasifikasi.\n4. Save Draft bila perlu jeda.\n5. Submit Section bila lengkap.',
 'Section ter-submit & progress exam naik.','Section terkunci? Cek status exam (Finalized) atau status section (Approved/Locked).','Patuhi RAHASIA KEDOKTERAN.',
 '[{"label":"Identitas peserta benar"},{"label":"Findings diisi"},{"label":"Classification dipilih"},{"label":"Submit Section"}]','Published',1,CURRENT_DATE),
('SOP-04','SOP Revisi Section','Revisi',
 'Mekanisme revisi data section yang sudah disubmit.','Admin & Kepala Sub Tim.','Section status Submitted/Approved.',
 '## Langkah\n1. Buka section.\n2. Klik Request Revision.\n3. Tulis alasan.\n4. Petugas memperbaiki.\n5. Submit ulang.\n6. Reviewer approve.',
 'Section kembali Approved dengan data benar.','Petugas tidak menerima revisi? Cek notifikasi & assignment.','Audit log mencatat seluruh siklus revisi.',
 '[{"label":"Alasan revisi jelas"},{"label":"Perbaikan dilakukan"},{"label":"Submit ulang"},{"label":"Approve ulang"}]','Published',1,CURRENT_DATE),
('SOP-05','SOP Finalisasi','Finalisasi',
 'Mengunci exam setelah seluruh data lengkap.','Admin & Kepala Sub Tim.','Seluruh section Submitted/Approved.',
 '## Langkah\n1. Jalankan readiness checklist.\n2. Cek KESUM/KESWA/Hasil Akhir.\n3. Klik Finalisasi.\n4. Section locked.',
 'Exam Finalized & locked.','Tidak bisa finalisasi? Cek section yang masih Draft/Revision.','Setelah final, hanya Super Admin yang boleh unlock.',
 '[{"label":"Section lengkap"},{"label":"KESUM/KESWA valid"},{"label":"Anamnesa & surat pernyataan ada"},{"label":"Finalisasi dilakukan"}]','Published',1,CURRENT_DATE),
('SOP-06','SOP Export XLSX & PDF','Export',
 'Standar ekspor laporan RIKKES.','Admin & Kepala Sub Tim.','Data finalized/siap rekap.',
 '## Langkah\n1. Pilih seleksi & filter.\n2. Generate workbook XLSX atau PDF.\n3. Validasi sheet/halaman.\n4. Simpan & catat di Export History.',
 'File ekspor + entry document_exports.','File kosong? Cek filter & scope.','Label RAHASIA KEDOKTERAN wajib tampil di PDF.',
 '[{"label":"Filter dipilih"},{"label":"Export ter-generate"},{"label":"Header & label tampil"},{"label":"Export history tercatat"}]','Published',1,CURRENT_DATE),
('SOP-07','SOP Import XLSX Legacy','Import',
 'Migrasi workbook RIKKES lama.','Admin/Super Admin.','File workbook tersedia.',
 '## Langkah\n1. Upload workbook.\n2. Pilih seleksi.\n3. Map sheet & kolom.\n4. Preview & resolve duplicate.\n5. Eksekusi import.\n6. Jalankan Data Quality Check.',
 'Data candidate/exam/section terimpor.','Import gagal? Cek mapping, format tanggal, duplicate nomor test.','Backup workbook asli sebelum rollback.',
 '[{"label":"File diupload"},{"label":"Mapping benar"},{"label":"Preview clean"},{"label":"Import sukses"},{"label":"DQC dijalankan"}]','Published',1,CURRENT_DATE),
('SOP-08','SOP Audit & Keamanan','Audit',
 'Pengawasan & keamanan data RIKKES.','Super Admin & Auditor.','Aplikasi operasional.',
 '## Langkah\n1. Buka Audit Log secara berkala.\n2. Review export/unlock.\n3. Cek anomali role.\n4. Laporkan ke pimpinan.',
 'Laporan kepatuhan & log review.','Aktivitas mencurigakan? Nonaktifkan user dan investigasi.','Jangan share kredensial.',
 '[{"label":"Audit log direview"},{"label":"Export history dicek"},{"label":"Unlock dicek"},{"label":"Anomali dilaporkan"}]','Published',1,CURRENT_DATE)
ON CONFLICT (sop_code) DO NOTHING;

-- Release note v1.0.0
INSERT INTO public.release_notes (version, title, summary, changes_json, known_issues_json, status, published_at)
VALUES (
 '1.0.0','Initial Release — Sistem Digital RIKKES TNI AU',
 'Rilis awal sistem digital RIKKES dengan dukungan workflow penuh.',
 '{"new_features":["Master Seleksi","Master Peserta","Form Pemeriksaan KESUM/KESWA","Engine MS/TMS/TH","Rekap APLIKASI","Export XLSX multi-sheet","Export PDF","Finalisasi & Unlock","Import XLSX legacy","Template Builder","Formula Config","QA/UAT Workflow","Go-Live Readiness"],"improvements":[],"bug_fixes":[],"breaking_changes":[]}'::jsonb,
 '[]'::jsonb, 'Published', now()
) ON CONFLICT (version) DO NOTHING;
