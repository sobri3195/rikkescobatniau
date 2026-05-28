import type { RikkesGroupKey } from "./rikkes-form-groups";

/**
 * Section formulir RIKKES yang boleh diakses (view + edit) per role.
 * Role yang tidak terdaftar di sini → akses penuh ditentukan oleh ALL_GROUPS_ROLES.
 */
const ALL_GROUPS_ROLES = new Set([
  "super_admin",
  "admin",
  "tester",
  "kepala_sub_tim",
  "dokter", // legacy generic
  "registrasi",
  "viewer",
  "pimpinan_viewer",
]);

const READ_ONLY_ROLES = new Set(["viewer", "pimpinan_viewer"]);

/**
 * True jika user hanya boleh melihat data peserta (tanpa edit/submit/return).
 * Berlaku jika SEMUA role aktif user ada di daftar read-only.
 */
export function isReadOnlyViewer(roles: string[]): boolean {
  if (!roles || roles.length === 0) return false;
  return roles.every((r) => READ_ONLY_ROLES.has(r));
}

const ROLE_GROUPS: Record<string, RikkesGroupKey[]> = {
  dokter_umum: [
    "identitas_anamnesis",
    "screening_hari_h",
    "lembar_evaluasi_umum",
  ],
  dokter_gigi: ["gigi_odontogram"],
  radiologi: ["penunjang"],
  lab: ["laboratorium"],
  dokter_spesialis: [
    "evaluasi_klinis",
    "mata_tht",
    "tht_subtim",
    "mata_visus_subtim",
    "bedah_subtim",
    "neurologi_subtim",
    "psikologi_subtim",
  ],
};

export function allowedRikkesGroups(roles: string[]): Set<RikkesGroupKey> | "all" {
  if (!roles || roles.length === 0) return new Set();
  if (roles.some((r) => ALL_GROUPS_ROLES.has(r))) return "all";
  const allowed = new Set<RikkesGroupKey>();
  for (const r of roles) {
    const groups = ROLE_GROUPS[r];
    if (groups) groups.forEach((g) => allowed.add(g));
  }
  return allowed;
}

export function canAccessRikkesGroup(
  roles: string[],
  groupKey: RikkesGroupKey,
): boolean {
  const allowed = allowedRikkesGroups(roles);
  return allowed === "all" || allowed.has(groupKey);
}

export function isRestrictedDokterUmum(roles: string[]): boolean {
  if (!roles || roles.length === 0) return false;
  if (roles.some((r) => ALL_GROUPS_ROLES.has(r))) return false;
  return roles.includes("dokter_umum");
}