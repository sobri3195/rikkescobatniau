import { createServerFn } from "@/shims/tanstack-react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  canPatientEdit,
  canDoctorReview,
  canRegistrationEditIdentity,
  canAdminReturnToDraft,
  isPeserta,
  isDokterUmum,
  isAdminLike,
} from "@/lib/permissions/anamnesis-workflow";

const MODULE = "Identitas & Anamnesis";

async function loadFormAndRoles(supabase: any, examId: string, userId: string) {
  const [{ data: form, error: e1 }, { data: rolesData, error: e2 }] = await Promise.all([
    supabase.from("medical_history_forms").select("*").eq("exam_id", examId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);
  const roles = (rolesData ?? []).map((r: any) => r.role as string);
  return { form, roles };
}

async function writeAudit(supabase: any, args: {
  userId: string;
  action: string;
  examId: string;
  candidateId?: string | null;
  before?: any;
  after?: any;
}) {
  await supabase.from("audit_logs").insert({
    user_id: args.userId,
    action: args.action,
    module: MODULE,
    record_id: args.examId,
    candidate_id: args.candidateId ?? null,
    exam_id: args.examId,
    before_data: args.before ?? null,
    after_data: args.after ?? null,
  });
}

async function syncExamSectionStatus(supabase: any, examId: string, status: "Draft" | "Submitted" | "Revision") {
  await supabase
    .from("exam_sections")
    .update({ section_status: status })
    .eq("exam_id", examId)
    .eq("section_key", "anamnesa");
}

/* ============ PESERTA / CASIS ============ */

export const patientSaveDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      examId: z.string().uuid(),
      candidateId: z.string().uuid(),
      data: z.object({
        identity_data_json: z.any().optional(),
        family_history_json: z.any().optional(),
        personal_history_json: z.any().optional(),
        female_health_json: z.any().optional(),
        work_history_json: z.any().optional(),
        followup_questions_json: z.any().optional(),
        other_disease_notes: z.string().max(5000).optional(),
      }),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { form, roles } = await loadFormAndRoles(supabase, data.examId, userId);
    if (!canPatientEdit(form, roles)) throw new Error("Tidak diizinkan menyimpan draft anamnesis pada status ini");

    const payload = {
      ...data.data,
      exam_id: data.examId,
      candidate_id: data.candidateId,
      anamnesis_workflow_status: "Draft Peserta",
      patient_filled_by: userId,
      patient_filled_at: new Date().toISOString(),
      updated_by: userId,
    };
    const { error } = form
      ? await supabase.from("medical_history_forms").update(payload).eq("id", form.id)
      : await supabase.from("medical_history_forms").insert(payload);
    if (error) throw new Error(error.message);
    await writeAudit(supabase, { userId, action: "anamnesis.patient.save_draft", examId: data.examId, candidateId: data.candidateId, after: { status: "Draft Peserta" } });
    return { ok: true };
  });

export const patientSubmitAnamnesis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      examId: z.string().uuid(),
      candidateId: z.string().uuid(),
      signatureUrl: z.string().min(1).max(2048),
      honesty: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.honesty) throw new Error("Pernyataan kejujuran wajib dicentang");
    const { form, roles } = await loadFormAndRoles(supabase, data.examId, userId);
    if (!form) throw new Error("Form anamnesis belum ada — simpan draft terlebih dahulu");
    if (!canPatientEdit(form, roles)) throw new Error("Status saat ini tidak mengizinkan submit");

    const now = new Date().toISOString();
    const { error } = await supabase.from("medical_history_forms").update({
      anamnesis_workflow_status: "Submitted Peserta",
      patient_signature_url: data.signatureUrl,
      patient_signed_at: now,
      patient_submitted_by: userId,
      patient_submitted_at: now,
      honesty_statement_accepted: true,
      candidate_signature_url: data.signatureUrl,
      candidate_signed_at: now,
      submitted_by: userId,
      submitted_at: now,
      status: "Submitted",
      updated_by: userId,
    }).eq("id", form.id);
    if (error) throw new Error(error.message);
    await syncExamSectionStatus(supabase, data.examId, "Submitted");
    await writeAudit(supabase, { userId, action: "anamnesis.patient.submit", examId: data.examId, candidateId: data.candidateId, after: { status: "Submitted Peserta" } });
    return { ok: true };
  });

/* ============ DOKTER UMUM ============ */

const doctorReviewInput = z.object({
  examId: z.string().uuid(),
  candidateId: z.string().uuid(),
  note: z.string().max(5000).optional(),
  resume: z.string().max(5000).optional(),
  recommendation: z.string().max(2000).optional(),
});

async function doctorMutate(
  supabase: any,
  userId: string,
  data: z.infer<typeof doctorReviewInput>,
  patch: Record<string, any>,
  action: string,
) {
  const { form, roles } = await loadFormAndRoles(supabase, data.examId, userId);
  if (!form) throw new Error("Form anamnesis belum ada");
  if (!canDoctorReview(form, roles)) throw new Error("Anda tidak berhak mereview anamnesis ini saat ini");

  const { error } = await supabase.from("medical_history_forms").update({
    ...patch,
    doctor_reviewed_by: userId,
    doctor_reviewed_at: new Date().toISOString(),
    updated_by: userId,
  }).eq("id", form.id);
  if (error) throw new Error(error.message);
  await writeAudit(supabase, { userId, action, examId: data.examId, candidateId: data.candidateId, before: { status: form.anamnesis_workflow_status }, after: patch });
}

export const doctorSetClear = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => doctorReviewInput.parse(input))
  .handler(async ({ data, context }) => {
    await doctorMutate(context.supabase, context.userId, data, {
      anamnesis_workflow_status: "Clear Dokter",
      doctor_review_status: "Clear",
      doctor_review_note: data.note ?? null,
    }, "anamnesis.doctor.set_clear");
    return { ok: true };
  });

export const doctorAddNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => doctorReviewInput.parse(input))
  .handler(async ({ data, context }) => {
    if (!data.note) throw new Error("Catatan dokter wajib diisi");
    await doctorMutate(context.supabase, context.userId, data, {
      anamnesis_workflow_status: "Ada Catatan Dokter",
      doctor_review_status: "With Notes",
      doctor_review_note: data.note,
      doctor_resume: data.resume ?? null,
      doctor_recommendation: data.recommendation ?? null,
    }, "anamnesis.doctor.add_note");
    return { ok: true };
  });

export const doctorRequestClarification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => doctorReviewInput.parse(input))
  .handler(async ({ data, context }) => {
    if (!data.note) throw new Error("Alasan klarifikasi wajib diisi");
    const { supabase, userId } = context;
    await doctorMutate(supabase, userId, data, {
      anamnesis_workflow_status: "Perlu Klarifikasi",
      doctor_review_status: "Needs Clarification",
      clarification_note: data.note,
      clarification_requested_by: userId,
      clarification_requested_at: new Date().toISOString(),
      clarification_resolved_by: null,
      clarification_resolved_at: null,
    }, "anamnesis.doctor.request_clarification");
    await syncExamSectionStatus(supabase, data.examId, "Revision");
    return { ok: true };
  });

export const doctorSubmitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      examId: z.string().uuid(),
      candidateId: z.string().uuid(),
      signatureUrl: z.string().min(1).max(2048),
      examinerName: z.string().min(1).max(255),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { form, roles } = await loadFormAndRoles(supabase, data.examId, userId);
    if (!form) throw new Error("Form belum ada");
    if (!isDokterUmum(roles) && !isAdminLike(roles)) throw new Error("Hanya dokter umum yang dapat menandatangani");
    if (form.anamnesis_workflow_status !== "Clear Dokter" && form.anamnesis_workflow_status !== "Ada Catatan Dokter") {
      throw new Error("Lakukan Set Clear atau Tambah Catatan sebelum menandatangani");
    }
    const now = new Date().toISOString();
    const { error } = await supabase.from("medical_history_forms").update({
      doctor_signature_url: data.signatureUrl,
      doctor_signed_at: now,
      doctor_examiner_name: data.examinerName,
      updated_by: userId,
    }).eq("id", form.id);
    if (error) throw new Error(error.message);
    await syncExamSectionStatus(supabase, data.examId, "Submitted");
    await writeAudit(supabase, { userId, action: "anamnesis.doctor.submit_review", examId: data.examId, candidateId: data.candidateId, after: { signed_at: now } });
    return { ok: true };
  });

/* ============ REGISTRASI ============ */

export const registrationUpdateIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      examId: z.string().uuid(),
      candidateId: z.string().uuid(),
      identity_data_json: z.any(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { form, roles } = await loadFormAndRoles(supabase, data.examId, userId);
    if (!canRegistrationEditIdentity(form, roles)) throw new Error("Tidak diizinkan mengubah identitas pada status ini");
    const payload = {
      identity_data_json: data.identity_data_json,
      exam_id: data.examId,
      candidate_id: data.candidateId,
      updated_by: userId,
    };
    const { error } = form
      ? await supabase.from("medical_history_forms").update(payload).eq("id", form.id)
      : await supabase.from("medical_history_forms").insert({ ...payload, anamnesis_workflow_status: "Draft Peserta" });
    if (error) throw new Error(error.message);
    await writeAudit(supabase, { userId, action: "anamnesis.registration.update_identity", examId: data.examId, candidateId: data.candidateId, after: { identity_data_json: data.identity_data_json } });
    return { ok: true };
  });

/* ============ ADMIN / KEPALA SUB TIM ============ */

export const adminReturnToDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      examId: z.string().uuid(),
      candidateId: z.string().uuid(),
      reason: z.string().min(3).max(2000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { form, roles } = await loadFormAndRoles(supabase, data.examId, userId);
    if (!form) throw new Error("Form belum ada");
    if (!canAdminReturnToDraft(form, roles)) throw new Error("Tidak diizinkan mengembalikan ke draft");
    const now = new Date().toISOString();
    const { error } = await supabase.from("medical_history_forms").update({
      anamnesis_workflow_status: "Draft Peserta",
      doctor_review_status: null,
      doctor_review_note: null,
      doctor_signature_url: null,
      doctor_signed_at: null,
      patient_signature_url: null,
      patient_signed_at: null,
      candidate_signature_url: null,
      candidate_signed_at: null,
      returned_to_draft_by: userId,
      returned_to_draft_at: now,
      return_reason: data.reason,
      status: "Draft",
      updated_by: userId,
    }).eq("id", form.id);
    if (error) throw new Error(error.message);
    await syncExamSectionStatus(supabase, data.examId, "Draft");
    await writeAudit(supabase, { userId, action: "anamnesis.admin.return_to_draft", examId: data.examId, candidateId: data.candidateId, before: { status: form.anamnesis_workflow_status }, after: { status: "Draft Peserta", reason: data.reason } });
    return { ok: true };
  });