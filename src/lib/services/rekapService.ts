import { getDb, repairLocalDbRelations } from "@/lib/localDb";
import { buildParticipantRowLocal } from "@/lib/services/participantRowService";

export function buildRekapRowsLocal(filters: { selection_id?: string | null } = {}) {
  const db = getDb() as any;
  repairLocalDbRelations(db);
  return (db.candidates ?? [])
    .filter((candidate: any) => !candidate.is_deleted && !candidate.deleted_at)
    .filter(
      (candidate: any) => !filters.selection_id || candidate.selection_id === filters.selection_id,
    )
    .map((candidate: any) => {
      const row = buildParticipantRowLocal(candidate, db);
      const sectionMap = Object.fromEntries(
        (row.sections ?? []).map((section: any) => [section.section_key, section]),
      );
      const medicalSummary =
        (db.medical_summary ?? []).find((summary: any) => summary.exam_id === row.exam_id) ?? null;
      return {
        ...row,
        sections: sectionMap,
        medical_summary: medicalSummary,
        final_result: row.exam?.final_result ?? medicalSummary?.final_result ?? "Belum Lengkap",
        kesum_classification:
          row.exam?.kesum_classification ?? medicalSummary?.kesum_classification ?? "Belum Lengkap",
        keswa_status: row.exam?.keswa_status ?? medicalSummary?.keswa_status ?? "Belum Lengkap",
      };
    });
}
