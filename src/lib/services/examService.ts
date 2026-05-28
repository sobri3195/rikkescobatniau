import { generateId, getDb, nowIso, saveDb } from "@/lib/localDb";
import { createDefaultExamSectionsLocal } from "@/lib/services/examSectionService";
import { recalculateExamProgressLocal, refreshAllDerivedDataLocal, syncExamRelationsLocal } from "@/lib/services/syncService";

export function createExamForCandidateLocal(candidate: any) {
  const db = getDb() as any;
  const now = nowIso();
  let exam = (db.exams ?? []).find((e: any) => e.candidate_id === candidate.id && !e.is_deleted);
  if (!exam) {
    exam = { id: generateId("exam"), candidate_id: candidate.id, selection_id: candidate.selection_id, exam_status: "In Progress", hari_h_stage: "Menunggu Rontgen & EKG", ekg_initial_status: "Belum", radiology_initial_status: "Belum", progress_percentage: 0, progress_completed_count: 0, progress_total_count: 0, is_deleted: false, created_at: now, updated_at: now };
    db.exams = db.exams ?? [];
    db.exams.push(exam);
    saveDb(db); syncExamRelationsLocal(exam.id); refreshAllDerivedDataLocal();
  }
  createDefaultExamSectionsLocal(exam.id, candidate.id, candidate.selection_id);
  return exam;
}

export function getExamByCandidateIdLocal(candidateId: string) { return (getDb() as any).exams?.find((e: any) => e.candidate_id === candidateId && !e.is_deleted) ?? null; }
export function listActiveExamsLocal() { return ((getDb() as any).exams ?? []).filter((e: any) => !e.is_deleted); }
export function getExamDetailLocal(examId: string) { return ((getDb() as any).exams ?? []).find((e: any) => e.id === examId) ?? null; }
export function getExamByIdLocal(examId: string) { return getExamDetailLocal(examId); }
export function updateExamLocal(examId: string, patch: any) { const db = getDb() as any; const ex = (db.exams ?? []).find((e: any) => e.id === examId); if (!ex) return null; Object.assign(ex, patch, { updated_at: nowIso() }); saveDb(db); syncExamRelationsLocal(examId); refreshAllDerivedDataLocal(); return ex; }
export function recalcExamProgressLocal(examId: string) { return recalculateExamProgressLocal(examId); }


export function ensureExamForCandidateLocal(candidateId: string) {
  const db = getDb() as any;
  const candidate = (db.candidates ?? []).find((c: any) => c.id === candidateId && !c.is_deleted);
  if (!candidate) throw new Error("Candidate tidak ditemukan.");

  let exam = (db.exams ?? []).find((e: any) => e.candidate_id === candidate.id && !e.is_deleted);
  if (!exam) {
    const now = nowIso();
    exam = {
      id: generateId("exam"),
      candidate_id: candidate.id,
      selection_id: candidate.selection_id ?? null,
      exam_status: "In Progress",
      hari_h_stage: "Menunggu Rontgen & EKG",
      ekg_initial_status: "Belum",
      radiology_initial_status: "Belum",
      progress_percentage: 0,
      progress_completed_count: 0,
      progress_total_count: 0,
      is_deleted: false,
      created_at: now,
      updated_at: now,
    };
    db.exams = [...(db.exams ?? []), exam];
    saveDb(db); syncExamRelationsLocal(exam.id); refreshAllDerivedDataLocal();
  }

  createDefaultExamSectionsLocal(exam.id, candidate.id, candidate.selection_id);
  return exam;
}
