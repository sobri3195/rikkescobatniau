import { getDb } from "@/lib/localDb";
import { normalizeCandidateName, type ParsedNomorTesRow } from "./parse";

export type MatchConfidence = "high" | "medium" | "low" | "ambiguous" | "not_found";
export type RowStatus =
  | "ready"
  | "need_review"
  | "ambiguous"
  | "not_found"
  | "duplicate_kes"
  | "error"
  | "skipped";

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

export async function loadSelectionCandidatesForMatch(
  selectionId: string,
): Promise<ExistingCandidate[]> {
  const db = getDb() as any;
  const examsByCandidate = new Map(
    (db.exams ?? [])
      .filter((exam: any) => !exam.is_deleted)
      .map((exam: any) => [exam.candidate_id, exam]),
  );
  return (db.candidates ?? [])
    .filter((row: any) => row.selection_id === selectionId && !row.is_deleted && !row.deleted_at)
    .slice(0, 5000)
    .map((row: any): ExistingCandidate => {
      const e: any = examsByCandidate.get(row.id);
      return {
        id: row.id,
        selection_id: row.selection_id,
        full_name: row.full_name,
        birth_place: row.birth_place ?? null,
        birth_date: row.birth_date ?? null,
        temporary_id: row.temporary_id ?? null,
        test_number: row.test_number ?? null,
        test_number_status:
          row.test_number_status ?? (String(row.test_number ?? "").trim() ? "assigned" : "pending"),
        bag_number: row.bag_number ?? null,
        class_group: row.class_group ?? null,
        serial_number: row.serial_number ?? null,
        exam_id: e?.id ?? null,
        hari_h_stage: e?.hari_h_stage ?? null,
        radiology_initial_status: e?.radiology_initial_status ?? null,
        ekg_initial_status: e?.ekg_initial_status ?? null,
        progress_percentage: e?.progress_percentage ?? null,
      };
    });
}

export async function loadAttachmentCounts(
  candidateIds: string[],
): Promise<Map<string, { rad: number; ekg: number }>> {
  const map = new Map<string, { rad: number; ekg: number }>();
  if (!candidateIds.length) return map;
  const ids = new Set(candidateIds);
  const db = getDb() as any;
  for (const a of db.medical_attachments ?? []) {
    const cid = a.candidate_id;
    if (!ids.has(cid)) continue;
    const key = String(a.section_key ?? "").toLowerCase();
    const cur = map.get(cid) ?? { rad: 0, ekg: 0 };
    if (key.includes("radiolog") || key.includes("rontgen")) cur.rad += 1;
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
      arr.push(c);
      byNormName.set(nm, arr);
    }
    if (nm && c.birth_date) {
      const key = `${nm}|${c.birth_date}`;
      const arr = byNormNameDob.get(key) ?? [];
      arr.push(c);
      byNormNameDob.set(key, arr);
    }
  }
  const kesUsed = new Map<string, ExistingCandidate>();
  for (const c of candidates) {
    if (c.test_number && ["Final", "assigned"].includes(c.test_number_status))
      kesUsed.set(c.test_number, c);
  }

  return parsed.map((p): MatchedRow => {
    const counts = (id: string) => attachmentCounts.get(id) ?? { rad: 0, ekg: 0 };

    // Hard errors from parser?
    if (p.errors.length && p.errors.some((e) => e.startsWith("KES"))) {
      return {
        ...p,
        candidate: null,
        candidate_options: [],
        confidence: "not_found",
        status: "error",
        rad_attachments_count: 0,
        ekg_attachments_count: 0,
        conflict_other_kes_holder: null,
      };
    }

    let candidate: ExistingCandidate | null = null;
    let options: ExistingCandidate[] = [];
    let confidence: MatchConfidence = "not_found";

    // 1) normalized_name + birth_date
    if (p.birth_date) {
      const arr = byNormNameDob.get(`${p.normalized_name}|${p.birth_date}`) ?? [];
      if (arr.length === 1) {
        candidate = arr[0];
        confidence = "high";
      } else if (arr.length > 1) {
        options = arr;
        confidence = "ambiguous";
      }
    }

    // 2) normalized_name only (medium if unique)
    if (!candidate && confidence !== "ambiguous") {
      const arr = byNormName.get(p.normalized_name) ?? [];
      if (arr.length === 1) {
        candidate = arr[0];
        confidence = p.birth_date ? "low" : "medium";
      } else if (arr.length > 1) {
        options = arr;
        confidence = "ambiguous";
      }
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
