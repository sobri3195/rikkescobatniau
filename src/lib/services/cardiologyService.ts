import { generateId, getDb, nowIso, saveDb } from "@/lib/localDb";

export function getCardiologyByExamIdLocal(examId: string) {
  const db = getDb() as any;
  return (db.exam_cardiology ?? []).find((row: any) => row.exam_id === examId && !row.is_deleted) ?? null;
}

export function upsertCardiologyLocal(input: any) {
  const db = getDb() as any;
  const now = nowIso();
  db.exam_cardiology = db.exam_cardiology ?? [];
  const index = db.exam_cardiology.findIndex((row: any) => row.exam_id === input.exam_id && !row.is_deleted);
  if (index >= 0) {
    db.exam_cardiology[index] = { ...db.exam_cardiology[index], ...input, section_key: "ekg", updated_at: now };
    saveDb(db);
    return db.exam_cardiology[index];
  }
  const row = { id: generateId("ekg"), section_key: "ekg", status: input.status ?? "Draft", attachments_json: [], is_deleted: false, created_at: now, updated_at: now, ...input };
  db.exam_cardiology.push(row);
  saveDb(db);
  return row;
}
