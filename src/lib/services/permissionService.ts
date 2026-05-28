import { supabase } from "@/integrations/supabase/client";
import { LOCAL_SESSION_KEY } from "@/lib/localDb";
import { isLocalMode } from "@/lib/storage-mode";

const ALL_SECTIONS = ["identitas_anamnesis","screening_hari_h","pemeriksaan_umum","ekg","rontgen","neurologi","laboratorium","tht","bedah","mata_visus","gigi","jiwa_keswa","resume_rekomendasi"];

export function getLocalSectionPermissions(role: string) {
  const full = role === "super_admin" || role === "admin" || role === "tester";
  const viewer = role === "viewer";
  return ALL_SECTIONS.map((section_key) => ({ section_key, can_view: true, can_create: full, can_update: full, can_submit: full || !viewer, can_approve: full, can_request_revision: full, can_upload: full || !viewer, can_export: full, is_active: true }));
}

export function getLocalSession() {
  try { const raw = localStorage.getItem(LOCAL_SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export async function listSectionAssignments(userId: string) {
  if (isLocalMode) return getLocalSectionPermissions(getLocalSession()?.role ?? "viewer");
  const { data, error } = await supabase.from("user_section_assignments").select("section_key, can_view, can_create, can_update, can_submit, can_approve, can_request_revision, can_upload, can_export, is_active").eq("user_id", userId).eq("is_active", true);
  if (error) throw error;
  return data ?? [];
}
