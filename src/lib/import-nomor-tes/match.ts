import { supabase } from "@/lib/local-supabase-shim";
import { normalizeCandidateName, type ParsedNomorTesRow } from "./parse";

export type MatchConfidence = "high" | "medium" | "low" | "ambiguous" | "not_found";
export type RowStatus = "ready" | "need_review" | "ambiguous" | "not_found" | "duplicate_kes" | "error" | "skipped";

export type ExistingCandidate = {
  id: string;
  selection_id: string;
  full_name: string;
  birth_place: string | null;
  birth_date: string | null;
  temporary_id: string | null;
  test_number: string | null;
  test_number_status: string;
  bag_number: string | null;
  class_group: string | null;
  serial_number: number | null;
  // From related exam (denormalized)
  exam_id: string | null;
  hari_h_stage: string | null;
  radiology_initial_status: string | null;
  ekg_initial_status: string | null;
  progress_percentage: number | null;
};

export type MatchedRow = ParsedNomorTesRow & {
  candidate: ExistingCandidate | null;
  candidate_options: ExistingCandidate[]; // for ambiguous / manual match
  confidence: MatchConfidence;
  status: RowStatus;
  rad_attachments_count: number;
  ekg_attachments_count: number;
  conflict_other_kes_holder: ExistingCandidate | null;
};

export async function loadSelectionCandidatesForMatch(selectionId: string): Promise<ExistingCandidate[]> {
  const c = await supabase
    .from("candidates")
    .select("id, selection_id, full_name, birth_place, birth_date, temporary_id, test_number, test_number_status, bag_number, class_group, serial_number")
    .eq("selection_id", selectionId)
    .is("deleted_at", null)
    .limit(5000);
  if (c.error) throw c.error;
  const candIds = (c.data ?? []).map((x) => x.id);
  const examMap = new Map<string, { id: string; hari_h_stage: string | null; radiology_initial_status: string | null; ekg_initial_status: string | null; progress_percentage: number | null }>();
  if (candIds.length) {
    const ex = await supabase
      .from("exams")
      .select("id, candidate_id, hari_h_stage, radiology_initial_status, ekg_initial_status, progress_percentage")
      .in("candidate_id", candIds);
    for (const e of ex.data ?? []) examMap.set((e as never as { candidate_id: string }).candidate_id, e as never);
  }
  return (c.data ?? []).map((row): ExistingCandidate => {
    const e = examMap.get(row.id);
    return {
      id: row.id,
      selection_id: row.selection_id,
      full_name: row.full_name,
      birth_place: row.birth_place ?? null,
      birth_date: row.birth_date ?? null,
      temporary_id: row.temporary_id ?? null,
      test_number: row.test_number ?? null,
      test_number_status: row.test_number_status,
      bag_number: row.bag_number ?? null,
      class_group: (row as never as { class_group: string | null }).class_group ?? null,
      serial_number: row.serial_number ?? null,
      exam_id: e?.id ?? null,
      hari_h_stage: e?.hari_h_stage ?? null,
      radiology_initial_status: e?.radiology_initial_status ?? null,
      ekg_initial_status: e?.ekg_initial_status ?? null,
      progress_percentage: e?.progress_percentage ?? null,
    };
  });
}

export async function loadAttachmentCounts(candidateIds: string[]): Promise<Map<string, { rad: number; ekg: number }>> {
  const map = new Map<string, { rad: number; ekg: number }>();
  if (!candidateIds.length) return map;
  const { data } = await supabase
    .from("medical_attachments")
    .select("candidate_id, section_key")
    .in("candidate_id", candidateIds);
  for (const a of data ?? []) {
    const cid = (a as { candidate_id: string }).candidate_id;
    const key = ((a as { section_key: string | null }).section_key ?? "").toLowerCase();
    const cur = map.get(cid) ?? { rad: 0, ekg: 0 };
    if (key.includes("radiolog")) cur.rad += 1;
    if (key.includes("ekg") || key.includes("ergo") || key.includes("cardio")) cur.ekg += 1;
    map.set(cid, cur);
  }
  return map;
}

export function matchRowsAgainstCandidates(
  parsed: ParsedNomorTesRow[],
  candidates: ExistingCandidate[],
  attachmentCounts: Map<string, { rad: number; ekg: number }>,
): MatchedRow[] {
  // Build lookup maps
  const byNormName = new Map<string, ExistingCandidate[]>();
  const byNormNameDob = new Map<string, ExistingCandidate[]>();
  for (const c of candidates) {
    const nm = normalizeCandidateName(c.full_name);
    if (nm) {
      const arr = byNormName.get(nm) ?? [];
      arr.push(c); byNormName.set(nm, arr);
    }
    if (nm && c.birth_date) {
      const key = `${nm}|${c.birth_date}`;
      const arr = byNormNameDob.get(key) ?? [];
      arr.push(c); byNormNameDob.set(key, arr);
    }
  }
  const kesUsed = new Map<string, ExistingCandidate>();
  for (const c of candidates) {
    if (c.test_number && c.test_number_status === "Final") kesUsed.set(c.test_number, c);
  }

  return parsed.map((p): MatchedRow => {
    const counts = (id: string) => attachmentCounts.get(id) ?? { rad: 0, ekg: 0 };

    // Hard errors from parser?
    if (p.errors.length && p.errors.some((e) => e.startsWith("KES"))) {
      return {
        ...p, candidate: null, candidate_options: [],
        confidence: "not_found", status: "error",
        rad_attachments_count: 0, ekg_attachments_count: 0, conflict_other_kes_holder: null,
      };
    }

    let candidate: ExistingCandidate | null = null;
    let options: ExistingCandidate[] = [];
    let confidence: MatchConfidence = "not_found";

    // 1) normalized_name + birth_date
    if (p.birth_date) {
      const arr = byNormNameDob.get(`${p.normalized_name}|${p.birth_date}`) ?? [];
      if (arr.length === 1) { candidate = arr[0]; confidence = "high"; }
      else if (arr.length > 1) { options = arr; confidence = "ambiguous"; }
    }

    // 2) normalized_name only (medium if unique)
    if (!candidate && confidence !== "ambiguous") {
      const arr = byNormName.get(p.normalized_name) ?? [];
      if (arr.length === 1) { candidate = arr[0]; confidence = p.birth_date ? "low" : "medium"; }
      else if (arr.length > 1) { options = arr; confidence = "ambiguous"; }
    }

    // KES conflict (other candidate already using this KES)
    const holder = kesUsed.get(p.kes);
    const conflict = holder && holder.id !== candidate?.id ? holder : null;

    let status: RowStatus;
    if (!p.kes) status = "error";
    else if (conflict) status = "duplicate_kes";
    else if (confidence === "high" || confidence === "medium") status = "ready";
    else if (confidence === "low") status = "need_review";
    else if (confidence === "ambiguous") status = "ambiguous";
    else status = "not_found";

    const counts1 = candidate ? counts(candidate.id) : { rad: 0, ekg: 0 };

    return {
      ...p,
      candidate,
      candidate_options: options,
      confidence,
      status,
      rad_attachments_count: counts1.rad,
      ekg_attachments_count: counts1.ekg,
      conflict_other_kes_holder: conflict ?? null,
    };
  });
}