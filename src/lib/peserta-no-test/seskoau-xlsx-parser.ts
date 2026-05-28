import * as XLSX from "xlsx";

export type ImportedCandidateRow = {
  source_sheet_name: string;
  source_row_number: number;
  no_urt: string | null;
  bag_number: string | null;
  pok_group: string | null;
  full_name: string;
  rank: string | null;
  corps: string | null;
  nrp_nip: string | null;
  dikma_diktuk: string | null;
  generation: string | null;
  unit_position: string | null;
  tmt_jabatan: string | null; // ISO yyyy-mm-dd
  birth_date: string | null;  // ISO yyyy-mm-dd
  age_text: string | null;
  notes: string | null;
  combined_identity: string;
  temporary_id_preview: string;
  validation_status: "Ready" | "Warning" | "Error" | "Duplicate" | "Skipped";
  validation_errors: string[];
  validation_warnings: string[];
  // raw kept for error report
  raw_identity: string;
  raw_jabatan: string;
  raw_birth: string;
};

export type SeskoauParseResult = {
  source_format: "SESKOAU_DAFTAR_KELOMPOK_XLSX" | "UNKNOWN";
  sheet_name: string;
  detected_title: string | null;
  detected_selection_name: string | null;
  detected_year_label: string | null;
  rows: ImportedCandidateRow[];
  totals: { total: number; ready: number; warning: number; error: number };
};

const DATE_RE = /\b(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})\b/;
const POK_RE = /^\s*POK\s+([A-Z0-9]+)\s*$/i;

function isoDate(s: string | null): string | null {
  if (!s) return null;
  const m = String(s).match(DATE_RE);
  if (!m) return null;
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  const yyyy = m[3];
  // sanity
  const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
  if (isNaN(d.getTime())) return null;
  return `${yyyy}-${mm}-${dd}`;
}

function splitMultiline(v: any): string[] {
  if (v == null) return [];
  let s = String(v);
  if (!s.includes("\n")) {
    // fallback delimiters
    s = s.replace(/\s*\|\s*/g, "\n").replace(/\s*;\s*/g, "\n");
  }
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function parseIdentityLines(lines: string[]): {
  full_name: string;
  rank: string | null;
  corps: string | null;
  nrp_nip: string | null;
  dikma_diktuk: string | null;
  generation: string | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  const full_name = lines[0] ?? "";
  let rank: string | null = null;
  let corps: string | null = null;
  let nrp_nip: string | null = null;
  let dikma_diktuk: string | null = null;
  let generation: string | null = null;

  // Line 2: rank/corps/nrp e.g. "Mayor/Pnb/539059" or "Mayor/Sus (W)/538698"
  if (lines[1]) {
    const parts = lines[1].split("/").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
      rank = parts[0];
      // NRP is last numeric-looking token
      nrp_nip = parts[parts.length - 1];
      corps = parts.slice(1, -1).join("/");
    } else if (parts.length === 2) {
      rank = parts[0];
      nrp_nip = parts[1];
      warnings.push("Korps tidak terbaca dari kolom NAMA");
    } else {
      warnings.push("Format pangkat/korps/NRP tidak terbaca");
    }
  } else {
    warnings.push("Pangkat/korps/NRP kosong");
  }

  // Line 3: dikma e.g. "AAU 2009" or "SEPA PK 2007"
  if (lines[2]) {
    dikma_diktuk = lines[2];
    const ym = lines[2].match(/(19|20)\d{2}/);
    if (ym) generation = ym[0];
  }

  return { full_name, rank, corps, nrp_nip, dikma_diktuk, generation, warnings };
}

function parseJabatanLines(lines: string[]): {
  unit_position: string | null;
  tmt_jabatan: string | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  if (lines.length === 0) return { unit_position: null, tmt_jabatan: null, warnings };
  // last line that matches date is tmt
  let tmtIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (DATE_RE.test(lines[i])) { tmtIdx = i; break; }
  }
  let tmt: string | null = null;
  let unit: string | null = null;
  if (tmtIdx >= 0) {
    tmt = isoDate(lines[tmtIdx]);
    if (!tmt) warnings.push("TMT jabatan tidak valid");
    unit = lines.slice(0, tmtIdx).join(" ").trim() || null;
  } else {
    unit = lines.join(" ").trim() || null;
    warnings.push("TMT jabatan tidak ditemukan");
  }
  return { unit_position: unit, tmt_jabatan: tmt, warnings };
}

function parseBirthLines(lines: string[]): {
  birth_date: string | null;
  age_text: string | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  let birth: string | null = null;
  let age: string | null = null;
  for (const ln of lines) {
    if (!birth && DATE_RE.test(ln)) {
      birth = isoDate(ln);
      if (!birth) warnings.push("Tanggal lahir tidak valid");
    } else if (!age && /Th|Bl|tahun/i.test(ln)) {
      age = ln;
    }
  }
  if (!birth && lines.length > 0) warnings.push("Tanggal lahir tidak terbaca");
  return { birth_date: birth, age_text: age, warnings };
}

function detectTitleAndSelection(ws: XLSX.WorkSheet): {
  title: string | null;
  selection_name: string | null;
  year_label: string | null;
} {
  const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false }) as any[][];
  for (let i = 0; i < Math.min(10, aoa.length); i++) {
    for (const cell of aoa[i] ?? []) {
      if (typeof cell === "string" && /DAFTAR\s+NAMA.+SELEKSI/i.test(cell)) {
        const title = cell.trim();
        const sel = title.match(/SELEKSI\s+([A-Z0-9\-\s]+?)(?:\s+TA|\s+TP|\s*$)/i);
        const year = title.match(/T[AP]\s*(\d{4})/i);
        return {
          title,
          selection_name: sel ? sel[1].trim() : null,
          year_label: year ? `TA ${year[1]}` : null,
        };
      }
    }
  }
  return { title: null, selection_name: null, year_label: null };
}

function findHeaderRowIndex(aoa: any[][]): number {
  for (let i = 0; i < Math.min(15, aoa.length); i++) {
    const joined = (aoa[i] ?? []).map((c) => String(c ?? "").toUpperCase()).join("|");
    if (
      (/NAMA/.test(joined) && /PANGKAT/.test(joined)) ||
      (/JABATAN/.test(joined) && /TGL\s*LAHIR/.test(joined))
    ) {
      return i;
    }
  }
  return -1;
}

export async function parseSeskoauCandidateListWorkbook(file: File): Promise<SeskoauParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });

  // 1) Try sheet "Daftar Kelompok"
  let sheetName = wb.SheetNames.find((n) => /daftar\s*kelompok/i.test(n)) ?? null;
  if (!sheetName) {
    // 2) fallback: find sheet whose first 15 rows contain NO/URT/BAG/NAMA/...
    for (const n of wb.SheetNames) {
      const ws = wb.Sheets[n];
      const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false }) as any[][];
      if (findHeaderRowIndex(aoa) >= 0) { sheetName = n; break; }
    }
  }
  if (!sheetName) sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  const meta = detectTitleAndSelection(ws);
  const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false }) as any[][];
  const headerIdx = findHeaderRowIndex(aoa);
  const dataStart = headerIdx >= 0 ? headerIdx + 1 : 0;

  const rows: ImportedCandidateRow[] = [];
  let currentPok: string | null = null;

  for (let i = dataStart; i < aoa.length; i++) {
    const r = aoa[i] ?? [];
    if (r.every((c) => c == null || String(c).trim() === "")) continue;

    // POK marker — usually in col C (index 2), but scan all cells
    let pokFound: string | null = null;
    for (const cell of r) {
      if (cell == null) continue;
      const m = String(cell).match(POK_RE);
      if (m) { pokFound = `POK ${m[1].toUpperCase()}`; break; }
    }
    if (pokFound) {
      currentPok = pokFound;
      continue;
    }

    // Skip rows that look like header continuation (e.g. all numeric labels 1,2,3...)
    const colA = r[0];
    const colB = r[1];
    const colC = r[2];
    const colD = r[3];
    const colE = r[4];
    const colF = r[5];

    // Heuristic: a participant row must have a non-empty col C with multiple lines OR a name-like string
    const cStr = colC == null ? "" : String(colC).trim();
    if (!cStr) continue;
    // Skip column-number row "1 2 3 4 7 12"
    if (/^\d+$/.test(String(colA ?? "").trim()) && /^\d+$/.test(String(colB ?? "").trim()) && /^\d+$/.test(cStr)) continue;
    // Skip header words appearing in cell C
    if (/^(NAMA|NO|URT|BAG|JABATAN|TGL|KET)\b/i.test(cStr) && cStr.length < 30) continue;

    const identLines = splitMultiline(colC);
    if (identLines.length === 0) continue;

    const errors: string[] = [];
    const warnings: string[] = [];

    const ident = parseIdentityLines(identLines);
    const jab = parseJabatanLines(splitMultiline(colD));
    const birth = parseBirthLines(splitMultiline(colE));

    warnings.push(...ident.warnings, ...jab.warnings, ...birth.warnings);
    if (!currentPok) warnings.push("Group marker POK tidak ditemukan sebelum baris ini");
    if (!ident.full_name) errors.push("Nama kosong");

    const no_urt = colA == null || String(colA).trim() === "" ? null : String(colA).trim();
    const bag_number = colB == null || String(colB).trim() === "" ? null : String(colB).trim();
    const notes = colF == null || String(colF).trim() === "" ? null : String(colF).trim();

    const combined = [
      ident.full_name,
      ident.rank,
      ident.corps,
      ident.nrp_nip,
      ident.dikma_diktuk,
    ].filter(Boolean).join(" | ");

    rows.push({
      source_sheet_name: sheetName,
      source_row_number: i + 1,
      no_urt,
      bag_number,
      pok_group: currentPok,
      full_name: ident.full_name,
      rank: ident.rank,
      corps: ident.corps,
      nrp_nip: ident.nrp_nip,
      dikma_diktuk: ident.dikma_diktuk,
      generation: ident.generation,
      unit_position: jab.unit_position,
      tmt_jabatan: jab.tmt_jabatan,
      birth_date: birth.birth_date,
      age_text: birth.age_text,
      notes,
      combined_identity: combined,
      temporary_id_preview: "TMP-PENDING",
      validation_status: errors.length ? "Error" : warnings.length ? "Warning" : "Ready",
      validation_errors: errors,
      validation_warnings: warnings,
      raw_identity: identLines.join(" | "),
      raw_jabatan: splitMultiline(colD).join(" | "),
      raw_birth: splitMultiline(colE).join(" | "),
    });
  }

  const totals = {
    total: rows.length,
    ready: rows.filter((r) => r.validation_status === "Ready").length,
    warning: rows.filter((r) => r.validation_status === "Warning").length,
    error: rows.filter((r) => r.validation_status === "Error").length,
  };

  return {
    source_format: meta.title || sheetName.toLowerCase().includes("daftar") ? "SESKOAU_DAFTAR_KELOMPOK_XLSX" : "UNKNOWN",
    sheet_name: sheetName,
    detected_title: meta.title,
    detected_selection_name: meta.selection_name,
    detected_year_label: meta.year_label,
    rows,
    totals,
  };
}

export function buildErrorReportXlsx(rows: ImportedCandidateRow[]): Blob {
  const aoa: any[][] = [[
    "source_row_number","no_urt","bag_number","pok_group","full_name",
    "raw_identity","raw_jabatan","raw_birth","status","errors","warnings",
  ]];
  for (const r of rows) {
    aoa.push([
      r.source_row_number, r.no_urt, r.bag_number, r.pok_group, r.full_name,
      r.raw_identity, r.raw_jabatan, r.raw_birth,
      r.validation_status,
      r.validation_errors.join("; "),
      r.validation_warnings.join("; "),
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Errors");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}