// Mirror a subteam-form persist into the parent rikkes_form_sections row
// so the RIKKES sidebar (Bagian Formulir) + section header reflect the
// real submission status. Subteam forms write to their own dedicated tables
// (exam_ent, exam_eye_vision, exam_surgery, exam_neurology, exam_lab,
// exam_psychology, exam_dental) and previously left rikkes_form_sections
// stuck at Draft.
//
// Non-throwing: failures are logged but never block the primary submit.

import { supabase } from "@/lib/local-supabase-shim";

export async function syncRikkesGroupStatus(args: {
  examId: string;
  candidateId: string;
  groupKey: string;
  status: string; // 'Draft' | 'Submitted' | 'Approved' | 'Revision' | 'Locked'
  uid?: string;
  revisionReason?: string;
}): Promise<void> {
  const { examId, candidateId, groupKey, status, uid, revisionReason } = args;
  try {
    const { data: existing } = await supabase
      .from("rikkes_form_sections")
      .select("id")
      .eq("exam_id", examId)
      .eq("group_key", groupKey)
      .maybeSingle();

    const base: any = { status, updated_by: uid };
    if (status === "Submitted") {
      base.submitted_by = uid;
      base.submitted_at = new Date().toISOString();
    }
    if (status === "Draft") {
      base.returned_to_draft_by = uid;
      base.returned_to_draft_at = new Date().toISOString();
    }
    if (revisionReason) base.return_reason = revisionReason;

    if (existing?.id) {
      await supabase.from("rikkes_form_sections").update(base).eq("id", existing.id);
    } else {
      await supabase.from("rikkes_form_sections").insert({
        exam_id: examId,
        candidate_id: candidateId,
        group_key: groupKey,
        form_data_json: {},
        created_by: uid,
        ...base,
      });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[sync-rikkes-section] failed", { groupKey, examId }, e);
  }
}