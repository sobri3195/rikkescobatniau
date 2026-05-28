import { generateId, getDb, isSectionCompleted, nowIso, saveDb } from "@/lib/localDb";
import { createDefaultExamSectionsLocal } from "@/lib/services/examSectionService";

function defaultExam(candidate: any) {
  const now = nowIso();
  return {
    id: generateId("exam"),
    candidate_id: candidate.id,
    selection_id: candidate.selection_id ?? null,
    exam_status: "In Progress",
    hari_h_stage: "Registrasi Awal",
    ekg_initial_status: "Belum",
    radiology_initial_status: "Belum",
    progress_percentage: 0,
    progress_completed_count: 0,
    progress_total_count: 0,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };
}

export function createExamForCandidateLocal(candidate: any) {
  const db = getDb() as any;
  let currentExam = (db.exams ?? []).find(
    (item: any) => item.candidate_id === candidate.id && !item.is_deleted,
  );
  if (!currentExam) {
    currentExam = defaultExam(candidate);
    db.exams = db.exams ?? [];
    db.exams.push(currentExam);
    saveDb(db, "createExamForCandidateLocal");
  }
  createDefaultExamSectionsLocal(currentExam.id, candidate.id, candidate.selection_id);
  recalculateExamProgressLocal(currentExam.id);
  recalculateHariHStageLocal(currentExam.id);
  return currentExam;
}

export function getExamByCandidateIdLocal(candidateId: string) {
  return (
    (getDb() as any).exams?.find(
      (item: any) => item.candidate_id === candidateId && !item.is_deleted,
    ) ?? null
  );
}
export function listActiveExamsLocal() {
  return ((getDb() as any).exams ?? []).filter((item: any) => !item.is_deleted);
}
export function getExamDetailLocal(examId: string) {
  return ((getDb() as any).exams ?? []).find((item: any) => item.id === examId) ?? null;
}
export function getExamByIdLocal(examId: string) {
  return getExamDetailLocal(examId);
}
export function updateExamLocal(examId: string, patch: any) {
  const db = getDb() as any;
  const currentExam = (db.exams ?? []).find((item: any) => item.id === examId);
  if (!currentExam) return null;
  Object.assign(currentExam, patch, { updated_at: nowIso() });
  saveDb(db, "updateExamLocal");
  recalculateExamProgressLocal(examId);
  recalculateHariHStageLocal(examId);
  return currentExam;
}

export function recalculateExamProgressLocal(examId: string) {
  const db = getDb() as any;
  const currentExam = (db.exams ?? []).find((item: any) => item.id === examId);
  if (!currentExam) return null;
  const sections = (db.exam_sections ?? []).filter(
    (section: any) => section.exam_id === examId && section.is_required !== false,
  );
  const completed = sections.filter(
    (section: any) =>
      isSectionCompleted(section.section_status) || section.section_status === "Selesai",
  ).length;
  currentExam.progress_total_count = sections.length;
  currentExam.progress_completed_count = completed;
  currentExam.progress_percentage = sections.length
    ? Math.round((completed / sections.length) * 100)
    : 0;
  currentExam.updated_at = nowIso();
  saveDb(db, "recalculateExamProgressLocal");
  return currentExam;
}

function sectionDone(sections: any[], keys: string[]) {
  return sections.some(
    (section: any) =>
      keys.includes(section.section_key) &&
      (isSectionCompleted(section.section_status) || section.section_status === "Selesai"),
  );
}

export function recalculateHariHStageLocal(examId: string) {
  const db = getDb() as any;
  const currentExam = (db.exams ?? []).find((item: any) => item.id === examId);
  if (!currentExam) return null;
  const sections = (db.exam_sections ?? []).filter((section: any) => section.exam_id === examId);
  const required = sections.filter((section: any) => section.is_required !== false);
  const screeningDone = sectionDone(sections, ["screening_hari_h", "identitas_anamnesis"]);
  const allRequiredDone =
    required.length > 0 &&
    required.every(
      (section: any) =>
        isSectionCompleted(section.section_status) || section.section_status === "Selesai",
    );
  const subtimDone = required
    .filter(
      (section: any) =>
        !["identitas_anamnesis", "screening_hari_h", "penunjang"].includes(section.section_key),
    )
    .every(
      (section: any) =>
        isSectionCompleted(section.section_status) || section.section_status === "Selesai",
    );
  const ekgDone =
    ["Selesai", "Submitted", "Approved", "Locked"].includes(currentExam.ekg_initial_status) ||
    sectionDone(sections, ["ekg"]);
  const rontgenDone =
    ["Selesai", "Submitted", "Approved", "Locked"].includes(currentExam.radiology_initial_status) ||
    sectionDone(sections, ["penunjang", "rontgen"]);
  let stage = "Registrasi Awal";
  if (currentExam.exam_status === "Finalized" || currentExam.final_result) stage = "Finalized";
  else if (!ekgDone) stage = "Menunggu EKG";
  else if (!rontgenDone) stage = "Menunggu Rontgen";
  else if (!screeningDone) stage = "Screening Hari-H";
  else if (!subtimDone) stage = "Pemeriksaan Subtim";
  else if (allRequiredDone) stage = "Review";
  else stage = "Penunjang Awal Lengkap";
  currentExam.hari_h_stage = stage;
  currentExam.ekg_initial_status = ekgDone
    ? "Selesai"
    : (currentExam.ekg_initial_status ?? "Belum");
  currentExam.radiology_initial_status = rontgenDone
    ? "Selesai"
    : (currentExam.radiology_initial_status ?? "Belum");
  currentExam.updated_at = nowIso();
  saveDb(db, "recalculateHariHStageLocal");
  return currentExam;
}

export const recalcExamProgressLocal = recalculateExamProgressLocal;

export function ensureExamForCandidateLocal(candidateId: string) {
  const db = getDb() as any;
  const candidate = (db.candidates ?? []).find(
    (item: any) => item.id === candidateId && !item.is_deleted,
  );
  if (!candidate) throw new Error("Candidate tidak ditemukan.");
  return createExamForCandidateLocal(candidate);
}
