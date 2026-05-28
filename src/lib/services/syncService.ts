import {
  DEFAULT_EXAM_SECTIONS,
  getDb,
  nowIso,
  repairLocalDbRelations as repairCoreLocalDbRelations,
  saveDb,
} from "@/lib/localDb";
import {
  recalculateExamProgressLocal,
  recalculateHariHStageLocal,
} from "@/lib/services/examService";

function refreshExam(examId: string) {
  recalculateExamProgressLocal(examId);
  recalculateHariHStageLocal(examId);
}

export function syncCandidateRelationsLocal(candidateId: string) {
  const db = getDb() as any;
  repairCoreLocalDbRelations(db);
  const candidate = (db.candidates ?? []).find((item: any) => item.id === candidateId);
  if (candidate) {
    for (const exam of db.exams ?? []) {
      if (exam.candidate_id !== candidate.id) continue;
      exam.selection_id = candidate.selection_id ?? exam.selection_id ?? null;
      exam.updated_at = nowIso();
      for (const section of db.exam_sections ?? []) {
        if (section.exam_id !== exam.id) continue;
        section.candidate_id = candidate.id;
        section.selection_id = exam.selection_id ?? candidate.selection_id ?? null;
        section.updated_at = nowIso();
      }
    }
  }
  saveDb(db, "syncCandidateRelationsLocal");
  (db.exams ?? [])
    .filter((exam: any) => exam.candidate_id === candidateId)
    .forEach((exam: any) => refreshExam(exam.id));
  return candidate ?? null;
}

export function syncExamRelationsLocal(examId: string) {
  const db = getDb() as any;
  repairCoreLocalDbRelations(db);
  const exam = (db.exams ?? []).find((item: any) => item.id === examId);
  const candidate = (db.candidates ?? []).find((item: any) => item.id === exam?.candidate_id);
  if (exam) {
    exam.selection_id = candidate?.selection_id ?? exam.selection_id ?? null;
    for (const [sectionKey, label] of DEFAULT_EXAM_SECTIONS) {
      let section = (db.exam_sections ?? []).find(
        (item: any) => item.exam_id === exam.id && item.section_key === sectionKey,
      );
      if (!section) {
        section = {
          id: `section_${Math.random().toString(36).slice(2, 10)}`,
          exam_id: exam.id,
          section_key: sectionKey,
          section_label: label,
          section_status: "Draft",
          is_required: sectionKey !== "neurologi_subtim",
          form_data_json: {},
          created_at: nowIso(),
        };
        db.exam_sections.push(section);
      }
      section.candidate_id = exam.candidate_id;
      section.selection_id = exam.selection_id;
      section.updated_at = nowIso();
    }
  }
  saveDb(db, "syncExamRelationsLocal");
  if (exam) refreshExam(exam.id);
  return exam ?? null;
}

export function syncSelectionRelationsLocal(selectionId: string) {
  const db = getDb() as any;
  repairCoreLocalDbRelations(db);
  for (const candidate of db.candidates ?? []) {
    if (candidate.selection_id === selectionId && !candidate.is_deleted)
      syncCandidateRelationsLocal(candidate.id);
  }
  return selectionId;
}

export function syncAllLocalRelations() {
  const db = getDb() as any;
  repairCoreLocalDbRelations(db);
  saveDb(db, "syncAllLocalRelations");
  for (const exam of db.exams ?? []) refreshExam(exam.id);
  return db;
}

export function refreshAllDerivedDataLocal() {
  return syncAllLocalRelations();
}

export function repairLocalDbRelations() {
  return syncAllLocalRelations();
}
