import { generateId, getDb, nowIso, saveDb } from "@/lib/localDb";

export function getRadiologyByExamIdLocal(examId: string) {
  const db = getDb() as any;
  return (db.exam_radiology ?? []).find((row: any) => row.exam_id === examId && !row.is_deleted) ?? null;
}

export function getRadiologyByCandidateIdLocal(candidateId: string) {
  const db = getDb() as any;
  return (db.exam_radiology ?? []).find((row: any) => row.candidate_id === candidateId && !row.is_deleted) ?? null;
}

export function upsertRadiologyLocal(input: any) {
  const db = getDb() as any;
  const now = nowIso();
  db.exam_radiology = db.exam_radiology ?? [];
  const index = db.exam_radiology.findIndex((row: any) => row.exam_id === input.exam_id && !row.is_deleted);
  if (index >= 0) {
    db.exam_radiology[index] = { ...db.exam_radiology[index], ...input, section_key: "rontgen", updated_at: now };
    saveDb(db);
    return db.exam_radiology[index];
  }
  const row = {
    id: generateId("rad"),
    exam_id: input.exam_id,
    candidate_id: input.candidate_id,
    selection_id: input.selection_id,
    section_key: "rontgen",
    status: input.status ?? "Draft",
    classification: input.classification ?? "",
    qualification: input.qualification ?? "",
    findings: input.findings ?? "",
    form_data_json: input.form_data_json ?? {},
    attachments_json: input.attachments_json ?? [],
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };
  db.exam_radiology.push(row);
  saveDb(db);
  return row;
}

export function deleteRadiologyLocal(id: string) {
  const db = getDb() as any;
  const now = nowIso();
  db.exam_radiology = (db.exam_radiology ?? []).map((row: any) =>
    row.id === id ? { ...row, is_deleted: true, deleted_at: now, updated_at: now } : row,
  );
  saveDb(db);
}
