import { getDb } from "@/lib/localDb";
import { isLocalMode } from "@/lib/storage-mode";

export async function listActiveExams() {
  if (isLocalMode) {
    return listActiveExamsLocal();
  }
  throw new Error("Supabase disabled. Use localDb only.");
}

export function listActiveExamsLocal() {
  const db = getDb() as any;

  return (db.exams ?? [])
    .filter((exam: any) => exam.exam_status !== "Finalized")
    .slice(0, 1000)
    .map((exam: any) => {
      const candidate = (db.candidates ?? []).find((c: any) => c.id === exam.candidate_id) ?? null;
      const medicalHistoryForms = (db.medical_history_forms ?? []).filter((f: any) => f.exam_id === exam.id);
      const sections = (db.exam_sections ?? []).filter((s: any) => s.exam_id === exam.id);

      return {
        ...exam,
        candidate,
        candidates: candidate,
        medical_history_forms: medicalHistoryForms,
        exam_sections: sections,
      };
    });
}

export function getExamDetailLocal(examId: string) {
  const db = getDb() as any;

  const exam = (db.exams ?? []).find((e: any) => e.id === examId);
  if (!exam) return null;

  const candidate = (db.candidates ?? []).find((c: any) => c.id === exam.candidate_id) ?? null;
  const sections = (db.exam_sections ?? []).filter((s: any) => s.exam_id === exam.id);
  const medicalHistoryForms = (db.medical_history_forms ?? []).filter((f: any) => f.exam_id === exam.id);

  return {
    exam,
    candidate,
    sections,
    medical_history_forms: medicalHistoryForms,
  };
}
