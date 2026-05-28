import { generateId, getDb, getLocalSession, nowIso, saveDb } from "@/lib/localDb";
import { addAuditLogLocal } from "@/lib/services/auditService";
import { createExamForCandidateLocal } from "@/lib/services/examService";

function generateTemporaryId(db: any) {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const n = ((db.candidates ?? []).filter((c: any) => String(c.temporary_id ?? "").startsWith(`TMP-${ymd}-`)).length + 1).toString().padStart(4, "0");
  return `TMP-${ymd}-${n}`;
}

export function listCandidatesLocal() { return (getDb() as any).candidates ?? []; }
export function listCandidatesBySelectionLocal(selectionId: string) { return listCandidatesLocal().filter((c: any) => c.selection_id === selectionId); }
export function listCandidatesWithoutTestNumberLocal(filters: any = {}) {
  const db = getDb() as any;
  let rows = (db.candidates ?? []).filter((c: any) => filters.showDeleted ? !!c.is_deleted : !c.is_deleted).filter((c: any) => {
    const noTestEmpty = !c.test_number || String(c.test_number).trim() === "" || c.test_number === "-";
    return noTestEmpty || c.test_number_status === "pending" || c.no_test_missing === true;
  }).map((candidate: any) => {
    const exam = (db.exams ?? []).find((e: any) => e.candidate_id === candidate.id && !e.is_deleted);
    const selection = (db.selections ?? []).find((s: any) => s.id === candidate.selection_id);
    return { ...candidate, candidate_id: candidate.id, exam_id: exam?.id ?? null, selection_name: selection?.selection_name ?? selection?.name ?? "-", exam_status: exam?.exam_status ?? "Belum Ada Exam", hari_h_stage: exam?.hari_h_stage ?? "-", ekg_initial_status: exam?.ekg_initial_status ?? "Belum", radiology_initial_status: exam?.radiology_initial_status ?? "Belum", progress_percentage: exam?.progress_percentage ?? 0 };
  });
  if (filters.selection_id) rows = rows.filter((r: any) => r.selection_id === filters.selection_id);
  if (filters.search) { const q = String(filters.search).toLowerCase(); rows = rows.filter((r: any) => [r.full_name, r.temporary_id, r.nrp_nip, r.unit_position, r.rank, r.panda, r.pok_korp, r.test_number].some((v: any) => String(v ?? "").toLowerCase().includes(q))); }
  return rows;
}

export function createCandidateLocal(input: any) { const db = getDb() as any; if (!input.selection_id) throw new Error("selection_id wajib"); const now = nowIso(); const tn = String(input.test_number ?? "").trim(); if (tn) { const dup = findDuplicateTestNumberLocal({ selectionId: input.selection_id, testNumber: tn }); if (dup) throw new Error(`Nomor test sudah dipakai oleh ${dup.full_name ?? "peserta lain"}.`); } const candidate = { id: generateId("cand"), selection_id: input.selection_id, full_name: input.full_name, gender: input.gender ?? "L", rank: input.rank ?? "", nrp_nip: input.nrp_nip ?? "", unit_position: input.unit_position ?? input.unit ?? "", pok_korp: input.pok_korp ?? "", panda: input.panda ?? "", group_name: input.group_name ?? input.kelompok ?? "", birth_place: input.birth_place ?? "", birth_date: input.birth_date ?? "", phone: input.phone ?? "", address: input.address ?? "", test_number: tn, temporary_id: tn ? "" : generateTemporaryId(db), test_number_status: tn ? "assigned" : "pending", no_test_missing: !tn, registration_notes: input.registration_notes ?? "", is_deleted: false, created_at: now, updated_at: now }; db.candidates = db.candidates ?? []; db.candidates.push(candidate); saveDb(db); createExamForCandidateLocal(candidate); addAuditLogLocal("create_candidate_local", { candidate_id: candidate.id, selection_id: candidate.selection_id }); return candidate; }
export function updateCandidateLocal(id: string, patch: any) {
  const db = getDb() as any;
  const now = nowIso();
  const session = getLocalSession();
  const index = (db.candidates ?? []).findIndex((candidate: any) => candidate.id === id);
  if (index < 0) throw new Error("Peserta tidak ditemukan di localDb.");

  const before = db.candidates[index];
  const prevSelectionId = before.selection_id;
  const normalizedTestNumber = String(patch?.test_number ?? before.test_number ?? "").trim();

  if (normalizedTestNumber) {
    const dup = findDuplicateTestNumberLocal({
      selectionId: patch.selection_id ?? before.selection_id,
      testNumber: normalizedTestNumber,
      excludeCandidateId: id,
    });
    if (dup) throw new Error(`Nomor test sudah dipakai oleh ${dup.full_name ?? "peserta lain"}.`);
  }

  const next = {
    ...before,
    ...patch,
    test_number: normalizedTestNumber,
    test_number_status: normalizedTestNumber ? "assigned" : "pending",
    no_test_missing: !normalizedTestNumber,
    temporary_id: normalizedTestNumber ? (patch?.temporary_id ?? before.temporary_id ?? "") : (patch?.temporary_id ?? before.temporary_id ?? generateTemporaryId(db)),
    updated_at: now,
    updated_by: session?.user_id ?? "local_user",
  };

  db.candidates[index] = next;

  if (prevSelectionId !== next.selection_id) {
    db.exams = (db.exams ?? []).map((exam: any) => exam.candidate_id === id ? { ...exam, selection_id: next.selection_id, updated_at: now } : exam);
    db.exam_sections = (db.exam_sections ?? []).map((section: any) => section.candidate_id === id ? { ...section, selection_id: next.selection_id, updated_at: now } : section);
  }

  db.audit_logs = [
    ...(db.audit_logs ?? []),
    {
      id: generateId("audit"),
      user_id: session?.user_id ?? "local_user",
      role: session?.role ?? "unknown",
      action: "update_candidate_local",
      module: "Candidates",
      candidate_id: id,
      before_data_json: before,
      after_data_json: next,
      created_at: now,
    },
  ];

  saveDb(db);
  return next;
}
export function deleteCandidateLocal(id: string) { return updateCandidateLocal(id, { is_deleted: true, deleted_at: nowIso(), deleted_by: getLocalSession()?.user_id ?? "system_local" }); }
export function restoreCandidateLocal(id: string) { return updateCandidateLocal(id, { is_deleted: false, deleted_at: null, deleted_by: null }); }


export function getCandidateByIdLocal(candidateId: string) {
  return ((getDb() as any).candidates ?? []).find((candidate: any) => candidate.id === candidateId && !candidate.is_deleted) ?? null;
}

export function findDuplicateTestNumberLocal({ selectionId, testNumber, excludeCandidateId }: { selectionId: string; testNumber: string; excludeCandidateId?: string; }) {
  const db = getDb() as any;
  const normalizedTestNumber = String(testNumber ?? "").trim();
  if (!normalizedTestNumber) return null;
  return (db.candidates ?? []).find((candidate: any) => {
    const sameSelection = candidate.selection_id === selectionId;
    const sameTestNumber = String(candidate.test_number ?? "").trim() === normalizedTestNumber;
    const notSelf = candidate.id !== excludeCandidateId;
    const notDeleted = !candidate.is_deleted && !candidate.deleted_at;
    return sameSelection && sameTestNumber && notSelf && notDeleted;
  }) ?? null;
}
