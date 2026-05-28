// One-shot backfill: re-project every previously-submitted rikkes_form_sections
// row into the legacy exam_sections / medical_summary tables used by Rekap
// APLIKASI & Laporan Tahap. Safe to run multiple times (idempotent updates).
import { supabase } from "@/integrations/supabase/client";
import { syncGroupToRekap } from "@/lib/rekap-sync";

export type BackfillProgress = {
  total: number;
  done: number;
  failed: number;
  currentExamId?: string;
};

export async function backfillRekapSync(
  opts: { selectionId?: string | null; onProgress?: (p: BackfillProgress) => void } = {},
): Promise<BackfillProgress> {
  let query = supabase
    .from("rikkes_form_sections")
    .select("id, exam_id, candidate_id, group_key, status, form_data_json")
    .in("status", ["Submitted", "Approved", "Locked"]);
  if (opts.selectionId) {
    // Filter via candidate selection_id requires join — fetch candidate ids first.
    const { data: cs } = await supabase
      .from("candidates")
      .select("id")
      .eq("selection_id", opts.selectionId);
    const ids = (cs ?? []).map((c: any) => c.id);
    if (!ids.length) return { total: 0, done: 0, failed: 0 };
    query = query.in("candidate_id", ids);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{
    exam_id: string;
    candidate_id: string;
    group_key: string;
    status: string;
    form_data_json: any;
  }>;
  const prog: BackfillProgress = { total: rows.length, done: 0, failed: 0 };
  opts.onProgress?.(prog);
  for (const r of rows) {
    prog.currentExamId = r.exam_id;
    try {
      await syncGroupToRekap({
        examId: r.exam_id,
        candidateId: r.candidate_id,
        groupKey: r.group_key,
        status: r.status,
        payload: r.form_data_json,
      });
      prog.done++;
    } catch {
      prog.failed++;
    }
    if (prog.done % 5 === 0) opts.onProgress?.(prog);
  }
  opts.onProgress?.(prog);
  return prog;
}