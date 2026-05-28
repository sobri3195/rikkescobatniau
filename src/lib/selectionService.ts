import { supabase } from "@/integrations/supabase/client";
import { generateId, getDb, nowIso, saveDb } from "@/lib/localDb";

export type SelectionInput = {
  name: string;
  year_label: string;
  participant_label: string;
  institution_header_line_1?: string;
  institution_header_line_2?: string;
  report_title?: string;
  report_subtitle?: string | null;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string;
};

export const getStorageMode = () => (import.meta.env.VITE_STORAGE_MODE ?? "supabase").toLowerCase();
export const isLocalStorageMode = () => getStorageMode() === "local";

function getLocalSession() {
  try {
    const raw = localStorage.getItem("rikkes_tni_au_session");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function listSelections() {
  if (isLocalStorageMode()) {
    const db = getDb() as any;
    return [...(db.selections ?? [])].sort((a: any, b: any) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
  }

  const { data, error } = await supabase.from("selections").select("*").order("is_default", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createSelection(input: SelectionInput) {
  const now = nowIso();
  if (isLocalStorageMode()) {
    const db = getDb() as any;
    const session = getLocalSession();
    const selection = {
      id: generateId("sel"),
      ...input,
      status: input.status ?? "Aktif",
      created_by: session?.user_id ?? "local_user",
      created_at: now,
      updated_at: now,
    };
    db.selections = [...(db.selections ?? []), selection];
    db.audit_logs = [...(db.audit_logs ?? []), {
      id: generateId("audit"),
      action: "create_selection_local",
      module: "Selections",
      selection_id: selection.id,
      after_data_json: selection,
      created_at: now,
      user_id: session?.user_id ?? "local_user",
      role: session?.role ?? "local",
    }];
    saveDb(db);
    return selection;
  }

  const { data: authData, error: userError } = await supabase.auth.getUser();
  const user = authData?.user;
  if (userError || !user) throw new Error("User belum login. Tidak bisa membuat seleksi.");

  const payload = {
    ...input,
    status: input.status ?? "Aktif",
    created_by: user.id,
    created_at: now,
    updated_at: now,
  };
  const { data, error } = await supabase.from("selections").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateSelection(id: string, patch: Partial<SelectionInput> & Record<string, unknown>) {
  if (isLocalStorageMode()) {
    const db = getDb() as any;
    const idx = (db.selections ?? []).findIndex((x: any) => x.id === id);
    if (idx < 0) throw new Error("Seleksi tidak ditemukan");
    db.selections[idx] = { ...db.selections[idx], ...patch, updated_at: nowIso() };
    saveDb(db);
    return db.selections[idx];
  }

  const { data, error } = await supabase.from("selections").update({ ...patch, updated_at: nowIso() }).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteSelection(id: string) {
  if (isLocalStorageMode()) {
    const db = getDb() as any;
    db.selections = (db.selections ?? []).filter((x: any) => x.id !== id);
    saveDb(db);
    return;
  }
  const { error } = await supabase.from("selections").delete().eq("id", id);
  if (error) throw error;
}
