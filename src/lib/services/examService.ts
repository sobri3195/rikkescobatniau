import { supabase } from "@/integrations/supabase/client";
import { getDb } from "@/lib/localDb";
import { isLocalMode } from "@/lib/storage-mode";

export async function listActiveExams() {
  if (isLocalMode) {
    const db = getDb() as any;
    return (db.exams ?? []).filter((exam: any) => exam.exam_status !== "Finalized").map((exam: any) => ({ ...exam, candidates: (db.candidates ?? []).find((c: any) => c.id === exam.candidate_id), medical_history_forms: (() => { const f = (db.medical_history_forms ?? []).find((x: any) => x.exam_id === exam.id); return f ? [f] : []; })() }));
  }
  const { data, error } = await supabase.from("exams").select("id, candidate_id, hari_h_stage, ekg_initial_status, radiology_initial_status, bypass_initial_at, bypass_initial_reviewed_at, exam_status, selection_id, candidates!inner(full_name, rank, nrp_nip, unit_position, test_number, temporary_id), medical_history_forms(anamnesis_workflow_status, patient_signature_url, candidate_signature_url, doctor_signature_url, doctor_signed_at, doctor_review_status)").neq("exam_status", "Finalized").limit(1000);
  if (error) throw error;
  return data ?? [];
}
