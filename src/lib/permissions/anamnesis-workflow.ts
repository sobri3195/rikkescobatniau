// Helpers untuk workflow status anamnesis 4-zona.
// Single source of truth — dipakai UI + server functions.

export type AnamnesisWorkflowStatus =
  | "Draft Peserta"
  | "Submitted Peserta"
  | "Perlu Klarifikasi"
  | "Clear Dokter"
  | "Ada Catatan Dokter"
  | "Locked";

export const ANAMNESIS_STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  "Draft Peserta": { label: "Draft Peserta", variant: "secondary" },
  "Submitted Peserta": { label: "Menunggu Review Dokter", variant: "default" },
  "Perlu Klarifikasi": { label: "Perlu Klarifikasi", variant: "destructive" },
  "Clear Dokter": { label: "Clear", variant: "default" },
  "Ada Catatan Dokter": { label: "Ada Catatan Dokter", variant: "outline" },
  "Locked": { label: "Terkunci", variant: "secondary" },
};

// Alias role: casis = peserta, dokter_umum = dokter
export function normalizeRoles(roles: string[]): string[] {
  const out = new Set(roles);
  if (out.has("casis")) out.add("peserta");
  if (out.has("peserta")) out.add("casis");
  if (out.has("dokter_umum")) out.add("dokter");
  if (out.has("dokter")) out.add("dokter_umum");
  return Array.from(out);
}

export function isPeserta(roles: string[]): boolean {
  const r = normalizeRoles(roles);
  return r.includes("peserta") || r.includes("casis");
}

export function isDokterUmum(roles: string[]): boolean {
  const r = normalizeRoles(roles);
  return r.includes("dokter") || r.includes("dokter_umum");
}

export function isRegistrasi(roles: string[]): boolean {
  return roles.includes("registrasi");
}

export function isAdminLike(roles: string[]): boolean {
  return roles.some((r) => ["super_admin", "admin", "kepala_sub_tim", "tester"].includes(r));
}

// Form sebagian — hanya field yang dibutuhkan helper.
export interface AnamnesisFormLite {
  anamnesis_workflow_status?: string | null;
  patient_signature_url?: string | null;
  candidate_signature_url?: string | null;
  doctor_signature_url?: string | null;
  doctor_review_status?: string | null;
}

export function getAnamnesisStage(form: AnamnesisFormLite | null | undefined): AnamnesisWorkflowStatus {
  return (form?.anamnesis_workflow_status as AnamnesisWorkflowStatus) ?? "Draft Peserta";
}

/** Peserta/casis hanya bisa edit di Draft Peserta atau Perlu Klarifikasi. */
export function canPatientEdit(form: AnamnesisFormLite | null | undefined, roles: string[]): boolean {
  if (!isPeserta(roles) && !isAdminLike(roles)) return false;
  const st = getAnamnesisStage(form);
  return st === "Draft Peserta" || st === "Perlu Klarifikasi";
}

/** Dokter umum bisa review hanya jika sudah Submitted Peserta dan belum Locked. */
export function canDoctorReview(form: AnamnesisFormLite | null | undefined, roles: string[]): boolean {
  if (!isDokterUmum(roles) && !isAdminLike(roles)) return false;
  const st = getAnamnesisStage(form);
  return st === "Submitted Peserta" || st === "Clear Dokter" || st === "Ada Catatan Dokter";
}

/** Registrasi bisa update identitas selama belum Locked. */
export function canRegistrationEditIdentity(form: AnamnesisFormLite | null | undefined, roles: string[]): boolean {
  if (!isRegistrasi(roles) && !isAdminLike(roles)) return false;
  return getAnamnesisStage(form) !== "Locked";
}

/** Admin/kepala sub tim bisa return-to-draft kecuali sudah Locked permanen. */
export function canAdminReturnToDraft(form: AnamnesisFormLite | null | undefined, roles: string[]): boolean {
  if (!isAdminLike(roles)) return false;
  // super_admin can break the Locked status (override); admin/kepala_sub_tim cannot
  if (roles.includes("super_admin")) return true;
  return getAnamnesisStage(form) !== "Locked";
}

/** True jika form siap difinalisasi (untuk FinalizationDialog). */
export function isAnamnesisReadyForFinalization(form: AnamnesisFormLite | null | undefined): boolean {
  const st = getAnamnesisStage(form);
  return (st === "Clear Dokter" || st === "Ada Catatan Dokter" || st === "Locked")
    && !!(form?.patient_signature_url || form?.candidate_signature_url);
}