import { getDb, repairLocalDbRelations } from "@/lib/localDb";

export function loadDashboardSummaryLocal() {
  const db = getDb() as any;
  repairLocalDbRelations(db);
  const candidates = (db.candidates ?? []).filter(
    (candidate: any) => !candidate.is_deleted && !candidate.deleted_at,
  );
  const exams = (db.exams ?? []).filter((exam: any) => !exam.is_deleted);
  const sections = db.exam_sections ?? [];
  const completedSections = sections.filter((section: any) =>
    ["Submitted", "Approved", "Locked", "Selesai", "Finalized"].includes(section.section_status),
  ).length;
  return {
    totalSelections: (db.selections ?? []).filter(
      (selection: any) => !selection.is_deleted && selection.status !== "deleted",
    ).length,
    totalCandidates: candidates.length,
    totalExams: exams.length,
    completedExams: exams.filter(
      (exam: any) => exam.exam_status === "Completed" || exam.progress_percentage >= 100,
    ).length,
    inProgressExams: exams.filter(
      (exam: any) => exam.exam_status !== "Completed" && (exam.progress_percentage ?? 0) < 100,
    ).length,
    averageProgress: exams.length
      ? Math.round(
          exams.reduce((sum: number, exam: any) => sum + Number(exam.progress_percentage ?? 0), 0) /
            exams.length,
        )
      : 0,
    completedSections,
    totalSections: sections.length,
  };
}

export function buildDashboardSummaryLocal() {
  return loadDashboardSummaryLocal();
}
