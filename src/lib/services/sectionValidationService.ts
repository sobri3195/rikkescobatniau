import { getDb, normalizeSectionKey } from "@/lib/localDb";
import { buildIncompleteDataLocal } from "@/lib/services/syncService";
import { isCompletedStatus, isRevisionStatus } from "@/lib/services/workflowStatusService";

export type ValidationIssue = { field: string; message: string; section_key?: string };
export type ValidationResult = { valid: boolean; issues: ValidationIssue[] };

type RequiredField = { keys: string[]; label: string; when?: (data: any) => boolean };

function blank(value: any) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function readAny(data: any, keys: string[]) {
  for (const key of keys) {
    const path = key.split(".");
    let current = data;
    for (const part of path) current = current?.[part];
    if (!blank(current)) return current;
  }
  return undefined;
}

function canonicalSection(sectionKey?: string | null) {
  const normalized = normalizeSectionKey(sectionKey);
  const aliases: Record<string, string> = {
    lembar_evaluasi_umum: "pemeriksaan_umum",
    evaluasi_klinis: "pemeriksaan_umum",
    penunjang: "penunjang",
    ukuran_lain: "pemeriksaan_umum",
    mata_tht: "mata_visus",
    tht_subtim: "tht",
    mata_visus_subtim: "mata_visus",
    bedah_subtim: "bedah",
    gigi_odontogram: "gigi",
    psikologi_subtim: "jiwa_keswa",
  };
  return aliases[normalized] ?? normalized;
}

const REQUIRED_BY_SECTION: Record<string, RequiredField[]> = {
  identitas_anamnesis: [
    { keys: ["full_name", "identity_data_json.full_name"], label: "Nama lengkap" },
    { keys: ["gender", "identity_data_json.gender"], label: "Jenis kelamin" },
    { keys: ["rank", "identity_data_json.rank"], label: "Pangkat" },
    { keys: ["nrp_nip", "identity_data_json.nrp_nip"], label: "NRP/NIP" },
    { keys: ["unit_position", "identity_data_json.unit_position"], label: "Jabatan/Satuan" },
    { keys: ["birth_date", "identity_data_json.birth_date"], label: "Tanggal lahir" },
  ],
  pemeriksaan_umum: [
    { keys: ["height_cm", "tinggi_badan", "tb", "body_height", "stature"], label: "Tinggi badan" },
    { keys: ["weight_kg", "berat_badan", "bb", "body_weight"], label: "Berat badan" },
    {
      keys: ["blood_pressure", "tekanan_darah", "td", "systolic", "sistolik"],
      label: "Tekanan darah",
    },
    { keys: ["pulse", "nadi", "heart_rate"], label: "Nadi" },
    {
      keys: ["classification", "klasifikasi_umum", "qualification_u", "kesimpulan_umum"],
      label: "Klasifikasi umum",
    },
  ],
  ekg: [
    { keys: ["ekg_status", "status_ekg", "status", "result_status"], label: "Status EKG" },
    {
      keys: ["ekg_classification", "classification", "klasifikasi_ekg", "qualification_u"],
      label: "Klasifikasi EKG",
    },
    {
      keys: ["abnormal_note", "catatan_abnormal", "notes", "finding", "kesan"],
      label: "Catatan EKG abnormal",
      when: (data) =>
        /abnormal|tidak normal|kelainan/i.test(
          String(
            readAny(data, [
              "ekg_status",
              "status_ekg",
              "status",
              "result_status",
              "ekg_classification",
              "classification",
            ]) ?? "",
          ),
        ),
    },
  ],
  rontgen: [
    {
      keys: ["rontgen_status", "radiology_status", "status_rontgen", "status", "result_status"],
      label: "Status Rontgen",
    },
    {
      keys: [
        "radiology_classification",
        "classification",
        "klasifikasi_radiologi",
        "qualification_u",
      ],
      label: "Klasifikasi Radiologi",
    },
    {
      keys: ["abnormal_note", "catatan_abnormal", "notes", "finding", "kesan"],
      label: "Catatan Rontgen abnormal",
      when: (data) =>
        /abnormal|tidak normal|kelainan/i.test(
          String(
            readAny(data, [
              "rontgen_status",
              "radiology_status",
              "status",
              "radiology_classification",
              "classification",
            ]) ?? "",
          ),
        ),
    },
  ],
  resume_rekomendasi: [
    { keys: ["conclusion", "kesimpulan", "resume_conclusion"], label: "Kesimpulan" },
    { keys: ["final_result", "hasil_akhir", "graduation_decision"], label: "Hasil akhir" },
    { keys: ["recommendation", "rekomendasi", "saran"], label: "Rekomendasi" },
  ],
};

function validateRequired(sectionKey: string, data: any, extraData: any = {}): ValidationIssue[] {
  const canonical = canonicalSection(sectionKey);
  const requirements = REQUIRED_BY_SECTION[canonical] ?? [];
  const merged = { ...(extraData ?? {}), ...(data ?? {}) };
  const issues: ValidationIssue[] = [];
  for (const requirement of requirements) {
    if (requirement.when && !requirement.when(merged)) continue;
    if (blank(readAny(merged, requirement.keys))) {
      issues.push({
        section_key: sectionKey,
        field: requirement.keys[0],
        message: `${requirement.label} wajib diisi`,
      });
    }
  }
  return issues;
}

export function validateSectionBeforeSubmit(
  sectionKey: string,
  formData: any,
  candidate?: any,
  exam?: any,
): ValidationResult {
  const issues = validateRequired(sectionKey, formData, { candidate, exam, ...(candidate ?? {}) });
  return { valid: issues.length === 0, issues };
}

export function validateExamBeforeFinalize(examId: string): ValidationResult {
  const db = getDb() as any;
  const exam = (db.exams ?? []).find((e: any) => e.id === examId && !e.is_deleted);
  const issues: ValidationIssue[] = [];
  if (!exam) return { valid: false, issues: [{ field: "exam", message: "Exam tidak ditemukan" }] };
  const candidate = (db.candidates ?? []).find(
    (c: any) => c.id === exam.candidate_id && !c.is_deleted,
  );
  if (!candidate) issues.push({ field: "candidate", message: "Peserta tidak ditemukan" });
  issues.push(...validateRequired("identitas_anamnesis", {}, candidate ?? {}));

  const sections = (db.exam_sections ?? []).filter((s: any) => s.exam_id === examId);
  const requiredSections = sections.filter((s: any) => s.is_required !== false);
  for (const section of requiredSections) {
    if (isRevisionStatus(section.section_status)) {
      issues.push({
        section_key: section.section_key,
        field: "section_status",
        message: `${section.section_label ?? section.section_key} masih perlu revisi`,
      });
    } else if (!isCompletedStatus(section.section_status)) {
      issues.push({
        section_key: section.section_key,
        field: "section_status",
        message: `${section.section_label ?? section.section_key} belum Submitted/Approved`,
      });
    }
  }

  const byKey = (key: string) => sections.find((s: any) => canonicalSection(s.section_key) === key);
  if (
    !isCompletedStatus(byKey("ekg")?.section_status) &&
    !isCompletedStatus(exam.ekg_initial_status)
  ) {
    issues.push({ section_key: "ekg", field: "section_status", message: "EKG belum selesai" });
  }
  if (
    !isCompletedStatus(byKey("rontgen")?.section_status) &&
    !isCompletedStatus(exam.radiology_initial_status)
  ) {
    issues.push({
      section_key: "rontgen",
      field: "section_status",
      message: "Rontgen/Radiologi belum selesai",
    });
  }
  const resume = byKey("resume_rekomendasi");
  issues.push(...validateRequired("resume_rekomendasi", resume?.form_data_json ?? {}, exam));
  if (
    blank(
      readAny({ ...(exam ?? {}), ...(resume?.form_data_json ?? {}) }, [
        "final_result",
        "hasil_akhir",
        "graduation_decision",
      ]),
    )
  ) {
    issues.push({
      section_key: "resume_rekomendasi",
      field: "final_result",
      message: "Hasil akhir wajib diisi",
    });
  }

  const incompleteRows = buildIncompleteDataLocal().filter((row: any) => row.exam_id === examId);
  for (const row of incompleteRows) {
    for (const message of row.issues ?? []) issues.push({ field: "incomplete_data", message });
  }

  const unique = new Map<string, ValidationIssue>();
  for (const issue of issues)
    unique.set(`${issue.section_key ?? ""}|${issue.field}|${issue.message}`, issue);
  return { valid: unique.size === 0, issues: Array.from(unique.values()) };
}
