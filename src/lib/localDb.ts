export const LOCAL_DB_KEY = "rikkes_tni_au_local_db_v1";
export const LOCAL_SESSION_KEY = "rikkes_tni_au_session";

const DEFAULT_SECTIONS = [
  ["identitas", "Identitas"],
  ["anamnesis", "Anamnesis"],
  ["pemeriksaan_umum", "Pemeriksaan Umum"],
  ["rontgen", "Rontgen"],
  ["ekg", "EKG"],
  ["tht", "THT"],
  ["mata_visus", "Mata/Visus"],
  ["bedah", "Bedah"],
  ["neurologi", "Neurologi"],
  ["laboratorium", "Laboratorium"],
  ["jiwa_keswa", "Jiwa/Keswa"],
  ["resume", "Resume"],
] as const;

export type LocalDb = ReturnType<typeof createEmptyDb>;

export function nowIso() { return new Date().toISOString(); }
export function generateId(prefix: string) { return `${prefix}_${Math.random().toString(36).slice(2, 10)}`; }

function createEmptyDb() {
  const now = nowIso();
  return {
    meta: { app_name: "RIKKES TNI AU", storage_version: 1, created_at: now, updated_at: now },
    auth: { current_user_id: "user_superadmin", current_role: "super_admin" },
    users: [{ id: "user_superadmin", name: "Super Admin", role: "super_admin", username: "admin", password: "admin123" }],
    selections: [], candidates: [], exams: [], exam_sections: [],
    exam_radiology: [], exam_cardiology: [], exam_ent: [], exam_eye: [], exam_surgery: [], exam_neurology: [], exam_laboratory: [], exam_psychiatry: [],
    medical_attachments: [], medical_history_forms: [], test_number_import_sessions: [], test_number_import_rows: [], bulk_import_sessions: [], audit_logs: [],
    settings: { neuro_required: false, progress_weights: {}, active_selection_id: null as string | null },
  };
}

function saveDb(db: LocalDb) { db.meta.updated_at = nowIso(); localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db)); }
export function initLocalDb() { const db = createEmptyDb(); saveDb(db); return db; }
export function getDb(): LocalDb { try { const raw = localStorage.getItem(LOCAL_DB_KEY); if (!raw) return initLocalDb(); return JSON.parse(raw); } catch { return initLocalDb(); } }
export function resetLocalDb() { return initLocalDb(); }
export function seedLocalDb() { const db = getDb(); if (!db.selections.length) db.selections.push({ id: generateId("sel"), name: "Seleksi Demo", year: "2026" }); saveDb(db); return db; }
export function exportLocalDb() { return JSON.stringify(getDb(), null, 2); }
export function importLocalDb(json: string) { const parsed = JSON.parse(json); localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(parsed)); return parsed; }

export function getCollection(collectionName: keyof LocalDb) { return getDb()[collectionName] as any[]; }
export function setCollection(collectionName: keyof LocalDb, data: any) { const db = getDb(); (db as any)[collectionName] = data; saveDb(db); }
export function insertRecord(collectionName: keyof LocalDb, record: any) { const db = getDb(); (db as any)[collectionName].push(record); saveDb(db); return record; }
export function updateRecord(collectionName: keyof LocalDb, id: string, patch: any) { const db = getDb(); const rows = (db as any)[collectionName]; const i = rows.findIndex((r: any) => r.id === id); if (i >= 0) rows[i] = { ...rows[i], ...patch, updated_at: nowIso() }; saveDb(db); return i >= 0 ? rows[i] : null; }
export function deleteRecord(collectionName: keyof LocalDb, id: string) { const db = getDb(); (db as any)[collectionName] = (db as any)[collectionName].filter((r: any) => r.id !== id); saveDb(db); }
export function findRecordById(collectionName: keyof LocalDb, id: string) { return getCollection(collectionName).find((r: any) => r.id === id); }
export function queryRecords(collectionName: keyof LocalDb, filterFn: (r: any) => boolean) { return getCollection(collectionName).filter(filterFn); }

export function normalizeSectionKey(sectionKey?: string | null) { const key = (sectionKey ?? "").toLowerCase(); const map: Record<string, string> = { ent: "tht", tht_subtim: "tht", mata_lihat: "mata_visus", mata_vision: "mata_visus", vision: "mata_visus", visus: "mata_visus", surgery: "bedah", bedah_subtim: "bedah", neuro: "neurologi", neurology: "neurologi", neurologi_subtim: "neurologi", exam_neurology: "neurologi", lab: "laboratorium", laboratory: "laboratorium", exam_laboratory: "laboratorium", keswa: "jiwa_keswa", psikiatri: "jiwa_keswa", psychiatry: "jiwa_keswa", status_psikiatri: "jiwa_keswa", exam_psychiatry: "jiwa_keswa", mental_health: "jiwa_keswa", exam_mental_health: "jiwa_keswa", radiology: "rontgen", radiologi: "rontgen", cardiology: "ekg", kardiologi: "ekg" }; return map[key] ?? key; }
export function normalizeSectionStatus(status?: string | null) { const s = (status ?? "").toLowerCase(); if (s === "submitted") return "Submitted"; if (s === "approved") return "Approved"; if (s === "locked") return "Locked"; if (s === "revision") return "Revision"; if (s === "optional") return "Optional"; return "Draft"; }
export function isSectionCompleted(status?: string | null) { return ["Submitted", "Approved", "Locked"].includes(normalizeSectionStatus(status)); }

function upsertAuditLog(db: LocalDb, action: string, examId: string, candidateId: string | null, sectionKey: string, beforeData: any, afterData: any) {
  db.audit_logs.push({
    id: generateId("audit"),
    user_id: db.auth.current_user_id,
    role: db.auth.current_role,
    action,
    module: "Section Status Sync Local",
    candidate_id: candidateId,
    exam_id: examId,
    section_key: sectionKey,
    before_data_json: beforeData,
    after_data_json: afterData,
    created_at: nowIso(),
  });
}

export function syncNeurologiLabKeswaStatusLocal(examId: string): { changed: boolean } {
  const db = getDb();
  let changed = false;
  const targets = ["neurologi", "laboratorium", "jiwa_keswa"] as const;
  const findChild = (key: string) => {
    if (key === "neurologi") return (db.exam_neurology as any[]).find((x) => x.exam_id === examId);
    if (key === "laboratorium") return (db.exam_laboratory as any[]).find((x) => x.exam_id === examId);
    return (db.exam_psychiatry as any[]).find((x) => x.exam_id === examId);
  };
  for (const key of targets) {
    const parent = (db.exam_sections as any[]).find((s) => s.exam_id === examId && normalizeSectionKey(s.section_key) === key);
    const child: any = findChild(key);
    const childStatus = normalizeSectionStatus(child?.status ?? child?.section_status ?? child?.form_data_json?.status);
    const childSubmittedAt = child?.submitted_at ?? child?.form_data_json?.submitted_at ?? null;
    const hasChildSubmit = isSectionCompleted(childStatus) || !!childSubmittedAt;
    const parentStatus = normalizeSectionStatus(parent?.section_status);
    if (parent && hasChildSubmit && parentStatus === "Draft") {
      const before = { ...parent };
      parent.section_status = "Submitted";
      parent.submitted_at = parent.submitted_at ?? childSubmittedAt ?? nowIso();
      parent.submitted_by = parent.submitted_by ?? db.auth.current_user_id;
      parent.updated_at = nowIso();
      upsertAuditLog(db, `fix_${key}_status_from_child_local`, examId, parent.candidate_id ?? null, key, before, parent);
      changed = true;
    }
  }
  if (changed) {
    upsertAuditLog(db, "sync_neurologi_lab_keswa_status_local", examId, null, "all", {}, { synced: true });
    saveDb(db);
  }
  return { changed };
}

export function getDisplayStatusLocal(examId: string, sectionKey: string, neuroRequired = true): string {
  const canonical = normalizeSectionKey(sectionKey);
  syncNeurologiLabKeswaStatusLocal(examId);
  const db = getDb();
  const section = (db.exam_sections as any[]).find((s) => s.exam_id === examId && normalizeSectionKey(s.section_key) === canonical);
  const parentStatus = normalizeSectionStatus(section?.section_status);
  if (isSectionCompleted(parentStatus) || parentStatus === "Revision") return parentStatus;
  if (canonical === "neurologi" && !neuroRequired) return "Optional";
  return "Draft";
}

export const localDb = {
  candidates: {
    list: () => getDb().candidates,
    getById: (id: string) => getDb().candidates.find((c: any) => c.id === id),
    create: (data: any) => {
      const db = getDb(); const now = nowIso();
      const cand = { id: generateId("cand"), test_number: "", test_number_status: "pending", ...data, created_at: now, updated_at: now };
      db.candidates.push(cand);
      const exam = { id: generateId("exam"), candidate_id: cand.id, selection_id: cand.selection_id, exam_status: "Draft", hari_h_stage: "Menunggu Rontgen & EKG", progress_percentage: 0, progress_completed_count: 0, progress_total_count: 0, created_at: now, updated_at: now };
      db.exams.push(exam);
      for (const [k, label] of DEFAULT_SECTIONS) db.exam_sections.push({ id: generateId("section"), exam_id: exam.id, candidate_id: cand.id, section_key: k, section_label: label, section_status: "Draft", is_required: k !== "neurologi", form_data_json: {}, created_at: now, updated_at: now });
      saveDb(db); return cand;
    },
  },
};
