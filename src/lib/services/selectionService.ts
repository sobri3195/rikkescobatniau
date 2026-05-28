import {
  generateId,
  getDb,
  getLocalSession,
  nowIso,
  requireLocalSession,
  setDb,
} from "@/lib/localDb";
import { refreshAllDerivedDataLocal, syncSelectionRelationsLocal } from "@/lib/services/syncService";

export function listSelectionsLocal() {
  const db = getDb() as any;

  return (db.selections ?? [])
    .filter((s: any) => !s.is_deleted && s.status !== "deleted")
    .sort((a: any, b: any) => {
      const nameA = a.selection_name ?? a.name ?? "";
      const nameB = b.selection_name ?? b.name ?? "";
      return String(nameA).localeCompare(String(nameB), "id", { sensitivity: "base" });
    });
}

export function listActiveSelectionsLocal() {
  return listSelectionsLocal().filter((s: any) => {
    const status = String(s.status ?? "active").toLowerCase();
    return status === "active" || status === "aktif" || status === "";
  });
}

export function createSelectionLocal(input: any) {
  const db = getDb() as any;
  const session = requireLocalSession();

  if (!["super_admin", "admin", "tester"].includes(session.role)) {
    throw new Error("Akun Anda tidak memiliki izin untuk membuat seleksi.");
  }

  const now = nowIso();

  const selection = {
    id: generateId("sel"),
    name: input.name ?? input.selection_name ?? "Seleksi Baru",
    selection_name: input.selection_name ?? input.name ?? "Seleksi Baru",
    year: input.year ?? input.tahun ?? new Date().getFullYear(),
    year_label: input.year_label ?? String(input.year ?? input.tahun ?? new Date().getFullYear()),
    participant_label: input.participant_label ?? "Calon Peserta",
    institution_header_line_1: input.institution_header_line_1 ?? "",
    institution_header_line_2: input.institution_header_line_2 ?? "",
    report_title: input.report_title ?? "",
    report_subtitle: input.report_subtitle ?? "",
    type: input.type ?? input.selection_type ?? input.category ?? "",
    location: input.location ?? input.lokasi ?? "",
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    status: input.status ?? "active",
    description: input.description ?? "",
    is_default: false,
    is_deleted: false,
    created_by: session.user_id,
    created_by_role: session.role,
    created_at: now,
    updated_at: now,
  };

  db.selections = [...(db.selections ?? []), selection];
  db.audit_logs = [
    ...(db.audit_logs ?? []),
    {
      id: generateId("audit"),
      user_id: session.user_id,
      role: session.role,
      action: "create_selection",
      module: "Master Seleksi",
      selection_id: selection.id,
      before_data_json: null,
      after_data_json: selection,
      created_at: now,
    },
  ];

  setDb(db);
  syncSelectionRelationsLocal(selection.id);
  refreshAllDerivedDataLocal();
  return selection;
}

export function updateSelectionLocal(selectionId: string, patch: any) {
  const db = getDb() as any;
  const session = getLocalSession();
  const now = nowIso();

  const index = (db.selections ?? []).findIndex((s: any) => s.id === selectionId);
  if (index < 0) throw new Error("Seleksi tidak ditemukan di localDb.");

  const before = db.selections[index];
  db.selections[index] = {
    ...before,
    ...patch,
    updated_at: now,
    updated_by: session?.user_id ?? "local_user",
  };

  const updated = db.selections[index];
  db.audit_logs = [
    ...(db.audit_logs ?? []),
    {
      id: generateId("audit"),
      user_id: session?.user_id ?? "local_user",
      role: session?.role ?? "unknown",
      action: "update_selection",
      module: "Master Seleksi",
      selection_id: selectionId,
      before_data_json: before,
      after_data_json: updated,
      created_at: now,
    },
  ];

  setDb(db);
  syncSelectionRelationsLocal(selectionId);
  refreshAllDerivedDataLocal();
  return updated;
}

export function deactivateSelectionLocal(selectionId: string) {
  return updateSelectionLocal(selectionId, { status: "inactive" });
}

export function softDeleteSelectionLocal(selectionId: string) {
  return updateSelectionLocal(selectionId, {
    status: "deleted",
    is_deleted: true,
    deleted_at: nowIso(),
  });
}

export function setDefaultSelectionLocal(selectionId: string) {
  const db = getDb() as any;
  const now = nowIso();

  db.selections = (db.selections ?? []).map((s: any) => ({
    ...s,
    is_default: s.id === selectionId,
    updated_at: s.id === selectionId ? now : s.updated_at,
  }));

  db.settings = {
    ...(db.settings ?? {}),
    active_selection_id: selectionId,
  };

  setDb(db);
  syncSelectionRelationsLocal(selectionId);
  refreshAllDerivedDataLocal();
  return selectionId;
}


export async function listSelections() { return listSelectionsLocal(); }
export async function listActiveSelections() { return listActiveSelectionsLocal(); }
