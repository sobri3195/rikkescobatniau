import {
  generateId,
  getDb,
  getLocalSession,
  isSectionCompleted,
  normalizeSectionKey,
  nowIso,
  saveDb,
} from "@/lib/localDb";
import { buildRekapAplikasiRowLocal } from "@/lib/rekap-aplikasi-local";

const COMPLETED_STATUSES = ["Submitted", "Approved", "Locked", "Selesai", "Finalized"];
const MAIN_SECTION_KEYS = [
  "identitas_anamnesis",
  "screening_hari_h",
  "pemeriksaan_umum",
  "ekg",
  "rontgen",
  "tht",
  "mata_visus",
  "bedah",
  "laboratorium",
  "gigi",
  "jiwa_keswa",
  "resume_rekomendasi",
];
const DEFAULT_SECTIONS = [
  ["identitas_anamnesis", "Identitas & Anamnesis"],
  ["screening_hari_h", "Screening Hari-H"],
  ["pemeriksaan_umum", "Pemeriksaan Umum"],
  ["ekg", "EKG"],
  ["rontgen", "Rontgen"],
  ["tht", "THT"],
  ["mata_visus", "Mata/Visus"],
  ["bedah", "Bedah"],
  ["neurologi", "Neurologi"],
  ["laboratorium", "Laboratorium"],
  ["gigi", "Gigi"],
  ["jiwa_keswa", "Jiwa/Keswa"],
  ["resume_rekomendasi", "Resume & Rekomendasi"],
] as const;
const IDENTITY_FIELDS = [
  "full_name",
  "gender",
  "rank",
  "nrp_nip",
  "unit_position",
  "pok_korp",
  "panda",
  "group_name",
  "birth_place",
  "birth_date",
  "phone",
  "address",
  "test_number",
  "temporary_id",
  "selection_id",
];
const CHILD_TABLES = [
  "medical_history_forms",
  "exam_radiology",
  "exam_cardiology",
  "exam_neurology",
  "exam_laboratory",
  "exam_ent",
  "exam_surgery",
  "exam_eye",
  "exam_dental",
  "exam_psychiatry",
];

type LocalDbChangedCallback = (moduleName: string) => void;
type SyncAllOptions = { auditAction?: string | false; module?: string };

function session() {
  const db = getDb() as any;
  const local = getLocalSession();
  return {
    user_id: local?.user_id ?? db.auth?.current_user_id ?? "system_local",
    role: local?.role ?? db.auth?.current_role ?? "system",
  };
}

function appendAudit(db: any, action: string, payload: Record<string, any> = {}) {
  const s = session();
  db.audit_logs = db.audit_logs ?? [];
  db.audit_logs.push({
    id: generateId("audit"),
    action,
    module: payload.module ?? "localDb_sync",
    selection_id: payload.selection_id ?? null,
    candidate_id: payload.candidate_id ?? null,
    exam_id: payload.exam_id ?? null,
    section_key: payload.section_key ?? null,
    before_data_json: payload.before_data_json ?? null,
    after_data_json: payload.after_data_json ?? null,
    user_id: payload.user_id ?? s.user_id,
    role: payload.role ?? s.role,
    created_at: nowIso(),
  });
}

function isDone(status: any) {
  return COMPLETED_STATUSES.includes(String(status ?? "")) || isSectionCompleted(status);
}

function missingTestNumber(candidate: any) {
  return (
    !String(candidate?.test_number ?? "").trim() ||
    candidate?.test_number_status === "pending" ||
    candidate?.no_test_missing === true
  );
}

function makeTemporaryId(db: any) {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const n = (
    (db.candidates ?? []).filter((c: any) => String(c.temporary_id ?? "").startsWith(`TMP-${ymd}-`))
      .length + 1
  )
    .toString()
    .padStart(4, "0");
  return `TMP-${ymd}-${n}`;
}

function pickIdentity(candidate: any) {
  return Object.fromEntries(IDENTITY_FIELDS.map((field) => [field, candidate?.[field] ?? ""]));
}

function ensureExamSections(db: any, exam: any, candidate: any) {
  db.exam_sections = db.exam_sections ?? [];
  const now = nowIso();
  for (const [section_key, section_label] of DEFAULT_SECTIONS) {
    const canonical = normalizeSectionKey(section_key);
    const exists = db.exam_sections.some(
      (section: any) =>
        section.exam_id === exam.id && normalizeSectionKey(section.section_key) === canonical,
    );
    if (exists) continue;
    db.exam_sections.push({
      id: generateId("section"),
      exam_id: exam.id,
      candidate_id: candidate.id,
      selection_id: candidate.selection_id ?? exam.selection_id ?? null,
      section_key,
      section_label,
      section_status: "Draft",
      is_required: section_key === "neurologi" ? !!db.settings?.neuro_required : true,
      form_data_json: {},
      submitted_at: null,
      submitted_by: null,
      created_at: now,
      updated_at: now,
    });
  }
}

function syncCandidateInDb(db: any, candidateId: string) {
  const candidate = (db.candidates ?? []).find((c: any) => c.id === candidateId);
  if (!candidate) return null;
  const before = JSON.parse(JSON.stringify(candidate));
  const now = nowIso();
  const testNumber = String(candidate.test_number ?? "").trim();
  candidate.test_number = testNumber;
  candidate.test_number_status = testNumber ? "assigned" : "pending";
  candidate.no_test_missing = !testNumber;
  if (!testNumber && !String(candidate.temporary_id ?? "").trim())
    candidate.temporary_id = makeTemporaryId(db);
  if (!candidate.selection_id)
    candidate.selection_id =
      db.settings?.active_selection_id ??
      (db.selections ?? []).find((s: any) => !s.is_deleted)?.id ??
      null;
  candidate.updated_at = candidate.updated_at ?? now;

  db.exams = db.exams ?? [];
  let exam = db.exams.find((e: any) => e.candidate_id === candidate.id && !e.is_deleted);
  if (!exam) {
    exam = {
      id: generateId("exam"),
      candidate_id: candidate.id,
      selection_id: candidate.selection_id ?? null,
      exam_status: "In Progress",
      hari_h_stage: "Menunggu EKG",
      ekg_initial_status: "Belum",
      radiology_initial_status: "Belum",
      progress_percentage: 0,
      progress_completed_count: 0,
      progress_total_count: 0,
      is_deleted: false,
      created_at: now,
      updated_at: now,
    };
    db.exams.push(exam);
    appendAudit(db, "create_exam", {
      module: "localDb_sync",
      candidate_id: candidate.id,
      exam_id: exam.id,
      selection_id: exam.selection_id,
      after_data_json: exam,
    });
  }
  if (exam.selection_id !== candidate.selection_id) {
    const examBefore = { ...exam };
    exam.selection_id = candidate.selection_id ?? null;
    exam.updated_at = now;
    appendAudit(db, "update_candidate", {
      module: "localDb_sync",
      candidate_id: candidate.id,
      exam_id: exam.id,
      selection_id: candidate.selection_id,
      before_data_json: examBefore,
      after_data_json: exam,
    });
  }
  ensureExamSections(db, exam, candidate);

  for (const section of db.exam_sections ?? []) {
    if (section.exam_id !== exam.id) continue;
    section.candidate_id = candidate.id;
    section.selection_id = candidate.selection_id ?? exam.selection_id ?? null;
    section.updated_at = section.updated_at ?? now;
  }

  for (const tableName of CHILD_TABLES) {
    for (const row of db[tableName] ?? []) {
      if (row.exam_id !== exam.id && row.candidate_id !== candidate.id) continue;
      row.exam_id = exam.id;
      row.candidate_id = candidate.id;
      row.selection_id = candidate.selection_id ?? exam.selection_id ?? row.selection_id ?? null;
      if (tableName === "medical_history_forms") {
        row.identity_data_json = { ...(row.identity_data_json ?? {}), ...pickIdentity(candidate) };
      }
      row.updated_at = row.updated_at ?? now;
    }
  }

  if (JSON.stringify(before) !== JSON.stringify(candidate)) {
    appendAudit(
      db,
      testNumber && before.test_number !== testNumber ? "update_test_number" : "update_candidate",
      {
        module: "localDb_sync",
        candidate_id: candidate.id,
        selection_id: candidate.selection_id,
        before_data_json: before,
        after_data_json: candidate,
      },
    );
  }
  return exam;
}

function recalculateProgressInDb(db: any, examId: string) {
  const exam = (db.exams ?? []).find((e: any) => e.id === examId);
  if (!exam) return null;
  const before = {
    progress_completed_count: exam.progress_completed_count,
    progress_total_count: exam.progress_total_count,
    progress_percentage: exam.progress_percentage,
  };
  const sections = (db.exam_sections ?? []).filter(
    (s: any) => s.exam_id === examId && s.is_required !== false,
  );
  const completed = sections.filter((s: any) => isDone(s.section_status)).length;
  exam.progress_total_count = sections.length;
  exam.progress_completed_count = completed;
  exam.progress_percentage = sections.length ? Math.round((completed / sections.length) * 100) : 0;
  exam.updated_at = nowIso();
  if (
    JSON.stringify(before) !==
    JSON.stringify({
      progress_completed_count: exam.progress_completed_count,
      progress_total_count: exam.progress_total_count,
      progress_percentage: exam.progress_percentage,
    })
  ) {
    appendAudit(db, "recalculate_progress", {
      module: "localDb_sync",
      candidate_id: exam.candidate_id,
      exam_id: exam.id,
      selection_id: exam.selection_id,
      before_data_json: before,
      after_data_json: {
        progress_completed_count: exam.progress_completed_count,
        progress_total_count: exam.progress_total_count,
        progress_percentage: exam.progress_percentage,
      },
    });
  }
  return exam;
}

function recalculateStageInDb(db: any, examId: string) {
  const exam = (db.exams ?? []).find((e: any) => e.id === examId);
  if (!exam) return null;
  const before = exam.hari_h_stage;
  const sections = (db.exam_sections ?? []).filter((s: any) => s.exam_id === examId);
  const byKey = (key: string) =>
    sections.find((s: any) => normalizeSectionKey(s.section_key) === normalizeSectionKey(key));
  const ekgDone = isDone(byKey("ekg")?.section_status) || isDone(exam.ekg_initial_status);
  const rontgenDone =
    isDone(byKey("rontgen")?.section_status) || isDone(exam.radiology_initial_status);
  const screeningDone = isDone(byKey("screening_hari_h")?.section_status);
  const subtimKeys = [
    "pemeriksaan_umum",
    "tht",
    "mata_visus",
    "bedah",
    "laboratorium",
    "gigi",
    "jiwa_keswa",
    ...(db.settings?.neuro_required ? ["neurologi"] : []),
  ];
  const subtimDone = subtimKeys.every((key) => isDone(byKey(key)?.section_status));
  const mainDone = MAIN_SECTION_KEYS.filter((key) => key !== "resume_rekomendasi").every((key) => {
    const section = byKey(key);
    return !section || section.is_required === false || isDone(section.section_status);
  });
  const finalResult = String(exam.final_result ?? exam.graduation_decision ?? "").trim();
  const hasFinalResult =
    !!finalResult && !["in progress", "belum", "draft", "-"].includes(finalResult.toLowerCase());
  let stage = exam.hari_h_stage ?? "Screening Hari-H";
  if (String(exam.exam_status ?? "").toLowerCase() === "finalized" || hasFinalResult)
    stage = "Finalized";
  else if (
    String(exam.doctor_review_status ?? "")
      .toLowerCase()
      .includes("pending") ||
    String(exam.exam_status ?? "")
      .toLowerCase()
      .includes("review")
  )
    stage = "Review";
  else if (!ekgDone) stage = "Menunggu EKG";
  else if (!rontgenDone) stage = "Menunggu Rontgen";
  else if (ekgDone && rontgenDone && !screeningDone) stage = "Penunjang Awal Lengkap";
  else if (!screeningDone) stage = "Screening Hari-H";
  else if (!subtimDone) stage = "Pemeriksaan Subtim";
  else if (mainDone) stage = "Review";
  if (stage === "Finalized") exam.exam_status = "Finalized";
  else if (stage === "Review") exam.exam_status = "Review";
  else if (String(exam.exam_status ?? "").toLowerCase() !== "finalized")
    exam.exam_status = "In Progress";
  exam.hari_h_stage = stage;
  exam.ekg_initial_status = ekgDone ? "Selesai" : "Belum";
  exam.radiology_initial_status = rontgenDone ? "Selesai" : "Belum";
  exam.updated_at = nowIso();
  if (before !== stage)
    appendAudit(db, "recalculate_stage", {
      module: "localDb_sync",
      candidate_id: exam.candidate_id,
      exam_id: exam.id,
      selection_id: exam.selection_id,
      before_data_json: { hari_h_stage: before },
      after_data_json: { hari_h_stage: stage },
    });
  return exam;
}

export function emitLocalDbChanged(moduleName = "localDb_changed") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("localDbChanged", { detail: { moduleName } }));
}

export function subscribeLocalDbChanged(callback: LocalDbChangedCallback) {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) =>
    callback((event as CustomEvent)?.detail?.moduleName ?? "localDb_changed");
  window.addEventListener("localDbChanged", handler as EventListener);
  return () => window.removeEventListener("localDbChanged", handler as EventListener);
}

export function syncCandidateRelationsLocal(candidateId: string) {
  const db = getDb() as any;
  const exam = syncCandidateInDb(db, candidateId);
  if (exam) {
    recalculateProgressInDb(db, exam.id);
    recalculateStageInDb(db, exam.id);
  }
  saveDb(db);
  emitLocalDbChanged("candidate_updated");
  return exam;
}

export function syncExamRelationsLocal(examId: string) {
  const db = getDb() as any;
  const exam = (db.exams ?? []).find((e: any) => e.id === examId);
  if (!exam) return null;
  const candidate = (db.candidates ?? []).find((c: any) => c.id === exam.candidate_id);
  if (candidate) syncCandidateInDb(db, candidate.id);
  recalculateProgressInDb(db, examId);
  recalculateStageInDb(db, examId);
  saveDb(db);
  emitLocalDbChanged("exam_updated");
  return exam;
}

export function syncSelectionRelationsLocal(selectionId: string) {
  const db = getDb() as any;
  for (const candidate of db.candidates ?? [])
    if (candidate.selection_id === selectionId || !candidate.selection_id)
      syncCandidateInDb(db, candidate.id);
  for (const exam of db.exams ?? [])
    if (exam.selection_id === selectionId) {
      recalculateProgressInDb(db, exam.id);
      recalculateStageInDb(db, exam.id);
    }
  saveDb(db);
  emitLocalDbChanged("selection_updated");
}

export function syncAllLocalRelations(options: SyncAllOptions = {}) {
  const db = getDb() as any;
  for (const candidate of db.candidates ?? []) syncCandidateInDb(db, candidate.id);
  for (const exam of db.exams ?? []) {
    recalculateProgressInDb(db, exam.id);
    recalculateStageInDb(db, exam.id);
  }
  if (options.auditAction) {
    appendAudit(db, options.auditAction, {
      module: options.module ?? "localDb_sync",
      after_data_json: { synced_at: nowIso() },
    });
  }
  saveDb(db);
  emitLocalDbChanged("all_synced");
  return db;
}

export function recalculateExamProgressLocal(examId: string) {
  const db = getDb() as any;
  const exam = recalculateProgressInDb(db, examId);
  saveDb(db);
  emitLocalDbChanged("progress_updated");
  return exam;
}

export function recalculateHariHStageLocal(examId: string) {
  const db = getDb() as any;
  const exam = recalculateStageInDb(db, examId);
  saveDb(db);
  emitLocalDbChanged("stage_updated");
  return exam;
}

export function buildRekapRowLocal(candidateId: string) {
  const db = getDb() as any;
  const candidate = (db.candidates ?? []).find((c: any) => c.id === candidateId);
  const exam = (db.exams ?? []).find((e: any) => e.candidate_id === candidateId && !e.is_deleted);
  if (!candidate || !exam) return null;
  const row = buildRekapAplikasiRowLocal(candidate.id, exam.id);
  if (!row) return null;
  return {
    ...row,
    selection: (db.selections ?? []).find((s: any) => s.id === candidate.selection_id) ?? null,
    sections: (db.exam_sections ?? []).filter((s: any) => s.exam_id === exam.id),
  };
}

export function rebuildRekapCacheLocal() {
  const db = getDb() as any;
  const rows = (db.candidates ?? [])
    .filter((c: any) => !c.is_deleted)
    .map((c: any) => buildRekapRowLocal(c.id))
    .filter(Boolean);
  db.rekap_aplikasi_rows = rows;
  appendAudit(db, "rebuild_rekap", {
    module: "Rekap Aplikasi Local",
    after_data_json: { total_rows: rows.length },
  });
  saveDb(db);
  emitLocalDbChanged("rekap_rebuilt");
  return rows;
}

export function buildIncompleteDataLocal() {
  const db = getDb() as any;
  const requiredCandidateFields = [
    "full_name",
    "gender",
    "rank",
    "nrp_nip",
    "unit_position",
    "panda",
    "birth_place",
    "birth_date",
  ];
  const rows: any[] = [];
  for (const candidate of db.candidates ?? []) {
    if (candidate.is_deleted) continue;
    const exam = (db.exams ?? []).find(
      (e: any) => e.candidate_id === candidate.id && !e.is_deleted,
    );
    const issues: string[] = [];
    for (const field of requiredCandidateFields)
      if (!String(candidate[field] ?? "").trim()) issues.push(`candidate.${field} kosong`);
    if (!exam) issues.push("candidate tanpa exam");
    if (exam) {
      const sections = (db.exam_sections ?? []).filter((s: any) => s.exam_id === exam.id);
      if (!sections.length) issues.push("exam tanpa section");
      for (const section of sections.filter((s: any) => s.is_required !== false))
        if (!isDone(section.section_status))
          issues.push(`${section.section_label ?? section.section_key} belum submitted/approved`);
      if (
        !isDone(
          sections.find((s: any) => normalizeSectionKey(s.section_key) === "ekg")?.section_status,
        )
      )
        issues.push("EKG belum selesai");
      if (
        !isDone(
          sections.find((s: any) => normalizeSectionKey(s.section_key) === "rontgen")
            ?.section_status,
        )
      )
        issues.push("Rontgen belum selesai");
      if (
        (exam.exam_status === "Finalized" || exam.hari_h_stage === "Finalized") &&
        missingTestNumber(candidate)
      )
        issues.push("no test kosong untuk final");
    }
    if (issues.length)
      rows.push({
        id: `incomplete_${candidate.id}`,
        candidate_id: candidate.id,
        exam_id: exam?.id ?? null,
        selection_id: candidate.selection_id ?? null,
        full_name: candidate.full_name ?? "-",
        issues,
        issue_count: issues.length,
        updated_at: nowIso(),
      });
  }
  db.incomplete_data_rows = rows;
  saveDb(db);
  emitLocalDbChanged("incomplete_data_updated");
  return rows;
}

export function buildDashboardSummaryLocal() {
  const db = getDb() as any;
  const activeSelections = (db.selections ?? []).filter(
    (s: any) =>
      !s.is_deleted &&
      !["deleted", "inactive"].includes(String(s.status ?? "active").toLowerCase()),
  );
  const candidates = (db.candidates ?? []).filter((c: any) => !c.is_deleted && !c.deleted_at);
  const exams = (db.exams ?? []).filter((e: any) => !e.is_deleted && !e.deleted_at);
  const incomplete = buildIncompleteDataLocal();
  const stageCount = (text: string) =>
    exams.filter((e: any) =>
      String(e.hari_h_stage ?? "")
        .toLowerCase()
        .includes(text),
    ).length;
  const summary = {
    totalSelectionsActive: activeSelections.length,
    totalCandidates: candidates.length,
    inProgress: exams.filter((e: any) => String(e.exam_status ?? "").toLowerCase() !== "finalized")
      .length,
    waitingEkg: stageCount("menunggu ekg"),
    waitingRontgen: stageCount("menunggu rontgen"),
    screening: stageCount("screening"),
    subteam: stageCount("subtim"),
    review: exams.filter((e: any) =>
      String(e.hari_h_stage ?? e.exam_status ?? "")
        .toLowerCase()
        .includes("review"),
    ).length,
    finalized: exams.filter((e: any) =>
      String(e.hari_h_stage ?? e.exam_status ?? "")
        .toLowerCase()
        .includes("finalized"),
    ).length,
    incomplete: incomplete.length,
    dataBelumLengkap: incomplete.length,
    updated_at: nowIso(),
  };
  const next = getDb() as any;
  next.dashboard_summary = summary;
  saveDb(next);
  emitLocalDbChanged("dashboard_summary_updated");
  return summary;
}

export function refreshAllDerivedDataLocal() {
  const db = syncAllLocalRelations();
  const rows = (db.candidates ?? [])
    .filter((c: any) => !c.is_deleted)
    .map((c: any) => buildRekapRowLocal(c.id))
    .filter(Boolean);
  const next = getDb() as any;
  next.rekap_aplikasi_rows = rows;
  appendAudit(next, "rebuild_rekap", {
    module: "Rekap Aplikasi Local",
    after_data_json: { total_rows: rows.length },
  });
  saveDb(next);
  buildIncompleteDataLocal();
  const summary = buildDashboardSummaryLocal();
  emitLocalDbChanged("derived_data_refreshed");
  return summary;
}
