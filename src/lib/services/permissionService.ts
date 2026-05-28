import { LOCAL_SESSION_KEY } from "@/lib/localDb";

const ALL_SECTIONS = ["identitas_anamnesis","screening_hari_h","pemeriksaan_umum","ekg","rontgen","neurologi","laboratorium","tht","bedah","mata_visus","gigi","jiwa_keswa","resume_rekomendasi"];

export function getLocalSectionPermissions(role: string) {
  const full = role === "super_admin" || role === "admin" || role === "tester";
  return ALL_SECTIONS.map((section_key) => ({ section_key, can_view: true, can_create: full, can_update: full, can_submit: full, can_approve: full, can_request_revision: full, can_upload: full, can_export: full, is_active: true }));
}

export function getLocalSession() {
  try { const raw = localStorage.getItem(LOCAL_SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export async function listSectionAssignments(_userId: string) {
  return getLocalSectionPermissions(getLocalSession()?.role ?? "viewer");
}
