export type SectionWorkflowStatus = "Draft" | "Submitted" | "Revision" | "Approved" | "Finalized";

const COMPLETED_STATUSES = new Set(["Submitted", "Approved", "Locked", "Selesai", "Finalized"]);
const DRAFT_ALIASES = new Set(["", "draft", "belum", "pending", "in progress", "new"]);
const SUBMITTED_ALIASES = new Set(["submitted", "submit", "terkirim", "selesai"]);
const REVISION_ALIASES = new Set([
  "revision",
  "revisi",
  "returned",
  "perlu revisi",
  "dikembalikan",
]);
const APPROVED_ALIASES = new Set(["approved", "approve", "disetujui", "locked"]);
const FINALIZED_ALIASES = new Set(["finalized", "final", "finalisasi"]);

export function normalizeSectionStatus(status?: unknown): SectionWorkflowStatus {
  const raw = String(status ?? "").trim();
  const lower = raw.toLowerCase();
  if (FINALIZED_ALIASES.has(lower)) return "Finalized";
  if (APPROVED_ALIASES.has(lower)) return "Approved";
  if (REVISION_ALIASES.has(lower)) return "Revision";
  if (SUBMITTED_ALIASES.has(lower)) return "Submitted";
  if (DRAFT_ALIASES.has(lower)) return "Draft";
  return "Draft";
}

export function isDraftStatus(status?: unknown) {
  return normalizeSectionStatus(status) === "Draft";
}
export function isSubmittedStatus(status?: unknown) {
  return normalizeSectionStatus(status) === "Submitted";
}
export function isRevisionStatus(status?: unknown) {
  return normalizeSectionStatus(status) === "Revision";
}
export function isApprovedStatus(status?: unknown) {
  return normalizeSectionStatus(status) === "Approved";
}
export function isFinalizedStatus(status?: unknown) {
  return normalizeSectionStatus(status) === "Finalized";
}
export function isCompletedStatus(status?: unknown) {
  const normalized = normalizeSectionStatus(status);
  return COMPLETED_STATUSES.has(normalized) || COMPLETED_STATUSES.has(String(status ?? ""));
}
export function isEditableStatus(status?: unknown) {
  const normalized = normalizeSectionStatus(status);
  return normalized === "Draft" || normalized === "Revision";
}
export function isReviewableStatus(status?: unknown) {
  const normalized = normalizeSectionStatus(status);
  return normalized === "Submitted" || normalized === "Approved";
}

export type ObjectDiffEntry = { field: string; before: any; after: any };

function sortDeep(value: any): any {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortDeep(value[key])]),
  );
}

function stableStringify(value: any) {
  if (value === undefined) return "__undefined__";
  try {
    return JSON.stringify(sortDeep(value));
  } catch {
    return String(value);
  }
}

export function buildObjectDiff(before: any = {}, after: any = {}) {
  const left = before && typeof before === "object" ? before : {};
  const right = after && typeof after === "object" ? after : {};
  const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort();
  const changed_fields: ObjectDiffEntry[] = [];
  for (const field of keys) {
    if (stableStringify(left[field]) !== stableStringify(right[field])) {
      changed_fields.push({ field, before: left[field] ?? null, after: right[field] ?? null });
    }
  }
  return {
    before_data_json: before ?? null,
    after_data_json: after ?? null,
    changed_fields,
  };
}
