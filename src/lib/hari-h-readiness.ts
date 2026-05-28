import { supabase } from "@/integrations/supabase/client";

const CLEARED = new Set(["Submitted", "Approved", "Locked", "Cleared"]);

export interface ReadinessResult {
  ok: boolean;
  missing: string[];
  noTest: boolean;
  ekgCleared: boolean;
  roCleared: boolean;
  candidate?: any;
  exam?: any;
}

/** Re-fetch the freshest exam + candidate state and verify Hari-H gating. */
export async function checkHariHReadiness(
  args: { candidateId?: string; examId?: string },
): Promise<ReadinessResult> {
  let exam: any = null;
  let candidate: any = null;

  if (args.examId) {
    const { data } = await supabase.from("exams").select("*").eq("id", args.examId).maybeSingle();
    exam = data;
    if (exam?.candidate_id) {
      const { data: c } = await supabase
        .from("candidates")
        .select("*")
        .eq("id", exam.candidate_id)
        .maybeSingle();
      candidate = c;
    }
  } else if (args.candidateId) {
    const { data: c } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", args.candidateId)
      .maybeSingle();
    candidate = c;
    const { data: e } = await supabase
      .from("exams")
      .select("*")
      .eq("candidate_id", args.candidateId)
      .maybeSingle();
    exam = e;
  }

  const noTest = !!candidate?.test_number && String(candidate.test_number).trim() !== "";
  const ekgCleared = CLEARED.has(String(exam?.ekg_initial_status ?? ""));
  const roCleared = CLEARED.has(String(exam?.radiology_initial_status ?? ""));

  const missing: string[] = [];
  if (!noTest) missing.push("No Test belum terisi");
  if (!ekgCleared) missing.push("EKG belum Cleared");
  if (!roCleared) missing.push("Rontgen belum Cleared");

  return { ok: missing.length === 0, missing, noTest, ekgCleared, roCleared, candidate, exam };
}