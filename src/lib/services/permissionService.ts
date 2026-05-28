import { LOCAL_SESSION_KEY, getDb, saveDb, generateId, nowIso } from "@/lib/localDb";

const ALL_SECTIONS = ["identitas_anamnesis","screening_hari_h","pemeriksaan_umum","ekg","rontgen","neurologi","laboratorium","tht","bedah","mata_visus","gigi","jiwa_keswa","resume_rekomendasi"];

export function getLocalSectionPermissions(role: string) {
  const full = role === "super_admin" || role === "admin" || role === "tester";
  return ALL_SECTIONS.map((section_key) => ({ section_key, can_view: true, can_create: full, can_update: full, can_submit: full, can_approve: full, can_request_revision: full, can_upload: full, can_export: full, is_active: true }));
}

export function getLocalSession() {
  try { const raw = localStorage.getItem(LOCAL_SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export async function listSectionAssignments(_userId: string) {
  const db = getDb() as any;
  const rows = (db.user_section_assignments ?? []).filter((r: any) => r.user_id === _userId && r.is_active !== false);
  if (rows.length) return rows;
  return getLocalSectionPermissions(getLocalSession()?.role ?? "viewer");
}

export async function replaceSectionAssignments(userId: string, assignments: any[]) {
  const db = getDb() as any;
  db.user_section_assignments = (db.user_section_assignments ?? []).filter((r: any) => r.user_id !== userId);
  db.user_section_assignments.push(...assignments.map((a) => ({ id: generateId("usa"), created_at: nowIso(), ...a })));
  saveDb(db);
}

export async function listUserRoles(userId: string) {
  const db = getDb() as any;
  const rows = (db.user_roles ?? []).filter((r: any) => r.user_id === userId);
  return rows.map((r: any) => r.role);
}

export async function listRolePermissions(roles: string[]) {
  const db = getDb() as any;
  return (db.role_permissions ?? []).filter((r: any) => roles.includes(r.role) && r.allowed);
}
