import { generateId, getDb, nowIso, saveDb } from "@/lib/localDb";
import { addAuditLogLocal } from "@/lib/services/auditService";
import { recalcExamProgressLocal } from "@/lib/services/examService";
import { recalculateHariHStageLocal, refreshAllDerivedDataLocal, syncExamRelationsLocal } from "@/lib/services/syncService";

const DEFAULT_SECTIONS = [
  ["identitas_anamnesis", "Identitas & Anamnesis"],
  ["screening_hari_h", "Screening Hari-H"],
  ["pemeriksaan_umum", "Pemeriksaan Umum"],
  ["ekg", "EKG"],
  ["rontgen", "Rontgen"],
  ["tht", "THT"],
  ["mata_visus", "Mata/Visus"],
  ["bedah", "Bedah"],
  ["neurologi", "Neurologi"],
  ["laboratorium", "Laboratorium"],
  ["gigi", "Gigi"],
  ["jiwa_keswa", "Jiwa/Keswa"],
  ["resume_rekomendasi", "Resume & Rekomendasi"],
] as const;

export function createDefaultExamSectionsLocal(examId: string, candidateId: string, selectionId: string) {
  const db = getDb() as any;
  const now = nowIso();
  db.exam_sections = db.exam_sections ?? [];
  for (const [key, label] of DEFAULT_SECTIONS) {
    if (db.exam_sections.some((s: any) => s.exam_id === examId && s.section_key === key)) continue;
    db.exam_sections.push({
      id: generateId("section"), exam_id: examId, candidate_id: candidateId, selection_id: selectionId,
      section_key: key, section_label: label, section_status: "Draft", is_required: key === "neurologi" ? !!db.settings?.neuro_required : true,
      form_data_json: {}, submitted_at: null, submitted_by: null, created_at: now, updated_at: now,
    });
  }
  saveDb(db);
  syncExamRelationsLocal(examId);
  refreshAllDerivedDataLocal();
}

export function updateSectionLocal(examId: string, sectionKey: string, patch: any) {
  const db = getDb() as any;
  const row = (db.exam_sections ?? []).find((s: any) => s.exam_id === examId && s.section_key === sectionKey);
  if (!row) return null;
  Object.assign(row, patch, { updated_at: nowIso() });
  saveDb(db);
  recalcExamProgressLocal(examId);
  recalculateHariHStageLocal(examId);
  syncExamRelationsLocal(examId);
  refreshAllDerivedDataLocal();
  addAuditLogLocal(patch?.section_status === "Submitted" ? "submit_section" : "save_draft_section", { exam_id: examId, section_key: sectionKey });
  return row;
}

export function submitSectionLocal(examId: string, sectionKey: string, formData: any) {
  const row = updateSectionLocal(examId, sectionKey, { section_status: "Submitted", form_data_json: formData, submitted_at: nowIso() });
  addAuditLogLocal("submit_section", { exam_id: examId, section_key: sectionKey });
  return row;
}

export function returnSectionToDraftLocal(examId: string, sectionKey: string) {
  const row = updateSectionLocal(examId, sectionKey, {
    section_status: "Draft",
    submitted_at: null,
    submitted_by: null,
  });
  addAuditLogLocal("save_draft_section", { exam_id: examId, section_key: sectionKey });
  return row;
}

export { recalcExamProgressLocal };
