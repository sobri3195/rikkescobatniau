import { supabase } from "@/integrations/supabase/client";
import { downloadCandidateResumePdf, type ResumeSection } from "./candidate-resume-pdf";

export async function downloadCandidateResumeById(candidateId: string): Promise<void> {
  const { data: cand, error: ce } = await supabase
    .from("candidates")
    .select("id,selection_id,test_number,full_name,rank,nrp_nip,pok_korp,panda,generation,unit_position,birth_place,birth_date,gender")
    .eq("id", candidateId)
    .maybeSingle();
  if (ce || !cand) throw new Error(ce?.message ?? "Peserta tidak ditemukan");

  const [ex, sel] = await Promise.all([
    supabase.from("exams").select("id,exam_status,progress_percentage,kesum_classification,keswa_status,final_result,final_score,finalized_at").eq("candidate_id", candidateId).maybeSingle(),
    supabase.from("selections").select("name,year_label,institution_header_line_1,institution_header_line_2").eq("id", cand.selection_id).maybeSingle(),
  ]);
  const exam = ex.data ?? null;

  let mm = null; let ms = null; let sections: ResumeSection[] = [];
  if (exam) {
    const [m, s, secs] = await Promise.all([
      supabase.from("medical_measurements").select("height_cm,weight_kg,bmi,bmi_classification,chest_or_waist_lp,min_ideal_weight,max_ideal_weight").eq("exam_id", exam.id).maybeSingle(),
      supabase.from("medical_summary").select("count_b,count_c,count_k1,count_k2,k1_notes,k2_notes,attention_notes,parade_notes,suggestions,initial_result,after_parade_result,rakor_result,pra_pantukhir_result").eq("exam_id", exam.id).maybeSingle(),
      supabase.from("exam_sections").select("section_key,section_name,classification,findings,notes").eq("exam_id", exam.id),
    ]);
    mm = m.data ?? null;
    ms = s.data ?? null;
    sections = (secs.data ?? []) as ResumeSection[];
  }

  downloadCandidateResumePdf({
    candidate: cand,
    exam,
    mm,
    ms,
    sections,
    header: {
      line1: sel.data?.institution_header_line_1 ?? null,
      line2: sel.data?.institution_header_line_2 ?? null,
      selectionLabel: sel.data ? `${sel.data.name} — ${sel.data.year_label}` : null,
    },
  });
}