import { supabase } from "@/integrations/supabase/client";
import {
  generateId,
  getDb,
  getLocalSession,
  isAdminRole,
  listActiveSelectionsLocal,
  listSelectionsLocal,
  nowIso,
  requireLocalSession,
  saveDb,
} from "@/lib/localDb";
import { STORAGE_MODE, isLocalMode } from "@/lib/storage-mode";

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

export const isLocalStorageMode = () => isLocalMode;

export async function listSelections() {
  if (isLocalStorageMode()) {
    return listSelectionsLocal();
  }

  const { data, error } = await supabase.from("selections").select("*").order("is_default", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listActiveSelections() {
  if (isLocalStorageMode()) {
    return listActiveSelectionsLocal();
  }

  const { data, error } = await supabase
    .from("selections")
    .select("*")
    .in("status", ["Aktif", "active"])
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createSelection(input: SelectionInput) {
  const now = nowIso();
  if (isLocalStorageMode()) {
    console.log("Create selection storage mode:", STORAGE_MODE);
    console.log("Create selection local session:", getLocalSession());

    const db = getDb() as any;
    const session = requireLocalSession();

    if (!isAdminRole(session.role)) {
      throw new Error("Akun Anda tidak memiliki izin untuk membuat seleksi.");
    }

    const selection = {
      id: generateId("sel"),
      ...input,
      selection_name: (input as any).selection_name ?? input.name ?? "Seleksi Baru",
      year: (input as any).year ?? input.year_label ?? new Date().getFullYear(),
      type: (input as any).type ?? (input as any).selection_type ?? "",
      status: input.status ?? "Aktif",
      description: (input as any).description ?? "",
      created_by: session.user_id,
      created_by_role: session.role,
      created_at: now,
      updated_at: now,
    };

    db.selections = [...(db.selections ?? []), selection];
    db.audit_logs = [...(db.audit_logs ?? []), {
      id: generateId("audit"),
      action: "create_selection_local",
      module: "Selections",
      selection_id: selection.id,
      before_data_json: null,
      after_data_json: selection,
      created_at: now,
      user_id: session.user_id,
      role: session.role,
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
    const session = requireLocalSession();
    if (!isAdminRole(session.role)) {
      throw new Error("Akun Anda tidak memiliki izin untuk memperbarui seleksi.");
    }
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
    const session = requireLocalSession();
    if (!isAdminRole(session.role)) {
      throw new Error("Akun Anda tidak memiliki izin untuk menghapus seleksi.");
    }
    db.selections = (db.selections ?? []).filter((x: any) => x.id !== id);
    saveDb(db);
    return;
  }
  const { error } = await supabase.from("selections").delete().eq("id", id);
  if (error) throw error;
}
