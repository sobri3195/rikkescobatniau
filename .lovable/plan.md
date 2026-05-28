# Perbaikan Modul Keswa (RIKKES TNI AU)

Ruang lingkup besar: penggantian label, form baru bergaya Status Psikiatri, mapping STAKES otomatis, migrasi DB aman, validasi backend, audit log, dan propagasi ke rekap/laporan/PDF/XLSX.

## 1. Migrasi DB (aman, non-destruktif)

Tabel `public.exam_psychology` dipertahankan (kolom lama tetap ada untuk data lama). Tambahkan kolom baru:

- `keswa_anamnesis_preschool, keswa_anamnesis_school, keswa_anamnesis_other` (text)
- `keswa_appearance_neatness, keswa_speech, keswa_attitude, keswa_behavior, keswa_affect` (text)
- `keswa_emotion_stability, keswa_emotion_control, keswa_memory, keswa_orientation, keswa_opinion_ability` (text)
- `keswa_perception_disorder, keswa_thought_process_quality, keswa_thought_process_content` (text)
- `keswa_other_symptoms text[]`
- `keswa_diagnosis text, keswa_conclusion text`
- `keswa_stakes text` CHECK in (`J1`,`J2`,`J4`)
- `keswa_classification text` CHECK in (`B`,`C`,`K2`)
- `keswa_result_status text` CHECK in (`MS`,`TMS`)
- `keswa_legacy_notes text` (backfill catatan lama bila perlu)

Trigger `trg_validate_keswa_stakes` (BEFORE INSERT/UPDATE) memastikan kombinasi STAKES → classification → result_status valid saat `status IN ('Submitted','Approved','Locked')`. Trigger `trg_audit_keswa_change` mencatat ke `audit_logs` untuk perubahan setelah status Submitted.

Tidak ada kolom lama yang di-drop/rename.

## 2. Form `PsychologyForm.tsx` (rewrite)

- Header: "Keswa (Status Psikiatri)"
- 16 grup field sesuai spesifikasi (anamnesis 3 sub, penampilan, sikap, tingkah laku, afek, emosi, intelek, opini, persepsi, proses pikir, gejala lain-lain multi-select, diagnosis, STAKES, klasifikasi/status read-only, kesimpulan)
- Dropdown STAKES (`J1 - B`, `J2 - C`, `J4 - K2 (TMS)`) memicu auto-set klasifikasi, status, dan template kesimpulan (kesimpulan tetap dapat diedit)
- Warning bila J4 dipilih
- Tombol: Isi Normal, Simpan Draft, Submit
- Validasi client: STAKES wajib saat submit

## 3. Label rename (UI only, key DB tetap)

Ganti semua kemunculan "Psikologi" / "Tes Psikologi" / "Psychology" menjadi "Keswa" di:
- `src/lib/sections.ts`, `src/lib/rikkes-form-groups.ts`, `src/lib/rikkes-role-access.ts`
- `src/lib/candidate-progress.ts`, `src/lib/rekap-sync.ts`
- `src/lib/export/rikkes-xlsx-export.ts`, `src/lib/export/rikkes-pdf-export.ts`
- `src/lib/candidate-resume-pdf.ts`
- Routes: `rikkes.$id.tsx`, `rekap-aplikasi.tsx`, `laporan-tahap.tsx`, `resume-casis.tsx`, `medical-subteams.tsx`, `formula-config.tsx`, `candidates.$id.tsx`, `import-data.tsx`, `rule-simulator.tsx`
- Komponen: `FinalizationDialog.tsx`, `PDFExportMenu.tsx`
- Key permission/section internal (`jiwa_keswa`, `psikologi_subtim`) TETAP — hanya `label` yang berubah

## 4. Rekap/Laporan/Resume/PDF/XLSX

- Tambah kolom: STAKES Keswa, Klasifikasi Keswa, Status Keswa, Diagnosis Keswa, Kesimpulan Keswa
- Format label "KESWA" / "Status Psikiatri / KESWA" pada PDF
- Hapus header "Psikologi" di XLSX export

## 5. Audit log

Trigger DB mencatat perubahan post-Submitted; frontend tetap memanggil `logAudit` untuk submit/save.

## Catatan teknis

- Auto-fill kesimpulan J4: `"J4 - K2 TMS. Gangguan psikotik, gangguan cemas, gangguan depresi. (TMS)"`
- Auto-fill J1: `"J1 - B. Memenuhi syarat Keswa."`
- Auto-fill J2: `"J2 - C. Memenuhi syarat dengan catatan Keswa."`
- Mapping data lama: bila `classification` lama berisi `P-1..P-5`, simpan ke `keswa_legacy_notes`; biarkan kolom lama tetap untuk fallback baca
- Section key internal `jiwa_keswa` & group `psikologi_subtim` TIDAK diubah agar RLS/permission lama tetap berfungsi

Setelah disetujui, saya jalankan migrasi DB terlebih dulu, lalu rewrite form, lalu label sweep, lalu propagasi ke rekap/laporan/PDF/XLSX.
