import { getDb } from "@/lib/localDb";

export function buildParticipantRowLocal(candidate: any, dbArg?: any) {
  const db = dbArg ?? getDb();

  const exam = (db.exams ?? []).find(
    (item: any) => item.candidate_id === candidate.id && !item.is_deleted,
  );

  const selection = (db.selections ?? []).find((item: any) => item.id === candidate.selection_id);

  const sections = (db.exam_sections ?? []).filter((section: any) => section.exam_id === exam?.id);

  const fullName = candidate.full_name ?? candidate.name ?? candidate.nama ?? "-";

  const testNumber = String(candidate.test_number ?? "").trim();
  const temporaryId = String(candidate.temporary_id ?? "").trim();

  return {
    ...candidate,
    candidate_id: candidate.id,
    exam_id: exam?.id ?? null,
    selection_id: candidate.selection_id,

    full_name: fullName,
    display_name: fullName,

    test_number: testNumber,
    temporary_id: temporaryId,
    display_identifier: testNumber || temporaryId || "-",

    rank: candidate.rank ?? candidate.pangkat ?? "-",
    nrp_nip: candidate.nrp_nip ?? candidate.nrp ?? candidate.nip ?? "-",
    unit_position: candidate.unit_position ?? candidate.unit ?? candidate.satuan ?? "-",
    pok_korp: candidate.pok_korp ?? candidate.pok ?? candidate.korp ?? "-",
    panda: candidate.panda ?? candidate.pnd_code ?? "-",

    selection_name: selection?.selection_name ?? selection?.name ?? "-",

    exam_status: exam?.exam_status ?? "In Progress",
    hari_h_stage: exam?.hari_h_stage ?? "Registrasi Awal",
    ekg_initial_status: exam?.ekg_initial_status ?? "Belum",
    radiology_initial_status: exam?.radiology_initial_status ?? "Belum",
    progress_percentage: exam?.progress_percentage ?? 0,
    progress_completed_count: exam?.progress_completed_count ?? 0,
    progress_total_count: exam?.progress_total_count ?? sections.length,

    candidate,
    exam,
    selection,
    sections,
  };
}
