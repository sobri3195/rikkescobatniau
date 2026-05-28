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

export function normalizeSectionKey(sectionKey?: string | null) { const key = (sectionKey ?? "").toLowerCase(); const map: Record<string, string> = { ent: "tht", tht_subtim: "tht", mata_lihat: "mata_visus", mata_vision: "mata_visus", vision: "mata_visus", visus: "mata_visus", surgery: "bedah", bedah_subtim: "bedah", neuro: "neurologi", neurology: "neurologi", neurologi_subtim: "neurologi", lab: "laboratorium", laboratory: "laboratorium", exam_laboratory: "laboratorium", keswa: "jiwa_keswa", psikiatri: "jiwa_keswa", psychiatry: "jiwa_keswa", status_psikiatri: "jiwa_keswa", radiology: "rontgen", radiologi: "rontgen", cardiology: "ekg", kardiologi: "ekg" }; return map[key] ?? key; }
export function normalizeSectionStatus(status?: string | null) { const s = (status ?? "").toLowerCase(); if (s === "submitted") return "Submitted"; if (s === "approved") return "Approved"; if (s === "locked") return "Locked"; if (s === "revision") return "Revision"; if (s === "optional") return "Optional"; return "Draft"; }
export function isSectionCompleted(status?: string | null) { return ["Submitted", "Approved", "Locked"].includes(normalizeSectionStatus(status)); }

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
