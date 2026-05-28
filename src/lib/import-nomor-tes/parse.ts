import * as XLSX from "xlsx";

export type ParsedNomorTesRow = {
  source_sheet_name: string;
  source_row_number: number; // 1-based row in the original sheet
  no: number | null;
  bag: string | null;
  kls: string | null;
  kes: string; // Final Nomor Tes (always string)
  pnd: string | null;
  full_name: string;
  birth_place: string | null;
  birth_date: string | null; // ISO yyyy-mm-dd
  ket: string | null;
  normalized_name: string;
  validation_status: "ok" | "warning" | "error";
  warnings: string[];
  errors: string[];
};

/**
 * Normalize an Indonesian name for matching:
 * - trim
 * - lowercase
 * - remove punctuation like . , - _ ( )
 * - collapse multiple spaces
 * Keeps the main name words intact.
 */
export function normalizeCandidateName(name: string | null | undefined): string {
  if (!name) return "";
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[.,;:_()\[\]'"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDateMaybe(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw === "number") {
    // Excel serial date — XLSX usually returns Date when cellDates true, but safety:
    const ms = Math.round((raw - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
  }
  const s = String(raw).trim();
  if (!s) return null;
  // yyyy-mm-dd
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  // dd-mm-yyyy or dd/mm/yyyy
  const dmy = /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/.exec(s);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function kesToString(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "number") {
    if (Number.isInteger(raw)) return String(raw);
    return String(raw);
  }
  return String(raw).trim();
}

const REQUIRED_HEADERS = ["NO", "BAG", "KLS", "KES", "PND", "NAMA", "TPT LHR", "TGL LHR", "KET"];

function findHeaderRow(rows: unknown[][]): { row: number; map: Record<string, number> } | null {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i] ?? [];
    const upper = row.map((v) => (v == null ? "" : String(v).trim().toUpperCase()));
    const hits = REQUIRED_HEADERS.filter((h) => upper.includes(h));
    if (hits.length >= 6) {
      const map: Record<string, number> = {};
      REQUIRED_HEADERS.forEach((h) => {
        const idx = upper.indexOf(h);
        if (idx >= 0) map[h] = idx;
      });
      return { row: i, map };
    }
  }
  return null;
}

export async function parseNomorTesKesFile(file: File): Promise<{
  rows: ParsedNomorTesRow[];
  sheet_used: string;
  warnings: string[];
}> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });

  // Prefer sheet named KES, else search for sheet containing the required headers.
  let sheetName = wb.SheetNames.find((n) => n.trim().toUpperCase() === "KES") ?? "";
  let headerInfo: { row: number; map: Record<string, number> } | null = null;

  if (sheetName) {
    const data = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: null, blankrows: false });
    headerInfo = findHeaderRow(data as unknown[][]);
  }
  if (!headerInfo) {
    for (const n of wb.SheetNames) {
      const data = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, defval: null, blankrows: false });
      const info = findHeaderRow(data as unknown[][]);
      if (info) { sheetName = n; headerInfo = info; break; }
    }
  }

  if (!sheetName || !headerInfo) {
    throw new Error('File tidak memiliki header NO, BAG, KLS, KES, PND, NAMA, TPT LHR, TGL LHR, KET');
  }

  const sheet = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, blankrows: false }) as unknown[][];

  const { row: headerRow, map } = headerInfo;
  const rows: ParsedNomorTesRow[] = [];
  const warnings: string[] = [];

  // Track duplicate KES within file
  const kesSeen = new Map<string, number[]>();

  for (let i = headerRow + 1; i < data.length; i++) {
    const r = data[i] ?? [];
    // Skip fully blank rows
    if (r.every((v) => v == null || String(v).trim() === "")) continue;

    const noRaw = r[map["NO"]] ?? null;
    const bagRaw = r[map["BAG"]] ?? null;
    const klsRaw = r[map["KLS"]] ?? null;
    const kesRaw = r[map["KES"]] ?? null;
    const pndRaw = r[map["PND"]] ?? null;
    const namaRaw = r[map["NAMA"]] ?? null;
    const tptRaw = r[map["TPT LHR"]] ?? null;
    const tglRaw = r[map["TGL LHR"]] ?? null;
    const ketRaw = r[map["KET"]] ?? null;

    const fullName = namaRaw == null ? "" : String(namaRaw).trim();
    const kes = kesToString(kesRaw);
    const birth = parseDateMaybe(tglRaw);

    const errors: string[] = [];
    const rowWarnings: string[] = [];

    if (!fullName) errors.push("Nama kosong");
    if (!kes) errors.push("KES (Nomor Tes) kosong");
    if (tglRaw && !birth) rowWarnings.push("Tanggal lahir tidak bisa dibaca");

    const noNum = typeof noRaw === "number" ? noRaw : noRaw ? Number(noRaw) || null : null;

    if (kes) {
      const list = kesSeen.get(kes) ?? [];
      list.push(i + 1);
      kesSeen.set(kes, list);
    }

    rows.push({
      source_sheet_name: sheetName,
      source_row_number: i + 1,
      no: noNum,
      bag: bagRaw == null ? null : String(bagRaw).trim() || null,
      kls: klsRaw == null ? null : String(klsRaw).trim() || null,
      kes,
      pnd: pndRaw == null ? null : String(pndRaw).trim() || null,
      full_name: fullName,
      birth_place: tptRaw == null ? null : String(tptRaw).trim() || null,
      birth_date: birth,
      ket: ketRaw == null ? null : String(ketRaw).trim() || null,
      normalized_name: normalizeCandidateName(fullName),
      validation_status: errors.length ? "error" : rowWarnings.length ? "warning" : "ok",
      warnings: rowWarnings,
      errors,
    });
  }

  // Flag duplicates within file
  for (const r of rows) {
    if (!r.kes) continue;
    const occ = kesSeen.get(r.kes) ?? [];
    if (occ.length > 1) {
      r.errors.push(`KES "${r.kes}" duplikat dalam file (baris: ${occ.join(", ")})`);
      r.validation_status = "error";
    }
  }

  return { rows, sheet_used: sheetName, warnings };
}

export function buildKesTemplateCsv(): Blob {
  const csv =
    "NO,BAG,KLS,KES,PND,NAMA,TPT LHR,TGL LHR,KET\n" +
    "1,1,A,7001,IWJ,Contoh Nama Peserta,Jakarta,2006-12-16,Catatan opsional\n" +
    "2,2,A,7002,RHF,Contoh Nama Lain,Bandung,2007-01-04,\n";
  return new Blob([csv], { type: "text/csv;charset=utf-8" });
}