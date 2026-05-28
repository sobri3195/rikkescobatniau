import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";

export type BulkRow = {
  rowNumber: number;
  temporary_id: string;
  nrp_nip: string;
  full_name_match: string;
  birth_date_match: string;
  no_test_baru: string;
  catatan: string;
  // resolved on validation
  candidate_id?: string;
  full_name?: string;
  selection_id?: string;
  current_test_number?: string | null;
  matched_by?: "temporary_id" | "nrp_nip" | "name_birth";
  status: "ok" | "warning" | "error";
  message?: string;
};

export type BulkValidationResult = {
  rows: BulkRow[];
  totals: { total: number; ok: number; warning: number; error: number };
};

const TEMPLATE_HEADERS: string[] = [
  "temporary_id",
  "nrp_nip",
  "full_name",
  "birth_date",
  "no_test_baru",
  "catatan",
];

/**
 * Generate a template XLSX file as a Blob for the user to download.
 */
export function buildTemplateBlob(): Blob {
  const ws = XLSX.utils.aoa_to_sheet([
    TEMPLATE_HEADERS,
    ["TMP-20260520-0001", "", "", "", "T-2026-0010", "Diterima susulan"],
    ["", "31234567", "", "", "T-2026-0011", "Cocokkan via NRP"],
    ["", "", "Budi Santoso", "1995-04-12", "T-2026-0012", "Cocokkan via nama+tgl lahir"],
  ]);
  ws["!cols"] = [
    { wch: 22 }, { wch: 18 }, { wch: 28 }, { wch: 14 }, { wch: 18 }, { wch: 40 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Bulk No Test");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/**
 * Parse uploaded file, validate each row against DB, and return a preview list.
 */
export async function parseAndValidate(file: File): Promise<BulkValidationResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("File XLSX kosong");
  const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (aoa.length < 2) throw new Error("File tidak berisi data");

  const header = aoa[0].map((h) => String(h).trim().toLowerCase());
  const iTmp = header.indexOf("temporary_id");
  const iNrp = header.indexOf("nrp_nip");
  const iName = header.indexOf("full_name");
  const iBirth = header.indexOf("birth_date");
  const iNo = header.indexOf("no_test_baru");
  const iCat = header.indexOf("catatan");
  if (iNo < 0 || (iTmp < 0 && iNrp < 0 && (iName < 0 || iBirth < 0))) {
    throw new Error(
      "Kolom wajib tidak ditemukan. Minimal sediakan 'no_test_baru' + salah satu dari: temporary_id, nrp_nip, atau (full_name + birth_date)."
    );
  }

  const rows: BulkRow[] = [];
  const seenInFile = new Map<string, number>(); // no_test_baru -> row number

  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r];
    const tmp = iTmp >= 0 ? String(row[iTmp] ?? "").trim() : "";
    const nrp = iNrp >= 0 ? String(row[iNrp] ?? "").trim() : "";
    const nm = iName >= 0 ? String(row[iName] ?? "").trim() : "";
    const bd = iBirth >= 0 ? normalizeDate(row[iBirth]) : "";
    const no = String(row[iNo] ?? "").trim();
    const cat = iCat >= 0 ? String(row[iCat] ?? "").trim() : "";
    if (!tmp && !nrp && !nm && !bd && !no) continue; // skip empty rows

    const entry: BulkRow = {
      rowNumber: r + 1,
      temporary_id: tmp,
      nrp_nip: nrp,
      full_name_match: nm,
      birth_date_match: bd,
      no_test_baru: no,
      catatan: cat,
      status: "ok",
    };

    if (!tmp && !nrp && !(nm && bd)) {
      entry.status = "error";
      entry.message = "Wajib isi salah satu: temporary_id, nrp_nip, atau (full_name + birth_date)";
      rows.push(entry); continue;
    }
    if (!no) { entry.status = "error"; entry.message = "no_test_baru kosong"; rows.push(entry); continue; }
    if (no.toUpperCase().startsWith("TMP-")) { entry.status = "error"; entry.message = "No Test final tidak boleh diawali TMP-"; rows.push(entry); continue; }
    if (no.length > 64) { entry.status = "error"; entry.message = "No Test terlalu panjang (>64)"; rows.push(entry); continue; }

    if (seenInFile.has(no)) {
      entry.status = "error";
      entry.message = `No Test "${no}" duplikat dengan baris ${seenInFile.get(no)} dalam file`;
      rows.push(entry); continue;
    }
    seenInFile.set(no, r + 1);

    rows.push(entry);
  }

  // Resolve candidates with priority: temporary_id -> nrp_nip -> (name+birth)
  const pending = rows.filter((r) => r.status === "ok");

  // Step 1: by temporary_id
  const tmpIds = Array.from(new Set(pending.filter((r) => r.temporary_id).map((r) => r.temporary_id)));
  const byTmp = new Map<string, any>();
  if (tmpIds.length > 0) {
    const { data } = await supabase
      .from("candidates")
      .select("id, full_name, temporary_id, test_number, selection_id, nrp_nip, birth_date")
      .in("temporary_id", tmpIds)
      .is("deleted_at", null);
    for (const c of data ?? []) byTmp.set((c as any).temporary_id, c);
  }

  // Step 2: by nrp_nip (for rows not yet matched)
  const nrpIds = Array.from(new Set(
    pending.filter((r) => !byTmp.get(r.temporary_id) && r.nrp_nip).map((r) => r.nrp_nip)
  ));
  const byNrp = new Map<string, any[]>();
  if (nrpIds.length > 0) {
    const { data } = await supabase
      .from("candidates")
      .select("id, full_name, temporary_id, test_number, selection_id, nrp_nip, birth_date")
      .in("nrp_nip", nrpIds)
      .is("deleted_at", null);
    for (const c of data ?? []) {
      const k = (c as any).nrp_nip as string;
      const arr = byNrp.get(k) ?? [];
      arr.push(c);
      byNrp.set(k, arr);
    }
  }

  // Step 3: by name+birth (case-insensitive name match, exact birth)
  const nameBirthKeys = Array.from(new Set(
    pending
      .filter((r) => !byTmp.get(r.temporary_id) && !byNrp.get(r.nrp_nip) && r.full_name_match && r.birth_date_match)
      .map((r) => `${r.full_name_match.toLowerCase()}|${r.birth_date_match}`)
  ));
  const byNameBirth = new Map<string, any[]>();
  if (nameBirthKeys.length > 0) {
    const names = Array.from(new Set(pending.map((r) => r.full_name_match).filter(Boolean)));
    const births = Array.from(new Set(pending.map((r) => r.birth_date_match).filter(Boolean)));
    const { data } = await supabase
      .from("candidates")
      .select("id, full_name, temporary_id, test_number, selection_id, nrp_nip, birth_date")
      .in("full_name", names)
      .in("birth_date", births)
      .is("deleted_at", null);
    for (const c of data ?? []) {
      const k = `${String((c as any).full_name).toLowerCase()}|${(c as any).birth_date}`;
      const arr = byNameBirth.get(k) ?? [];
      arr.push(c);
      byNameBirth.set(k, arr);
    }
  }

  for (const r of pending) {
    let c: any = null;
    let via: BulkRow["matched_by"] | undefined;

    if (r.temporary_id && byTmp.get(r.temporary_id)) {
      c = byTmp.get(r.temporary_id);
      via = "temporary_id";
    } else if (r.nrp_nip && byNrp.get(r.nrp_nip)) {
      const arr = byNrp.get(r.nrp_nip)!;
      if (arr.length > 1) {
        r.status = "error";
        r.message = `Ditemukan ${arr.length} peserta dengan NRP/NIP "${r.nrp_nip}" — gunakan temporary_id agar unik`;
        continue;
      }
      c = arr[0];
      via = "nrp_nip";
    } else if (r.full_name_match && r.birth_date_match) {
      const k = `${r.full_name_match.toLowerCase()}|${r.birth_date_match}`;
      const arr = byNameBirth.get(k);
      if (arr && arr.length > 0) {
        if (arr.length > 1) {
          r.status = "error";
          r.message = `Ditemukan ${arr.length} peserta dengan nama+tgl lahir tersebut — gunakan temporary_id atau NRP`;
          continue;
        }
        c = arr[0];
        via = "name_birth";
      }
    }

    if (!c) {
      r.status = "error";
      r.message = "Peserta tidak ditemukan dengan kunci match yang diberikan";
      continue;
    }

    r.candidate_id = c.id;
    r.full_name = c.full_name;
    r.selection_id = c.selection_id;
    r.current_test_number = c.test_number;
    r.matched_by = via;
    if (c.test_number && !c.test_number.startsWith("TMP-")) {
      r.status = "warning";
      r.message = `Peserta sudah punya No Test "${c.test_number}", akan ditimpa (match: ${via})`;
    } else if (via && via !== "temporary_id") {
      r.status = "warning";
      r.message = `Match via ${via} — verifikasi sebelum apply`;
    }
  }

  // Check duplicates against DB per selection
  const okRows = rows.filter((r) => (r.status === "ok" || r.status === "warning") && r.selection_id);
  if (okRows.length > 0) {
    const tns = okRows.map((r) => r.no_test_baru);
    const { data: dups } = await supabase
      .from("candidates")
      .select("id, test_number, selection_id, full_name")
      .in("test_number", tns)
      .is("deleted_at", null);
    const dupSet = new Map<string, any>(); // key: selection_id|test_number
    for (const d of dups ?? []) {
      dupSet.set(`${(d as any).selection_id}|${(d as any).test_number}`, d);
    }
    for (const r of okRows) {
      const key = `${r.selection_id}|${r.no_test_baru}`;
      const d = dupSet.get(key);
      if (d && d.id !== r.candidate_id) {
        r.status = "error";
        r.message = `Konflik: No Test "${r.no_test_baru}" sudah dipakai ${d.full_name} di seleksi yang sama`;
      }
    }
  }

  const totals = {
    total: rows.length,
    ok: rows.filter((r) => r.status === "ok").length,
    warning: rows.filter((r) => r.status === "warning").length,
    error: rows.filter((r) => r.status === "error").length,
  };

  return { rows, totals };
}

function normalizeDate(v: any): string {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF?.parse_date_code?.(v);
    if (d) {
      const mm = String(d.m).padStart(2, "0");
      const dd = String(d.d).padStart(2, "0");
      return `${d.y}-${mm}-${dd}`;
    }
  }
  const s = String(v).trim();
  // Accept YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (ymd) return s;
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s;
}

/**
 * Apply all rows with status ok|warning. Returns counts.
 */
export async function applyBulkUpdate(rows: BulkRow[]): Promise<{ applied: number; failed: number; errors: string[] }> {
  const target = rows.filter((r) => r.status === "ok" || r.status === "warning");
  const errors: string[] = [];
  let applied = 0;
  const { data: u } = await supabase.auth.getUser();
  const now = new Date().toISOString();

  for (const r of target) {
    if (!r.candidate_id) continue;
    const before = { test_number: r.current_test_number };
    const { error } = await supabase
      .from("candidates")
      .update({
        test_number: r.no_test_baru,
        test_number_status: "Final",
        test_number_assigned_at: now,
        test_number_assigned_by: u.user?.id ?? null,
        test_number_notes: r.catatan || null,
      })
      .eq("id", r.candidate_id);
    if (error) {
      errors.push(`Baris ${r.rowNumber} (${r.temporary_id}): ${error.message}`);
      continue;
    }
    await logAudit({
      action: "bulk_set_test_number",
      module: "candidates",
      record_id: r.candidate_id,
      candidate_id: r.candidate_id,
      before,
      after: { test_number: r.no_test_baru, notes: r.catatan || null, source: "xlsx_bulk_upload" },
    });
    applied++;
  }

  return { applied, failed: errors.length, errors };
}