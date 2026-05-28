import { getDb, isSectionCompleted, repairLocalDbRelations } from "@/lib/localDb";
import { buildParticipantRowLocal } from "@/lib/services/participantRowService";

const REQUIRED_CANDIDATE_FIELDS = [
  "full_name",
  "gender",
  "rank",
  "nrp_nip",
  "unit_position",
  "pok_korp",
  "panda",
  "selection_id",
];

export function buildIncompleteDataLocal() {
  const db = getDb() as any;
  repairLocalDbRelations(db);
  return (db.candidates ?? [])
    .filter((candidate: any) => !candidate.is_deleted && !candidate.deleted_at)
    .map((candidate: any) => {
      const row = buildParticipantRowLocal(candidate, db);
      const missing: string[] = [];
      for (const field of REQUIRED_CANDIDATE_FIELDS) {
        if (!String(candidate[field] ?? "").trim()) missing.push(`Field peserta kosong: ${field}`);
      }
      if (!row.exam) missing.push("Exam belum tersedia");
      for (const section of row.sections ?? []) {
        if (section.is_required !== false && !isSectionCompleted(section.section_status))
          missing.push(`Section belum submit: ${section.section_label ?? section.section_key}`);
      }
      if (row.ekg_initial_status !== "Selesai" && row.ekg_initial_status !== "Submitted")
        missing.push("EKG belum selesai");
      if (
        row.radiology_initial_status !== "Selesai" &&
        row.radiology_initial_status !== "Submitted"
      )
        missing.push("Rontgen belum selesai");
      if (row.exam?.exam_status === "Finalized" && !String(candidate.test_number ?? "").trim())
        missing.push("No test final kosong");
      return {
        ...row,
        missing_items: missing,
        missing_count: missing.length,
        is_complete: missing.length === 0,
      };
    })
    .filter((row: any) => !row.is_complete);
}
