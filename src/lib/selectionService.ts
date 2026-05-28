import {
  generateId,
  getDb,
  getLocalSession,
  listActiveSelectionsLocal,
  listSelectionsLocal,
  nowIso,
  saveDb,
} from "@/lib/localDb";

export type SelectionInput = {
  name: string;
  year_label?: string;
  participant_label?: string;
  institution_header_line_1?: string;
  institution_header_line_2?: string;
  report_title?: string;
  report_subtitle?: string | null;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string;
  [key: string]: unknown;
};

export const isLocalStorageMode = () => true;

export async function listSelections() {
  return listSelectionsLocal();
}

export async function listActiveSelections() {
  return listActiveSelectionsLocal();
}

export async function createSelection(input: SelectionInput) {
  const db = getDb() as any;
  const session = getLocalSession();

  if (!session?.user_id) {
    throw new Error("Session lokal tidak valid. Silakan login ulang.");
  }

  if (!["super_admin", "admin", "tester"].includes(session.role)) {
    throw new Error("Akun Anda tidak memiliki izin membuat seleksi.");
  }

  const now = nowIso();
  const selection = {
    id: generateId("sel"),
    name: (input.name ?? input.selection_name ?? "Seleksi Baru") as string,
    selection_name: (input.selection_name ?? input.name ?? "Seleksi Baru") as string,
    year: (input.year ?? input.tahun ?? input.year_label ?? new Date().getFullYear()) as string | number,
    year_label: (input.year_label ?? input.year ?? "") as string,
    participant_label: (input.participant_label ?? "Calon Pasis") as string,
    type: (input.type ?? input.selection_type ?? input.category ?? "") as string,
    location: (input.location ?? input.lokasi ?? "") as string,
    status: (input.status ?? "active") as string,
    description: (input.description ?? "") as string,
    institution_header_line_1: (input.institution_header_line_1 ?? "") as string,
    institution_header_line_2: (input.institution_header_line_2 ?? "") as string,
    report_title: (input.report_title ?? "") as string,
    report_subtitle: (input.report_subtitle ?? "") as string,
    start_date: (input.start_date ?? null) as string | null,
    end_date: (input.end_date ?? null) as string | null,
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
      action: "create_selection_local",
      module: "Master Seleksi",
      selection_id: selection.id,
      before_data_json: null,
      after_data_json: selection,
      created_at: now,
    },
  ];

  saveDb(db);
  return selection;
}

export async function updateSelection(id: string, patch: Partial<SelectionInput> & Record<string, unknown>) {
  const db = getDb() as any;
  const session = getLocalSession();
  const now = nowIso();
  const idx = (db.selections ?? []).findIndex((x: any) => x.id === id);
  if (idx < 0) throw new Error("Seleksi tidak ditemukan di localDb.");

  const before = db.selections[idx];
  db.selections[idx] = { ...before, ...patch, updated_at: now, updated_by: session?.user_id ?? "local_user" };
  const updated = db.selections[idx];

  db.audit_logs = [
    ...(db.audit_logs ?? []),
    {
      id: generateId("audit"),
      user_id: session?.user_id ?? "local_user",
      role: session?.role ?? "unknown",
      action: "update_selection_local",
      module: "Master Seleksi",
      selection_id: id,
      before_data_json: before,
      after_data_json: updated,
      created_at: now,
    },
  ];

  saveDb(db);
  return updated;
}

export async function deleteSelection(id: string) {
  return updateSelection(id, { status: "deleted", is_deleted: true, deleted_at: nowIso() });
}
