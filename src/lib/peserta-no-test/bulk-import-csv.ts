import * as XLSX from "xlsx";
import { localDataApi } from "@/lib/localDataApi";
import { logAudit } from "@/lib/audit";
import { createCandidateLocal } from "@/lib/services/candidateService";

export type CsvRow = {
  rowNumber: number;
  full_name: string;
  gender: string;
  rank: string | null;
  nrp_nip: string | null;
  unit_position: string | null;
  pok_korp: string | null;
  panda: string | null;
  group_name: string | null;
  birth_place: string | null;
  birth_date: string | null;
  phone: string | null;
  address: string | null;
  test_number: string | null;
  registration_notes: string | null;
  status: "ok" | "warning" | "error";
  message?: string;
};

export type CsvValidationResult = {
  rows: CsvRow[];
  totals: { total: number; ok: number; warning: number; error: number };
};

const HEADERS = [
  "full_name", "gender", "rank", "nrp_nip", "unit_position", "pok_korp",
  "panda", "group_name", "birth_place", "birth_date", "phone", "address",
  "test_number", "registration_notes",
];

export function buildCsvTemplateBlob(): Blob {
  const sample = [
    "BUDI SANTOSO,L,Letda,123456,Skadik 101,Pasukan,Lanud Halim,A,Jakarta,1995-04-12,081234567890,Jl. Merdeka 1,,Datang langsung",
    "SITI AMINAH,P,,,,,,,Bandung,1996-08-30,,,,Daftar via Panda",
  ];
  const csv = [HEADERS.join(","), ...sample].join("\n");
  return new Blob([csv], { type: "text/csv;charset=utf-8" });
}

function normalizeGender(v: string | null): string {
  const x = (v ?? "").trim().toUpperCase();
  if (["L", "LAKI-LAKI", "LAKI", "MALE", "M", "PRIA"].includes(x)) return "L";
  if (["P", "PEREMPUAN", "WANITA", "FEMALE", "F"].includes(x)) return "P";
  return "";
}

function parseDate(v: string | null): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY or DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

export async function parseCsvAndValidate(file: File, selectionId: string): Promise<CsvValidationResult> {
  const text = await file.text();
  const wb = XLSX.read(text, { type: "string" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: false });

  const rows: CsvRow[] = [];
  const seenTn = new Set<string>();

  // Preload existing test_numbers in this selection
  const { data: existing } = await localDataApi
    .from("candidates")
    .select("test_number")
    .eq("selection_id", selectionId)
    .is("deleted_at", null)
    .not("test_number", "is", null);
  const existingTn = new Set((existing ?? []).map((r: any) => String(r.test_number).trim()).filter(Boolean));

  raw.forEach((r, idx) => {
    const rowNumber = idx + 2; // header = row 1
    const full_name = String(r.full_name ?? "").trim();
    const gender = normalizeGender(String(r.gender ?? "") || "");
    const test_number_raw = String(r.test_number ?? "").trim();
    const tn = test_number_raw && !test_number_raw.toUpperCase().startsWith("TMP-") ? test_number_raw : "";
    const birth_date = parseDate(String(r.birth_date ?? ""));
    const row: CsvRow = {
      rowNumber,
      full_name,
      gender: gender || "L",
      rank: String(r.rank ?? "").trim() || null,
      nrp_nip: String(r.nrp_nip ?? "").trim() || null,
      unit_position: String(r.unit_position ?? "").trim() || null,
      pok_korp: String(r.pok_korp ?? "").trim() || null,
      panda: String(r.panda ?? "").trim() || null,
      group_name: String(r.group_name ?? "").trim() || null,
      birth_place: String(r.birth_place ?? "").trim() || null,
      birth_date,
      phone: String(r.phone ?? "").trim() || null,
      address: String(r.address ?? "").trim() || null,
      test_number: tn || null,
      registration_notes: String(r.registration_notes ?? "").trim() || null,
      status: "ok",
    };

    if (!full_name) { row.status = "error"; row.message = "Nama kosong"; }
    else if (!gender) { row.status = "warning"; row.message = "Gender tidak dikenali, di-default ke L"; }
    else if (tn && existingTn.has(tn)) { row.status = "error"; row.message = `No Test ${tn} sudah ada di seleksi`; }
    else if (tn && seenTn.has(tn)) { row.status = "error"; row.message = `No Test ${tn} duplikat dalam file`; }
    else if (r.birth_date && !birth_date) { row.status = "warning"; row.message = "Tanggal lahir tidak dikenali, akan dikosongkan"; }

    if (tn) seenTn.add(tn);
    rows.push(row);
  });

  const totals = {
    total: rows.length,
    ok: rows.filter((r) => r.status === "ok").length,
    warning: rows.filter((r) => r.status === "warning").length,
    error: rows.filter((r) => r.status === "error").length,
  };
  return { rows, totals };
}

export async function applyCsvImport(rows: CsvRow[], selectionId: string): Promise<{ inserted: number; failed: number; errors: string[] }> {
  const good = rows.filter((r) => r.status !== "error");
  if (good.length === 0) return { inserted: 0, failed: 0, errors: [] };

  const { data: u } = await localDataApi.auth.getUser();
  const uid = u.user?.id ?? null;

  // Create import session for rollback tracking
  const { data: session } = await localDataApi
    .from("import_sessions")
    .insert({
      selection_id: selectionId,
      file_name: `bulk_no_test_${new Date().toISOString().slice(0, 19)}.csv`,
      import_type: "no_test_csv",
      import_strategy: "candidates_only",
      total_rows: good.length,
      status: "Processing",
      started_by: uid,
      started_at: new Date().toISOString(),
    } as never)
    .select("id")
    .single();
  const sessionId = (session as any)?.id ?? null;

  const payload = good.map((r) => ({
    selection_id: selectionId,
    full_name: r.full_name,
    gender: r.gender,
    rank: r.rank,
    nrp_nip: r.nrp_nip,
    unit_position: r.unit_position,
    pok_korp: r.pok_korp,
    panda: r.panda,
    group_name: r.group_name,
    birth_place: r.birth_place,
    birth_date: r.birth_date,
    phone: r.phone,
    address: r.address,
    registration_notes: r.registration_notes,
    test_number: r.test_number,
    test_number_status: r.test_number ? "Final" : "Belum Ada",
    test_number_assigned_at: r.test_number ? new Date().toISOString() : null,
    test_number_assigned_by: r.test_number ? uid : null,
    combined_identity: `${r.full_name} ${r.rank ? `(${r.rank})` : ""} ${r.nrp_nip ?? ""}`.trim(),
    source_import_session_id: sessionId,
  }));

  let inserted = 0;
  let failed = 0;
  const errors: string[] = [];
  payload.forEach((row, idx) => {
    try {
      createCandidateLocal(row);
      inserted += 1;
    } catch (error: any) {
      failed += 1;
      errors.push(`Baris ${idx + 1}: ${error?.message ?? "Gagal membuat kandidat"}`);
    }
  });

  if (sessionId) {
    await localDataApi.from("import_sessions").update({
      success_rows: inserted,
      failed_rows: failed,
      status: failed === 0 ? "Completed" : (inserted > 0 ? "Completed with Errors" : "Error"),
      completed_at: new Date().toISOString(),
    } as never).eq("id", sessionId);
  }

  await logAudit({
    action: "bulk_import_csv_no_test",
    module: "peserta_tanpa_no_test",
    after: { selection_id: selectionId, inserted, failed, total: good.length, import_session_id: sessionId },
  });

  return { inserted, failed, errors };
}
