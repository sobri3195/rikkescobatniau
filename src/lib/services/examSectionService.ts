import {
  DEFAULT_EXAM_SECTIONS,
  generateId,
  getDb,
  getLocalSession,
  nowIso,
  saveDb,
} from "@/lib/localDb";
import { addAuditLogLocal } from "@/lib/services/auditService";
import {
  recalculateExamProgressLocal,
  recalculateHariHStageLocal,
} from "@/lib/services/examService";

const DEFAULT_SECTIONS = DEFAULT_EXAM_SECTIONS;

export function createDefaultExamSectionsLocal(
  examId: string,
  candidateId: string,
  selectionId: string | null | undefined,
) {
  const db = getDb() as any;
  const now = nowIso();
  db.exam_sections = db.exam_sections ?? [];
  for (const [key, label] of DEFAULT_SECTIONS) {
    if (db.exam_sections.some((s: any) => s.exam_id === examId && s.section_key === key)) continue;
    db.exam_sections.push({
      id: generateId("section"),
      exam_id: examId,
      candidate_id: candidateId,
      selection_id: selectionId,
      section_key: key,
      section_label: label,
      section_status: "Draft",
      is_required: key === "neurologi_subtim" ? !!db.settings?.neuro_required : true,
      form_data_json: {},
      submitted_at: null,
      submitted_by: null,
      created_at: now,
      updated_at: now,
    });
  }
  saveDb(db);
}

const MEDICAL_COLLECTION_BY_SECTION: Record<string, string> = {
  identitas_anamnesis: "medical_history_forms",
  penunjang: "exam_radiology",
  ekg: "exam_cardiology",
  tht_subtim: "exam_ent",
  bedah_subtim: "exam_surgery",
  mata_visus_subtim: "exam_eye",
  mata_tht: "exam_eye",
  gigi_odontogram: "exam_dental",
  laboratorium: "exam_laboratory",
  psikologi_subtim: "exam_psychiatry",
  neurologi_subtim: "exam_neurology",
};

function identityPatchFromFormData(data: any) {
  const src = data?.identity_data_json ?? data ?? {};
  const testNumber = String(src.test_number ?? "").trim();
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
  ]) {
    if (src[key] !== undefined) patch[key] = src[key] ?? "";
  }
  if (src.test_number !== undefined) {
    patch.test_number = testNumber;
    patch.test_number_status = testNumber ? "assigned" : "pending";
    patch.no_test_missing = !testNumber;
  }
  return patch;
}

function upsertMedicalCollection(
  db: any,
  exam: any,
  candidate: any,
  sectionKey: string,
  formData: any,
  status: string,
  submittedAt?: string | null,
) {
  const collectionName = MEDICAL_COLLECTION_BY_SECTION[sectionKey];
  if (!collectionName) return;
  db[collectionName] = db[collectionName] ?? [];
  const now = nowIso();
  const index = db[collectionName].findIndex((row: any) => row.exam_id === exam.id);
  const base = {
    exam_id: exam.id,
    candidate_id: candidate?.id ?? exam.candidate_id,
    selection_id: candidate?.selection_id ?? exam.selection_id ?? null,
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

export function persistExamSectionLocal(
  examId: string,
  sectionKey: string,
  formData: any,
  status: "Draft" | "Submitted",
  extra: any = {},
) {
  const db = getDb() as any;
  const now = nowIso();
  const session = getLocalSession();
  const exam = (db.exams ?? []).find((e: any) => e.id === examId && !e.is_deleted);
  if (!exam) throw new Error("Exam tidak ditemukan di localDb.");
  const candidateIndex = (db.candidates ?? []).findIndex(
    (c: any) => c.id === exam.candidate_id && !c.is_deleted,
  );
  if (candidateIndex < 0) throw new Error("Peserta tidak ditemukan di localDb.");
  const candidate = db.candidates[candidateIndex];
  db.exam_sections = db.exam_sections ?? [];
  let row = db.exam_sections.find((s: any) => s.exam_id === examId && s.section_key === sectionKey);
  if (!row) {
    const label = DEFAULT_SECTIONS.find(([key]) => key === sectionKey)?.[1] ?? sectionKey;
    row = {
      id: generateId("section"),
      exam_id: examId,
      candidate_id: candidate.id,
      selection_id: candidate.selection_id ?? null,
      section_key: sectionKey,
      section_label: label,
      created_at: now,
    };
    db.exam_sections.push(row);
  }
  const before = { ...row };
  Object.assign(row, {
    candidate_id: candidate.id,
    selection_id: candidate.selection_id ?? null,
    form_data_json: formData ?? {},
    section_status: status,
    status,
    submitted_at:
      status === "Submitted"
        ? (extra.submitted_at ?? now)
        : status === "Draft"
          ? null
          : (row.submitted_at ?? null),
    submitted_by:
      status === "Submitted"
        ? (extra.submitted_by ?? session?.user_id ?? "local_user")
        : (row.submitted_by ?? null),
    updated_by: session?.user_id ?? "local_user",
    updated_at: now,
    ...extra,
  });

  if (sectionKey === "identitas_anamnesis") {
    const patch = identityPatchFromFormData(formData);
    if (Object.keys(patch).length) {
      const normalizedTestNumber = String(patch.test_number ?? candidate.test_number ?? "").trim();
      db.candidates[candidateIndex] = {
        ...candidate,
        ...patch,
        test_number: normalizedTestNumber,
        test_number_status: normalizedTestNumber ? "assigned" : "pending",
        no_test_missing: !normalizedTestNumber,
        updated_at: now,
        updated_by: session?.user_id ?? "local_user",
      };
    }
  }

  upsertMedicalCollection(
    db,
    exam,
    db.candidates[candidateIndex],
    sectionKey,
    formData,
    status,
    row.submitted_at,
  );
  db.audit_logs = [
    ...(db.audit_logs ?? []),
    {
      id: generateId("audit"),
      user_id: session?.user_id ?? "local_user",
      role: session?.role ?? "unknown",
      action: status === "Submitted" ? "submit_section_local" : "save_draft_section_local",
      module: "RIKKES Detail",
      candidate_id: candidate.id,
      exam_id: examId,
      section_key: sectionKey,
      before_data_json: before,
      after_data_json: row,
      created_at: now,
    },
  ];

  const sections = (db.exam_sections ?? []).filter(
    (s: any) => s.exam_id === examId && s.is_required !== false,
  );
  const completed = sections.filter((s: any) =>
    ["Submitted", "Approved", "Locked", "Selesai"].includes(s.section_status),
  ).length;
  exam.progress_total_count = sections.length;
  exam.progress_completed_count = completed;
  exam.progress_percentage = sections.length ? Math.round((completed / sections.length) * 100) : 0;
  exam.updated_at = now;
  saveDb(db, "persistExamSectionLocal");
  recalculateExamProgressLocal(examId);
  recalculateHariHStageLocal(examId);
  return row;
}

export function updateSectionLocal(examId: string, sectionKey: string, patch: any) {
  const db = getDb() as any;
  const row = (db.exam_sections ?? []).find(
    (s: any) => s.exam_id === examId && s.section_key === sectionKey,
  );
  if (!row) return null;
  Object.assign(row, patch, { updated_at: nowIso() });
  saveDb(db, "updateSectionLocal");
  recalculateExamProgressLocal(examId);
  recalculateHariHStageLocal(examId);
  return row;
}

export function submitSectionLocal(examId: string, sectionKey: string, formData: any) {
  const row = updateSectionLocal(examId, sectionKey, { section_status: "Submitted", form_data_json: formData, submitted_at: nowIso() });
  addAuditLogLocal("submit_section", { exam_id: examId, section_key: sectionKey });
  return row;
}

export function returnSectionToDraftLocal(examId: string, sectionKey: string) {
  const row = updateSectionLocal(examId, sectionKey, {
    section_status: "Draft",
    submitted_at: null,
    submitted_by: null,
  });
  addAuditLogLocal("save_draft_section", { exam_id: examId, section_key: sectionKey });
  return row;
}

export {
  recalculateExamProgressLocal,
  recalculateExamProgressLocal as recalcExamProgressLocal,
  recalculateHariHStageLocal,
};
