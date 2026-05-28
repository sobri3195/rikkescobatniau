// Centralized permission keys. Mirrors role_permissions.permission_key in DB.
// Keep flat string constants; backend is the source of truth.

export const PERMISSIONS = {
  // General
  DASHBOARD_VIEW: "dashboard.view",
  ANALYTICS_VIEW: "analytics.view",
  CANDIDATE_VIEW: "candidate.view",
  CANDIDATE_CREATE: "candidate.create",
  CANDIDATE_UPDATE: "candidate.update",
  CANDIDATE_DELETE: "candidate.delete",
  CANDIDATE_RESTORE: "candidate.restore",

  // No Test
  NO_TEST_VIEW: "no_test.view",
  NO_TEST_CREATE: "no_test.create_candidate",
  NO_TEST_UPDATE: "no_test.update",
  NO_TEST_BULK_UPDATE: "no_test.bulk_update",
  NO_TEST_MERGE: "no_test.merge",
  NO_TEST_DELETE: "no_test.delete",
  NO_TEST_RESTORE: "no_test.restore",

  // Bulk Import Peserta (SESKOAU)
  CANDIDATE_BULK_IMPORT_XLSX: "candidate.bulk_import_xlsx",
  CANDIDATE_DOWNLOAD_IMPORT_TEMPLATE: "candidate.download_import_template",
  CANDIDATE_DOWNLOAD_IMPORT_ERROR_REPORT: "candidate.download_import_error_report",

  // Hari-H
  HARI_H_VIEW: "hari_h.view",
  HARI_H_QUEUE_VIEW: "hari_h.queue.view",
  HARI_H_SCREENING_VIEW: "hari_h.screening.view",
  HARI_H_SCREENING_UPDATE: "hari_h.screening.update",
  HARI_H_SETTINGS_VIEW: "hari_h.settings.view",
  HARI_H_SETTINGS_UPDATE: "hari_h.settings.update",
  HARI_H_BYPASS_VIEW: "hari_h.bypass.view",
  HARI_H_BYPASS_REVIEW: "hari_h.bypass.review",
  HARI_H_BYPASS_CREATE: "hari_h.bypass.create",

  // Juknis
  JUKNIS_VIEW: "juknis.view",
  JUKNIS_CREATE: "juknis.create",
  JUKNIS_UPDATE: "juknis.update",
  JUKNIS_DELETE: "juknis.delete",

  // Section umum
  SECTION_VIEW_ALL: "section.view_all",
  SECTION_UPDATE_ALL: "section.update_all",
  SECTION_SUBMIT_ALL: "section.submit_all",
  SECTION_APPROVE_ALL: "section.approve_all",

  // Upload
  UPLOAD_EKG: "upload.ekg",
  UPLOAD_RONTGEN: "upload.rontgen",
  UPLOAD_USG: "upload.usg",
  UPLOAD_LAB: "upload.lab",

  // Review & finalization
  REVIEW_VIEW: "review.view",
  REVIEW_APPROVE: "review.approve_section",
  REVIEW_REQUEST_REVISION: "review.request_revision",
  FINALIZATION_CHECK: "finalization.check",
  FINALIZATION_CREATE: "finalization.create",
  FINALIZATION_UNLOCK: "finalization.unlock",

  // Export / Import
  EXPORT_XLSX: "export.xlsx",
  EXPORT_PDF: "export.pdf",
  EXPORT_FINAL: "export.final",
  EXPORT_DRAFT: "export.draft",
  EXPORT_HISTORY_VIEW: "export.history.view",
  IMPORT_VIEW: "import.view",
  IMPORT_CREATE: "import.create",
  IMPORT_ROLLBACK: "import.rollback",

  // Config
  FORMULA_VIEW: "formula.view",
  FORMULA_UPDATE: "formula.update",
  RULE_SIMULATOR_VIEW: "rule_simulator.view",
  MASTER_SUBTIM_VIEW: "master_subtim.view",
  MASTER_SUBTIM_UPDATE: "master_subtim.update",
  USER_MANAGEMENT_VIEW: "user_management.view",
  USER_MANAGEMENT_UPDATE: "user_management.update",

  // Audit
  AUDIT_VIEW: "audit.view",
  AUDIT_EXPORT: "audit.export",

  READONLY_ALL: "readonly.all",

  // Identitas & Anamnesis — zona Peserta/Casis
  ANAMNESIS_PATIENT_VIEW: "anamnesis.patient.view",
  ANAMNESIS_PATIENT_CREATE: "anamnesis.patient.create",
  ANAMNESIS_PATIENT_UPDATE: "anamnesis.patient.update",
  ANAMNESIS_PATIENT_SUBMIT: "anamnesis.patient.submit",
  ANAMNESIS_PATIENT_SIGN: "anamnesis.patient.sign",

  // Identitas & Anamnesis — zona Dokter Umum
  ANAMNESIS_DOCTOR_VIEW: "anamnesis.doctor.view",
  ANAMNESIS_DOCTOR_REVIEW: "anamnesis.doctor.review",
  ANAMNESIS_DOCTOR_SET_CLEAR: "anamnesis.doctor.set_clear",
  ANAMNESIS_DOCTOR_ADD_NOTE: "anamnesis.doctor.add_note",
  ANAMNESIS_DOCTOR_REQUEST_CLARIFICATION: "anamnesis.doctor.request_clarification",
  ANAMNESIS_DOCTOR_SIGN: "anamnesis.doctor.sign",
  ANAMNESIS_DOCTOR_SUBMIT_REVIEW: "anamnesis.doctor.submit_review",

  // Identitas & Anamnesis — zona Registrasi
  ANAMNESIS_REGISTRATION_VIEW: "anamnesis.registration.view",
  ANAMNESIS_REGISTRATION_UPDATE_IDENTITY: "anamnesis.registration.update_identity",

  // Identitas & Anamnesis — zona Admin / Kepala
  ANAMNESIS_ADMIN_VIEW: "anamnesis.admin.view",
  ANAMNESIS_ADMIN_RETURN_TO_DRAFT: "anamnesis.admin.return_to_draft",
  ANAMNESIS_ADMIN_FORCE_UNLOCK: "anamnesis.admin.force_unlock",

  // Identitas & Anamnesis — viewer
  ANAMNESIS_READONLY_VIEW: "anamnesis.readonly.view",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS] | string;

// Master daftar section yang bisa di-assign ke user
export const ASSIGNABLE_SECTIONS: { key: string; name: string }[] = [
  { key: "anamnesa", name: "Anamnesa" },
  { key: "pemeriksaan_umum", name: "Pemeriksaan Umum" },
  { key: "penyakit_dalam", name: "Penyakit Dalam" },
  { key: "tht", name: "THT" },
  { key: "mata_umum", name: "Mata Umum" },
  { key: "mata_visus", name: "Mata Lihat / Visus" },
  { key: "bedah", name: "Bedah" },
  { key: "neurologi", name: "Neurologi" },
  { key: "jantung_ekg", name: "Jantung / EKG" },
  { key: "gilut", name: "Gigi / Odontogram" },
  { key: "radiology", name: "Radiologi / Rontgen" },
  { key: "usg", name: "USG" },
  { key: "laboratorium", name: "Laboratorium" },
  { key: "jiwa_keswa", name: "Jiwa / Keswa" },
  { key: "paru", name: "Paru" },
  { key: "kulit", name: "Kulit" },
];

export const SECTION_ACTIONS = [
  "view",
  "create",
  "update",
  "submit",
  "approve",
  "request_revision",
  "upload",
  "export",
] as const;
