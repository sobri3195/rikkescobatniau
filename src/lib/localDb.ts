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
    medical_history_forms: [],
    exam_radiology: [], exam_cardiology: [], exam_neurology: [], exam_laboratory: [], exam_ent: [], exam_surgery: [], exam_eye: [], exam_dental: [], exam_psychiatry: [],
    medical_attachments: [], notifications: [], user_section_assignments: [],
    audit_logs: [], file_access_logs: [],
    test_number_import_sessions: [], test_number_import_rows: [], bulk_import_sessions: [],
    settings: { neuro_required: false, progress_weights: {}, active_selection_id: null as string | null },
  };
}

export function saveDb(db: LocalDb) { db.meta.updated_at = nowIso(); localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db)); }
export function setDb(db: LocalDb) { saveDb(db); return db; }
export function initLocalDb() { const db = createEmptyDb(); saveDb(db); return db; }
export function getDb(): LocalDb { try { const raw = localStorage.getItem(LOCAL_DB_KEY); if (!raw) return initLocalDb(); return migrateLocalDb(JSON.parse(raw)); } catch { return initLocalDb(); } }
export function resetLocalDb() { return initLocalDb(); }

export function migrateLocalDb(input?: any): LocalDb {
  const db: any = input ?? (() => { try { return JSON.parse(localStorage.getItem(LOCAL_DB_KEY) ?? "null"); } catch { return null; } })() ?? createEmptyDb();
  const base: any = createEmptyDb();
  for (const k of Object.keys(base)) if (db[k] === undefined) db[k] = base[k];
  db.settings = { ...base.settings, ...(db.settings ?? {}) };
  db.candidates = (db.candidates ?? []).map((c: any) => ({ ...c, id: c.id ?? generateId("cand"), is_deleted: c.is_deleted ?? false, test_number: c.test_number ?? "", no_test_missing: c.no_test_missing ?? !String(c.test_number ?? "").trim(), test_number_status: c.test_number_status ?? (String(c.test_number ?? "").trim() ? "assigned" : "pending"), temporary_id: c.temporary_id || (String(c.test_number ?? "").trim() ? "" : `TMP-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${String(Math.floor(Math.random()*9999)+1).padStart(4,"0")}`) }));
  saveDb(db);
  return db;
}

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

export function listSelectionsLocal() {
  const db = getDb() as any;
  return [...(db.selections ?? [])]
    .filter((selection: any) => (selection.status ?? "").toLowerCase() !== "deleted")
    .sort((a: any, b: any) => {
      const nameA = a.selection_name ?? a.name ?? "";
      const nameB = b.selection_name ?? b.name ?? "";
      return String(nameA).localeCompare(String(nameB), "id", { sensitivity: "base" });
    });
}

export function listActiveSelectionsLocal() {
  return listSelectionsLocal().filter((selection: any) => {
    const normalized = (selection.status ?? "Aktif").toLowerCase();
    return normalized === "aktif" || normalized === "active";
  });
}

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



export function getLocalSession() {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(LOCAL_SESSION_KEY);
    return null;
  }
}

export function requireLocalSession() {
  const session = getLocalSession();

  if (!session?.user_id) {
    localStorage.removeItem(LOCAL_SESSION_KEY);
    throw new Error("Session lokal tidak valid. Silakan login ulang.");
  }

  return session;
}

export function isAdminRole(role?: string) {
  return ["super_admin", "admin", "tester"].includes(role ?? "");
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

export function logAuditLocal(action: string, payload: Record<string, any> = {}) {
  const db = getDb();
  db.audit_logs.push({
    id: generateId("audit"),
    user_id: db.auth.current_user_id ?? "system_local",
    role: db.auth.current_role ?? "system",
    action,
    module: "Detail Navigation Local",
    candidate_id: payload.candidate_id ?? null,
    exam_id: payload.exam_id ?? null,
    selection_id: payload.selection_id ?? null,
    route_params_json: payload.route_params_json ?? null,
    lookup_result_json: payload.lookup_result_json ?? null,
    created_at: nowIso(),
  });
  saveDb(db);
}

export function resolveParticipantDetailLocal(params: {
  id?: string | null; candidateId?: string | null; selectionId?: string | null; temporaryId?: string | null; testNumber?: string | null;
}) {
  const db = getDb();
  const id = params.id ?? null;
  let candidate: any = null;
  let exam: any = null;
  let source = "not_found";
  if (id) {
    exam = db.exams.find((e: any) => e.id === id) ?? null;
    if (exam) {
      candidate = db.candidates.find((c: any) => c.id === exam.candidate_id) ?? null;
      source = "exam_id";
    }
  }
  if (!candidate && params.candidateId) {
    candidate = db.candidates.find((c: any) => c.id === params.candidateId) ?? null;
    if (candidate) source = "candidate_id";
  }
  if (!candidate && id) {
    candidate = db.candidates.find((c: any) => c.id === id) ?? null;
    if (candidate) source = "route_id_as_candidate";
  }
  if (!candidate && params.temporaryId) {
    candidate = db.candidates.find((c: any) => c.temporary_id === params.temporaryId) ?? null;
    if (candidate) source = "temporary_id";
  }
  if (!candidate && params.testNumber) {
    candidate = db.candidates.find((c: any) => c.test_number === params.testNumber) ?? null;
    if (candidate) source = "test_number";
  }
  if (!exam && candidate) {
    exam = db.exams.find((e: any) => e.candidate_id === candidate.id && (!params.selectionId || e.selection_id === params.selectionId))
      ?? db.exams.find((e: any) => e.candidate_id === candidate.id)
      ?? null;
  }
  return {
    candidate,
    exam,
    sections: exam ? db.exam_sections.filter((s: any) => s.exam_id === exam.id) : [],
    radiology: exam ? db.exam_radiology.filter((x: any) => x.exam_id === exam.id) : [],
    cardiology: exam ? db.exam_cardiology.filter((x: any) => x.exam_id === exam.id) : [],
    attachments: exam ? db.medical_attachments.filter((x: any) => x.exam_id === exam.id) : [],
    source: candidate ? (exam ? source : "candidate_found_exam_missing") : "not_found",
    error: candidate ? (exam ? null : "EXAM_MISSING") : "PARTICIPANT_NOT_FOUND",
  };
}
