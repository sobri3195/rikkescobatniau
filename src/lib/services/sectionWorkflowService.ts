import {
  DEFAULT_EXAM_SECTIONS,
  generateId,
  getDb,
  getLocalSession,
  normalizeSectionKey,
  nowIso,
  saveDb,
} from "@/lib/localDb";
import {
  buildDashboardSummaryLocal,
  buildIncompleteDataLocal,
  emitLocalDbChanged,
  rebuildRekapCacheLocal,
  recalculateExamProgressLocal,
  recalculateHariHStageLocal,
  refreshAllDerivedDataLocal,
} from "@/lib/services/syncService";
import { createNotificationLocal } from "@/lib/services/notificationService";
import {
  validateExamBeforeFinalize,
  validateSectionBeforeSubmit,
} from "@/lib/services/sectionValidationService";
import {
  buildObjectDiff,
  isApprovedStatus,
  normalizeSectionStatus,
  type SectionWorkflowStatus,
} from "@/lib/services/workflowStatusService";

const REVIEWER_ROLES = new Set(["super_admin", "admin", "ketua_tim", "kepala_sub_tim"]);

const SECTION_LABELS: Record<string, string> = Object.fromEntries(DEFAULT_EXAM_SECTIONS as any);
const EXTRA_LABELS: Record<string, string> = {
  pemeriksaan_umum: "Pemeriksaan Umum",
  ekg: "EKG",
  rontgen: "Rontgen / Radiologi",
  tht: "THT",
  bedah: "Bedah",
  mata_visus: "Mata",
  gigi: "Gigi",
  jiwa_keswa: "Keswa",
  neurologi: "Neurologi",
};

const MEDICAL_COLLECTION_BY_SECTION: Record<string, string> = {
  identitas_anamnesis: "medical_history_forms",
  penunjang: "exam_radiology",
  rontgen: "exam_radiology",
  ekg: "exam_cardiology",
  tht_subtim: "exam_ent",
  tht: "exam_ent",
  bedah_subtim: "exam_surgery",
  bedah: "exam_surgery",
  mata_visus_subtim: "exam_eye",
  mata_tht: "exam_eye",
  mata_visus: "exam_eye",
  gigi_odontogram: "exam_dental",
  gigi: "exam_dental",
  laboratorium: "exam_laboratory",
  psikologi_subtim: "exam_psychiatry",
  jiwa_keswa: "exam_psychiatry",
  neurologi_subtim: "exam_neurology",
  neurologi: "exam_neurology",
};

function session(db: any) {
  const local = getLocalSession() as any;
  return {
    user_id: local?.user_id ?? db.auth?.current_user_id ?? "system_local",
    role: local?.role ?? db.auth?.current_role ?? "system",
    name:
      local?.name ??
      (db.users ?? []).find((u: any) => u.id === (local?.user_id ?? db.auth?.current_user_id))
        ?.name ??
      "System Local",
  };
}

function canonical(sectionKey: string) {
  const normalized = normalizeSectionKey(sectionKey);
  const aliases: Record<string, string> = {
    lembar_evaluasi_umum: "pemeriksaan_umum",
    evaluasi_klinis: "pemeriksaan_umum",
    ukuran_lain: "pemeriksaan_umum",
    mata_tht: "mata_visus",
    tht_subtim: "tht",
    mata_visus_subtim: "mata_visus",
    bedah_subtim: "bedah",
    gigi_odontogram: "gigi",
    psikologi_subtim: "jiwa_keswa",
  };
  return aliases[normalized] ?? normalized;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null));
}

function getContext(db: any, examId: string) {
  const exam = (db.exams ?? []).find((e: any) => e.id === examId && !e.is_deleted);
  if (!exam) throw new Error("Exam tidak ditemukan di localDb.");
  const candidate = (db.candidates ?? []).find(
    (c: any) => c.id === exam.candidate_id && !c.is_deleted,
  );
  if (!candidate) throw new Error("Peserta tidak ditemukan di localDb.");
  return { exam, candidate };
}

function ensureSection(db: any, exam: any, candidate: any, sectionKey: string) {
  db.exam_sections = db.exam_sections ?? [];
  const wanted = canonical(sectionKey);
  let section = db.exam_sections.find(
    (s: any) =>
      s.exam_id === exam.id &&
      (s.section_key === sectionKey || canonical(s.section_key) === wanted),
  );
  if (!section) {
    const now = nowIso();
    section = {
      id: generateId("section"),
      exam_id: exam.id,
      candidate_id: candidate.id,
      selection_id: candidate.selection_id ?? exam.selection_id ?? null,
      section_key: sectionKey,
      section_label: SECTION_LABELS[sectionKey] ?? EXTRA_LABELS[wanted] ?? sectionKey,
      section_status: "Draft",
      status: "Draft",
      is_required: wanted !== "neurologi" || !!db.settings?.neuro_required,
      form_data_json: {},
      submitted_at: null,
      submitted_by: null,
      created_at: now,
      updated_at: now,
    };
    db.exam_sections.push(section);
  }
  return section;
}

function identityPatchFromFormData(data: any) {
  const src = data?.identity_data_json ?? data ?? {};
  const patch: any = {};
  for (const key of [
    "full_name",
    "birth_place",
    "birth_date",
    "gender",
    "rank",
    "nrp_nip",
    "unit_position",
    "pok_korp",
    "panda",
    "group_name",
    "phone",
    "address",
    "test_number",
  ]) {
    if (src[key] !== undefined) patch[key] = src[key] ?? "";
  }
  if (src.test_number !== undefined) {
    const testNumber = String(src.test_number ?? "").trim();
    patch.test_number = testNumber;
    patch.test_number_status = testNumber ? "assigned" : "pending";
    patch.no_test_missing = !testNumber;
  }
  return patch;
}

function syncChildCollection(
  db: any,
  exam: any,
  candidate: any,
  sectionKey: string,
  formData: any,
  status: SectionWorkflowStatus,
  submittedAt?: string | null,
) {
  const collectionName =
    MEDICAL_COLLECTION_BY_SECTION[sectionKey] ??
    MEDICAL_COLLECTION_BY_SECTION[canonical(sectionKey)];
  if (!collectionName) return;
  db[collectionName] = db[collectionName] ?? [];
  const now = nowIso();
  const index = db[collectionName].findIndex((row: any) => row.exam_id === exam.id);
  const base: any = {
    exam_id: exam.id,
    candidate_id: candidate.id,
    selection_id: candidate.selection_id ?? exam.selection_id ?? null,
    form_data_json: formData ?? {},
    status,
    section_status: status,
    submitted_at: submittedAt ?? null,
    updated_at: now,
  };
  if (sectionKey === "identitas_anamnesis") {
    Object.assign(base, {
      identity_data_json: formData?.identity_data_json ?? formData ?? {},
      family_history_json: formData?.family_history_json ?? [],
      personal_history_json: formData?.personal_history_json ?? [],
      female_health_json: formData?.female_health_json ?? {},
      work_history_json: formData?.work_history_json ?? {},
      followup_questions_json: formData?.followup_questions_json ?? [],
      honesty_statement_accepted: !!formData?.honesty_statement_accepted,
    });
  }
  if (index >= 0) db[collectionName][index] = { ...db[collectionName][index], ...base };
  else
    db[collectionName].push({
      id: generateId(collectionName.replace(/^exam_|_forms$/g, "med")),
      ...base,
      created_at: now,
    });
}

function appendAudit(db: any, action: string, payload: Record<string, any>) {
  const s = session(db);
  const diff = buildObjectDiff(payload.before_data_json, payload.after_data_json);
  db.audit_logs = db.audit_logs ?? [];
  db.audit_logs.push({
    id: generateId("audit"),
    action,
    module: payload.module ?? "RIKKES Section Workflow",
    selection_id: payload.selection_id ?? null,
    candidate_id: payload.candidate_id ?? null,
    exam_id: payload.exam_id ?? null,
    section_key: payload.section_key ?? null,
    before_data_json: diff.before_data_json,
    after_data_json: diff.after_data_json,
    changed_fields: diff.changed_fields,
    notes: payload.notes ?? null,
    user_id: s.user_id,
    role: s.role,
    created_at: nowIso(),
  });
}

function applySectionMutation(
  action: string,
  examId: string,
  sectionKey: string,
  mutate: (ctx: {
    db: any;
    exam: any;
    candidate: any;
    section: any;
    now: string;
    user: ReturnType<typeof session>;
  }) => void,
  eventName: string,
) {
  const db = getDb() as any;
  const now = nowIso();
  const user = session(db);
  const { exam, candidate } = getContext(db, examId);
  const section = ensureSection(db, exam, candidate, sectionKey);
  const before = clone(section);
  mutate({ db, exam, candidate, section, now, user });
  section.section_status = normalizeSectionStatus(section.section_status);
  section.status = section.section_status;
  section.candidate_id = candidate.id;
  section.selection_id = candidate.selection_id ?? exam.selection_id ?? null;
  section.updated_at = now;
  section.updated_by = user.user_id;
  syncChildCollection(
    db,
    exam,
    candidate,
    section.section_key,
    section.form_data_json,
    section.section_status,
    section.submitted_at,
  );
  appendAudit(db, action, {
    candidate_id: candidate.id,
    exam_id: exam.id,
    selection_id: exam.selection_id ?? candidate.selection_id ?? null,
    section_key: section.section_key,
    before_data_json: before,
    after_data_json: clone(section),
  });
  const latestDb = getDb() as any;
  if ((latestDb.notifications ?? []).length > (db.notifications ?? []).length)
    db.notifications = latestDb.notifications;
  saveDb(db);
  recalculateExamProgressLocal(examId);
  recalculateHariHStageLocal(examId);
  rebuildRekapCacheLocal();
  buildIncompleteDataLocal();
  buildDashboardSummaryLocal();
  refreshAllDerivedDataLocal();
  emitLocalDbChanged(eventName);
  return section;
}

export function saveSectionDraftLocal(examId: string, sectionKey: string, formData: any) {
  return applySectionMutation(
    "save_section_draft",
    examId,
    sectionKey,
    ({ db, candidate, section, now, user }) => {
      const wasApproved = isApprovedStatus(section.section_status);
      section.form_data_json = formData ?? {};
      if (wasApproved) {
        section.previous_approved_at = section.approved_at ?? null;
        section.previous_approved_by = section.approved_by ?? null;
        section.section_status = "Revision";
        section.needs_reapproval = true;
        section.last_revised_at = now;
        section.last_revised_by = user.user_id;
        section.revision_count = Number(section.revision_count ?? 0) + 1;
        appendAudit(db, "section_revised_after_approved", {
          candidate_id: candidate.id,
          exam_id: examId,
          selection_id: section.selection_id,
          section_key: section.section_key,
          before_data_json: {
            approved_at: section.previous_approved_at,
            approved_by: section.previous_approved_by,
          },
          after_data_json: {
            status: "Revision",
            needs_reapproval: true,
            form_data_json: formData ?? {},
          },
        });
      } else {
        section.section_status = "Draft";
      }
      section.submitted_at =
        section.section_status === "Draft" ? null : (section.submitted_at ?? null);
      section.submitted_by =
        section.section_status === "Draft" ? null : (section.submitted_by ?? null);
      if (section.section_key === "identitas_anamnesis") {
        const patch = identityPatchFromFormData(formData);
        Object.assign(candidate, patch, { updated_at: now, updated_by: user.user_id });
      }
    },
    "section_draft_saved",
  );
}

export function submitSectionLocal(examId: string, sectionKey: string, formData: any) {
  const db = getDb() as any;
  const { exam, candidate } = getContext(db, examId);
  const validation = validateSectionBeforeSubmit(sectionKey, formData, candidate, exam);
  if (!validation.valid) {
    createNotificationLocal({
      title: "Data Belum Lengkap",
      body: validation.issues.map((issue) => issue.message).join(", "),
      action: "section_submit_validation_failed",
      candidate_id: candidate.id,
      exam_id: examId,
      section_key: sectionKey,
      data_json: validation.issues,
    });
    throw new Error(
      `Data belum lengkap: ${validation.issues.map((issue) => issue.message).join(", ")}`,
    );
  }
  return applySectionMutation(
    "submit_section",
    examId,
    sectionKey,
    ({ candidate, exam, section, now, user }) => {
      section.form_data_json = formData ?? {};
      section.section_status = "Submitted";
      section.submitted_at = now;
      section.submitted_by = user.user_id;
      section.needs_reapproval = !!section.needs_reapproval;
      if (section.section_key === "identitas_anamnesis")
        Object.assign(candidate, identityPatchFromFormData(formData), {
          updated_at: now,
          updated_by: user.user_id,
        });
      createNotificationLocal({
        title: "Section Submitted",
        body: `${candidate.full_name ?? "Peserta"} - ${section.section_label ?? section.section_key} telah disubmit`,
        action: "section_submitted",
        candidate_id: candidate.id,
        exam_id: exam.id,
        section_key: section.section_key,
      });
    },
    "section_submitted",
  );
}

export function approveSectionLocal(examId: string, sectionKey: string, notes?: string) {
  return applySectionMutation(
    "approve_section",
    examId,
    sectionKey,
    ({ candidate, exam, section, now, user }) => {
      if (!REVIEWER_ROLES.has(user.role))
        throw new Error("Role Anda tidak berwenang approve section.");
      section.section_status = "Approved";
      section.approved_at = now;
      section.approved_by = user.user_id;
      section.approval_notes = notes ?? "";
      section.needs_reapproval = false;
      createNotificationLocal({
        title: "Section Approved",
        body: `${candidate.full_name ?? "Peserta"} - ${section.section_label ?? section.section_key} disetujui`,
        action: "section_approved",
        candidate_id: candidate.id,
        exam_id: exam.id,
        section_key: section.section_key,
      });
    },
    "section_approved",
  );
}

export function requestRevisionSectionLocal(examId: string, sectionKey: string, reason: string) {
  if (!String(reason ?? "").trim()) throw new Error("Alasan revisi wajib diisi.");
  return applySectionMutation(
    "request_section_revision",
    examId,
    sectionKey,
    ({ candidate, exam, section, now, user }) => {
      if (!REVIEWER_ROLES.has(user.role))
        throw new Error("Role Anda tidak berwenang meminta revisi.");
      section.section_status = "Revision";
      section.revision_requested_at = now;
      section.revision_requested_by = user.user_id;
      section.revision_reason = reason;
      section.needs_reapproval = true;
      section.revision_count = Number(section.revision_count ?? 0) + 1;
      createNotificationLocal({
        title: "Section Perlu Revisi",
        body: `${candidate.full_name ?? "Peserta"} - ${section.section_label ?? section.section_key}: ${reason}`,
        action: "section_revision_requested",
        candidate_id: candidate.id,
        exam_id: exam.id,
        section_key: section.section_key,
      });
    },
    "section_revision_requested",
  );
}

export function returnSectionToDraftLocal(examId: string, sectionKey: string) {
  return applySectionMutation(
    "return_section_to_draft",
    examId,
    sectionKey,
    ({ section }) => {
      section.section_status = "Draft";
      section.submitted_at = null;
      section.submitted_by = null;
    },
    "section_returned_to_draft",
  );
}

export function finalizeSectionLocal(examId: string, sectionKey: string) {
  return applySectionMutation(
    "finalize_section",
    examId,
    sectionKey,
    ({ section, now, user }) => {
      section.section_status = "Finalized";
      section.finalized_at = now;
      section.finalized_by = user.user_id;
    },
    "section_finalized",
  );
}

export function finalizeExamLocal(examId: string) {
  const validation = validateExamBeforeFinalize(examId);
  const db = getDb() as any;
  const { exam, candidate } = getContext(db, examId);
  if (!validation.valid) {
    createNotificationLocal({
      title: "Data Belum Lengkap",
      body: validation.issues.map((issue) => issue.message).join(", "),
      action: "exam_finalize_validation_failed",
      candidate_id: candidate.id,
      exam_id: examId,
      data_json: validation.issues,
    });
    return { ok: false, issues: validation.issues };
  }
  const now = nowIso();
  const user = session(db);
  const beforeExam = clone(exam);
  exam.exam_status = "Finalized";
  exam.hari_h_stage = "Finalized";
  exam.finalized_at = now;
  exam.finalized_by = user.user_id;
  exam.updated_at = now;
  for (const section of (db.exam_sections ?? []).filter((s: any) => s.exam_id === examId)) {
    section.previous_status = section.section_status;
    section.section_status = "Finalized";
    section.status = "Finalized";
    section.finalized_at = now;
    section.finalized_by = user.user_id;
    section.updated_at = now;
    section.updated_by = user.user_id;
  }
  appendAudit(db, "finalize_exam", {
    candidate_id: candidate.id,
    exam_id: exam.id,
    selection_id: exam.selection_id ?? candidate.selection_id ?? null,
    section_key: "all",
    before_data_json: beforeExam,
    after_data_json: clone(exam),
  });
  saveDb(db);
  recalculateExamProgressLocal(examId);
  recalculateHariHStageLocal(examId);
  rebuildRekapCacheLocal();
  buildIncompleteDataLocal();
  buildDashboardSummaryLocal();
  refreshAllDerivedDataLocal();
  createNotificationLocal({
    title: "Exam Finalized",
    body: `${candidate.full_name ?? "Peserta"} telah difinalisasi`,
    action: "exam_finalized",
    candidate_id: candidate.id,
    exam_id: exam.id,
  });
  emitLocalDbChanged("exam_finalized");
  return { ok: true, exam };
}
