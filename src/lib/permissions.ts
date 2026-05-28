// Phase 6: centralized role/permission helpers.
// UI-level checks. DB RLS is the enforced backstop.

export type Role =
  | "super_admin"
  | "admin"
  | "kepala_sub_tim"
  | "dokter"
  | "dokter_umum"
  | "dokter_spesialis"
  | "dokter_gigi"
  | "radiologi"
  | "lab"
  | "tester"
  | "registrasi"
  | "peserta"
  | "casis"
  | "viewer"
  | "pimpinan_viewer";

/** Role read-only pimpinan (Dirbindukkes, Kapuskesau). */
export const PIMPINAN_VIEWER_ROLES: readonly string[] = ["pimpinan_viewer"];

export function isPimpinanViewer(roles: string[]): boolean {
  return roles.some((r) => PIMPINAN_VIEWER_ROLES.includes(r));
}

const ANY = (roles: string[], allow: Role[]) =>
  allow.some((r) => roles.includes(r));

export const can = {
  finalizeExam: (roles: string[]) =>
    ANY(roles, ["super_admin", "admin", "kepala_sub_tim"]),
  unlockExam: (roles: string[]) => ANY(roles, ["super_admin"]),
  editCandidate: (roles: string[]) =>
    ANY(roles, ["super_admin", "admin", "registrasi"]),
  editMedical: (roles: string[]) =>
    ANY(roles, ["super_admin", "admin", "dokter", "kepala_sub_tim"]),
  approveSection: (roles: string[]) =>
    ANY(roles, ["super_admin", "admin", "kepala_sub_tim"]),
  exportDocs: (roles: string[]) =>
    ANY(roles, ["super_admin", "admin", "kepala_sub_tim", "dokter"]),
  viewAudit: (roles: string[]) => ANY(roles, ["super_admin", "viewer"]),
  manageUsers: (roles: string[]) => ANY(roles, ["super_admin"]),
  // Phase 8: Template & Formula config
  viewFormulaConfig: (roles: string[]) =>
    ANY(roles, ["super_admin", "admin", "viewer"]),
  editFormulaDraft: (roles: string[]) =>
    ANY(roles, ["super_admin", "admin"]),
  activateFormula: (roles: string[]) => ANY(roles, ["super_admin"]),
  applyFormulaToSelection: (roles: string[]) => ANY(roles, ["super_admin"]),
  recalculateFinalized: (roles: string[]) => ANY(roles, ["super_admin"]),
  viewTemplateBuilder: (roles: string[]) =>
    ANY(roles, ["super_admin", "admin", "viewer"]),
  editTemplateDraft: (roles: string[]) =>
    ANY(roles, ["super_admin", "admin"]),
  activateTemplate: (roles: string[]) => ANY(roles, ["super_admin"]),
  // Phase 9: QA / UAT / Go-Live
  viewQA: (roles: string[]) =>
    ANY(roles, ["super_admin", "admin", "kepala_sub_tim", "dokter", "registrasi", "viewer"]),
  manageQA: (roles: string[]) =>
    ANY(roles, ["super_admin", "admin"]),
  runTest: (roles: string[]) =>
    ANY(roles, ["super_admin", "admin", "kepala_sub_tim", "dokter", "registrasi"]),
  manageIssue: (roles: string[]) =>
    ANY(roles, ["super_admin", "admin", "kepala_sub_tim", "dokter", "registrasi"]),
  signOffUAT: (roles: string[]) =>
    ANY(roles, ["super_admin", "admin", "kepala_sub_tim"]),
  overrideSignOffBlocker: (roles: string[]) => ANY(roles, ["super_admin"]),
  manageGoLive: (roles: string[]) =>
    ANY(roles, ["super_admin", "admin"]),
  approveGoLive: (roles: string[]) => ANY(roles, ["super_admin"]),
  // Phase 10: Documentation, SOP, Training, Handover
  viewDocs: (_roles: string[]) => true,
  manageDocs: (roles: string[]) => ANY(roles, ["super_admin", "admin"]),
  editSOP: (roles: string[]) =>
    ANY(roles, ["super_admin", "admin", "kepala_sub_tim"]),
  approveSOP: (roles: string[]) =>
    ANY(roles, ["super_admin", "kepala_sub_tim"]),
  publishRelease: (roles: string[]) => ANY(roles, ["super_admin", "admin"]),
  manageHandover: (roles: string[]) => ANY(roles, ["super_admin", "admin"]),
  manageChecklist: (roles: string[]) =>
    ANY(roles, ["super_admin", "admin", "kepala_sub_tim"]),
  // Hari-H RIKKES
  inputEKG: (roles: string[]) =>
    ANY(roles, ["super_admin", "admin", "dokter", "kepala_sub_tim"]),
  inputRadiology: (roles: string[]) =>
    ANY(roles, ["super_admin", "admin", "dokter", "kepala_sub_tim"]),
  bypassInitialSupporting: (roles: string[]) =>
    ANY(roles, ["super_admin", "admin"]),
  reviewBypassInitial: (roles: string[]) =>
    ANY(roles, ["super_admin", "admin", "kepala_sub_tim"]),
  manageHariHSettings: (roles: string[]) => ANY(roles, ["super_admin"]),
  viewHariHQueue: (roles: string[]) =>
    ANY(roles, ["super_admin", "admin", "dokter", "dokter_umum", "dokter_spesialis", "dokter_gigi", "radiologi", "lab", "kepala_sub_tim", "registrasi", "viewer", "tester"]),
};

export function isExamLocked(examStatus?: string | null): boolean {
  return examStatus === "Finalized";
}

export function isSectionLocked(
  sectionStatus?: string | null,
  examStatus?: string | null,
): boolean {
  if (isExamLocked(examStatus)) return true;
  return sectionStatus === "Locked" || sectionStatus === "Approved";
}