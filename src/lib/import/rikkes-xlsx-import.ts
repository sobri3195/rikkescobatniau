import * as XLSX from "xlsx";

export type SheetKind =
  | "absen"
  | "aplikasi"
  | "laporan1"
  | "dirbindukkes"
  | "parade"
  | "rakor"
  | "pra_pantukhir"
  | "disminpersau"
  | "disdikau"
  | "resume_casis"
  | "unknown";

export interface DetectedSheet {
  name: string;
  kind: SheetKind;
  rowCount: number;
}

const SHEET_PATTERNS: Array<{ kind: SheetKind; rx: RegExp }> = [
  { kind: "absen", rx: /absen.*perk?elas|absen/i },
  { kind: "aplikasi", rx: /^aplikasi$|aplikasi/i },
  { kind: "resume_casis", rx: /resume.*casis|resume/i },
  { kind: "laporan1", rx: /laporan.*1|lap.*1/i },
  { kind: "dirbindukkes", rx: /dirbindukkes/i },
  { kind: "pra_pantukhir", rx: /pra.*pantukhir/i },
  { kind: "parade", rx: /parade/i },
  { kind: "rakor", rx: /rakor/i },
  { kind: "disminpersau", rx: /disminpersau/i },
  { kind: "disdikau", rx: /disdikau/i },
];

export function detectSheetKind(name: string): SheetKind {
  for (const p of SHEET_PATTERNS) if (p.rx.test(name)) return p.kind;
  return "unknown";
}

export async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: "array", cellDates: true });
}

export function detectWorkbookSheets(wb: XLSX.WorkBook): {
  sheets: DetectedSheet[];
  hasAbsen: boolean;
  hasAplikasi: boolean;
  hasResumeCasis: boolean;
  hasLaporan1: boolean;
  knownSheets: string[];
  unknownSheets: string[];
} {
  const sheets: DetectedSheet[] = wb.SheetNames.map((n) => {
    const ws = wb.Sheets[n];
    const range = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]) : null;
    return {
      name: n,
      kind: detectSheetKind(n),
      rowCount: range ? range.e.r - range.s.r + 1 : 0,
    };
  });
  const known = sheets.filter((s) => s.kind !== "unknown");
  return {
    sheets,
    hasAbsen: sheets.some((s) => s.kind === "absen"),
    hasAplikasi: sheets.some((s) => s.kind === "aplikasi"),
    hasResumeCasis: sheets.some((s) => s.kind === "resume_casis"),
    hasLaporan1: sheets.some((s) => s.kind === "laporan1"),
    knownSheets: known.map((s) => s.name),
    unknownSheets: sheets.filter((s) => s.kind === "unknown").map((s) => s.name),
  };
}

function sheetToMatrix(ws: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false }) as unknown[][];
}

const norm = (v: unknown) => String(v ?? "").trim();
const normKey = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function findHeaderRow(matrix: unknown[][], keywords: string[]): number {
  for (let i = 0; i < Math.min(matrix.length, 30); i++) {
    const row = matrix[i] || [];
    const joined = row.map(normKey).join(" ");
    if (keywords.every((k) => joined.includes(k))) return i;
  }
  return -1;
}

function mapHeaders(headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((h, i) => {
    const k = normKey(h);
    if (k) map[k] = i;
  });
  return map;
}

function findCol(map: Record<string, number>, candidates: string[]): number | undefined {
  for (const c of candidates) {
    const key = normKey(c);
    if (key in map) return map[key];
    // fuzzy contains
    for (const k of Object.keys(map)) {
      if (k.includes(key) || key.includes(k)) return map[k];
    }
  }
  return undefined;
}

export interface AbsenRow {
  rowNumber: number;
  serial_number: number | null;
  test_number: string;
  pok_korp: string | null;
  unit_position: string | null;
  full_name: string;
  birth_place: string | null;
  birth_date: string | null;
  combined_identity: string | null;
  rank: string | null;
  nrp_nip: string | null;
  generation: string | null;
}

function parseBirthDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = norm(v);
  // dd-mm-yyyy or dd/mm/yyyy
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    const mm = m[2].padStart(2, "0");
    const dd = m[1].padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function extractIdentity(combined: string | null): {
  rank: string | null;
  nrp_nip: string | null;
  generation: string | null;
} {
  if (!combined) return { rank: null, nrp_nip: null, generation: null };
  const s = combined.replace(/\s+/g, " ").trim();
  // NRP/NIP pattern: 6+ digits
  const nrpMatch = s.match(/\b(\d{6,})\b/);
  // Angkatan: "A-XX" / "TA XXXX" / "ANGKATAN \w+"
  const angMatch = s.match(/\b(A-?\d{1,3}|ANGKATAN\s+[A-Z0-9-]+)\b/i);
  // Rank: leading uppercase tokens (e.g. "LETKOL KES", "MAYOR")
  const rankMatch = s.match(/^([A-Z][A-Z./ ]{1,40}?)(?=\s+\d|\s+[A-Z][a-z])/);
  return {
    rank: rankMatch ? rankMatch[1].trim() : null,
    nrp_nip: nrpMatch ? nrpMatch[1] : null,
    generation: angMatch ? angMatch[0].toUpperCase() : null,
  };
}

export function parseAbsenSheet(ws: XLSX.WorkSheet): AbsenRow[] {
  const matrix = sheetToMatrix(ws);
  const headerIdx = findHeaderRow(matrix, ["nama"]);
  if (headerIdx < 0) return [];
  const map = mapHeaders(matrix[headerIdx]);
  const cNo = findCol(map, ["no urt", "no", "urt"]);
  const cTes = findCol(map, ["tes", "no test", "nomor test"]);
  const cPok = findCol(map, ["pok", "korp", "pok korp"]);
  const cUnit = findCol(map, ["pnd satuan jabatan", "satuan", "jabatan", "pnd"]);
  const cName = findCol(map, ["nama"]);
  const cBp = findCol(map, ["tempat lahir"]);
  const cBd = findCol(map, ["tgl lahir", "tanggal lahir"]);
  const cId = findCol(map, ["identitas"]);

  const rows: AbsenRow[] = [];
  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const row = matrix[r] || [];
    const name = cName != null ? norm(row[cName]) : "";
    const test = cTes != null ? norm(row[cTes]) : "";
    if (!name && !test) continue;
    const combined = cId != null ? norm(row[cId]) || null : null;
    const ext = extractIdentity(combined);
    const sn = cNo != null ? parseInt(norm(row[cNo]), 10) : NaN;
    rows.push({
      rowNumber: r + 1,
      serial_number: isFinite(sn) ? sn : null,
      test_number: test,
      pok_korp: cPok != null ? norm(row[cPok]) || null : null,
      unit_position: cUnit != null ? norm(row[cUnit]) || null : null,
      full_name: name,
      birth_place: cBp != null ? norm(row[cBp]) || null : null,
      birth_date: cBd != null ? parseBirthDate(row[cBd]) : null,
      combined_identity: combined,
      rank: ext.rank,
      nrp_nip: ext.nrp_nip,
      generation: ext.generation,
    });
  }
  return rows;
}

export interface AplikasiRow {
  rowNumber: number;
  serial_number: number | null;
  test_number: string;
  pok_korp: string | null;
  panda: string | null;
  combined_identity: string | null;
  unit_position: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  weight_difference: number | null;
  bmi: number | null;
  chest_or_waist_lp: number | null;
  anamnesis: string | null;
  sections: Record<string, { findings: string | null; classification: string | null; notes: string | null }>;
  summary: {
    kesum_classification: string | null;
    keswa_status: string | null;
    final_result: string | null;
    final_score: number | null;
    k1_notes: string | null;
    k2_notes: string | null;
    attention_notes: string | null;
    suggestions: string | null;
  };
}

const APLIKASI_SECTION_COLS: Array<{ key: string; keywords: string[] }> = [
  { key: "anamnesa", keywords: ["anamnesa"] },
  { key: "pemeriksaan_umum", keywords: ["pemeriksaan umum", "umum"] },
  { key: "tanda_vital", keywords: ["tensi", "nadi", "tanda vital"] },
  { key: "penyakit_dalam", keywords: ["penyakit dalam", "interna"] },
  { key: "ekg_ergo", keywords: ["ekg", "ergo"] },
  { key: "paru", keywords: ["paru", "fvc", "fev1"] },
  { key: "neurologi", keywords: ["neurologi"] },
  { key: "obsgyn", keywords: ["obsgyn", "obgyn"] },
  { key: "kulit", keywords: ["kulit"] },
  { key: "laboratorium", keywords: ["lab"] },
  { key: "radiologi_ro", keywords: ["ro", "radiologi", "rontgen"] },
  { key: "usg", keywords: ["usg"] },
  { key: "tht", keywords: ["tht"] },
  { key: "bedah", keywords: ["bedah"] },
  { key: "atas", keywords: ["atas"] },
  { key: "bawah", keywords: ["bawah"] },
  { key: "audio_tympano", keywords: ["audio", "tympano", "timpano"] },
  { key: "mata", keywords: ["mata"] },
  { key: "gigi", keywords: ["gigi", "odontogram"] },
  { key: "jiwa_keswa", keywords: ["jiwa", "keswa"] },
];

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const s = String(v).replace(/,/g, ".").replace(/[^\d.\-]/g, "");
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

function normalizeClassification(v: unknown): string | null {
  const s = norm(v).toUpperCase();
  if (!s) return null;
  if (["B", "C", "K1", "K2", "TH"].includes(s)) return s;
  if (s.startsWith("K1")) return "K1";
  if (s.startsWith("K2")) return "K2";
  if (s === "TH" || s.startsWith("TH ")) return "TH";
  return null;
}

function normalizeFinalResult(v: unknown): string | null {
  const s = norm(v).toUpperCase();
  if (!s) return null;
  if (["MS", "TMS", "TH"].includes(s)) return s;
  if (s.includes("TMS")) return "TMS";
  if (s.includes("MS")) return "MS";
  return null;
}

export function parseAplikasiSheet(ws: XLSX.WorkSheet): AplikasiRow[] {
  const matrix = sheetToMatrix(ws);
  // header may span 2-3 rows; find the row that has "NAMA" and "KESUM" or "HASIL AKHIR"
  let headerIdx = -1;
  for (let i = 0; i < Math.min(matrix.length, 40); i++) {
    const joined = (matrix[i] || []).map(normKey).join(" ");
    if (joined.includes("nama") && (joined.includes("kesum") || joined.includes("hasil akhir"))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];

  // Build a combined header by merging current + previous 1-2 rows (tiered headers)
  const combined: string[] = [];
  const width = Math.max(...matrix.slice(Math.max(0, headerIdx - 2), headerIdx + 1).map((r) => r.length));
  for (let c = 0; c < width; c++) {
    const parts: string[] = [];
    for (let r = Math.max(0, headerIdx - 2); r <= headerIdx; r++) {
      const v = matrix[r]?.[c];
      if (v != null && norm(v)) parts.push(norm(v));
    }
    combined.push(parts.join(" "));
  }
  const map = mapHeaders(combined);

  const cNo = findCol(map, ["no urt", "no", "urt"]);
  const cTes = findCol(map, ["tes", "no test"]);
  const cPok = findCol(map, ["pok", "korp"]);
  const cPanda = findCol(map, ["panda"]);
  const cName = findCol(map, ["nama"]);
  const cUnit = findCol(map, ["satuan", "jabatan", "pnd"]);
  const cTbBb = findCol(map, ["tb bb", "tb/bb", "tbbb"]);
  const cTb = findCol(map, ["tb", "tinggi"]);
  const cBb = findCol(map, ["bb", "berat"]);
  const cSelisih = findCol(map, ["selisih bb", "selisih"]);
  const cBmi = findCol(map, ["imt", "bmi"]);
  const cLp = findCol(map, ["lp", "lingkar"]);
  const cKesum = findCol(map, ["kesum"]);
  const cKeswa = findCol(map, ["keswa"]);
  const cHasil = findCol(map, ["hasil akhir"]);
  const cNilai = findCol(map, ["nilai"]);
  const cKetK1 = findCol(map, ["keterangan k1", "keterangan ms", "catatan"]);
  const cKetK2 = findCol(map, ["keterangan k2", "keterangan tms"]);
  const cSaran = findCol(map, ["saran"]);

  const sectionCols: Record<string, number | undefined> = {};
  for (const sc of APLIKASI_SECTION_COLS) {
    sectionCols[sc.key] = findCol(map, sc.keywords);
  }

  const rows: AplikasiRow[] = [];
  // 3-row per participant blocks starting at headerIdx+1
  let r = headerIdx + 1;
  while (r < matrix.length) {
    const r1 = matrix[r] || [];
    const r2 = matrix[r + 1] || [];
    const r3 = matrix[r + 2] || [];
    const name = cName != null ? norm(r1[cName]) : "";
    const test = cTes != null ? norm(r1[cTes]) : "";
    if (!name && !test) {
      r += 1;
      continue;
    }

    const tbbb = cTbBb != null ? norm(r1[cTbBb]) : "";
    let height: number | null = null;
    let weight: number | null = null;
    if (tbbb && tbbb.includes("/")) {
      const [h, w] = tbbb.split("/").map((s) => toNum(s));
      height = h;
      weight = w;
    } else {
      height = cTb != null ? toNum(r1[cTb]) : null;
      weight = cBb != null ? toNum(r1[cBb]) : null;
    }

    const sn = cNo != null ? parseInt(norm(r1[cNo]), 10) : NaN;
    const sections: AplikasiRow["sections"] = {};
    for (const [key, idx] of Object.entries(sectionCols)) {
      if (idx == null) continue;
      sections[key] = {
        findings: norm(r1[idx]) || null,
        classification: normalizeClassification(r2[idx]),
        notes: norm(r3[idx]) || null,
      };
    }

    rows.push({
      rowNumber: r + 1,
      serial_number: isFinite(sn) ? sn : null,
      test_number: test,
      pok_korp: cPok != null ? norm(r1[cPok]) || null : null,
      panda: cPanda != null ? norm(r1[cPanda]) || null : null,
      combined_identity: name || null,
      unit_position: cUnit != null ? norm(r1[cUnit]) || null : null,
      height_cm: height,
      weight_kg: weight,
      weight_difference: cSelisih != null ? toNum(r1[cSelisih]) : null,
      bmi: cBmi != null ? toNum(r1[cBmi]) : null,
      chest_or_waist_lp: cLp != null ? toNum(r1[cLp]) : null,
      anamnesis: sections.anamnesa?.findings ?? null,
      sections,
      summary: {
        kesum_classification: cKesum != null ? normalizeClassification(r1[cKesum]) : null,
        keswa_status: cKeswa != null ? norm(r1[cKeswa]).toUpperCase() || null : null,
        final_result: cHasil != null ? normalizeFinalResult(r1[cHasil]) : null,
        final_score: cNilai != null ? toNum(r1[cNilai]) : null,
        k1_notes: cKetK1 != null ? norm(r3[cKetK1]) || norm(r1[cKetK1]) || null : null,
        k2_notes: cKetK2 != null ? norm(r3[cKetK2]) || norm(r1[cKetK2]) || null : null,
        attention_notes: null,
        suggestions: cSaran != null ? norm(r1[cSaran]) || null : null,
      },
    });
    r += 3;
  }
  return rows;
}

export interface ResumeCasisRow {
  rowNumber: number;
  serial_number: number | null;
  pok_korp: string | null;
  panda: string | null;
  combined_identity: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  bmi: number | null;
  kesum: string | null;
  keswa: string | null;
  final_result: string | null;
  keterangan: string | null;
  saran: string | null;
}

export function parseResumeCasisSheet(ws: XLSX.WorkSheet): ResumeCasisRow[] {
  const matrix = sheetToMatrix(ws);
  const headerIdx = findHeaderRow(matrix, ["nama"]);
  if (headerIdx < 0) return [];
  const map = mapHeaders(matrix[headerIdx]);
  const cNo = findCol(map, ["no urt", "no", "urt"]);
  const cPok = findCol(map, ["pok", "korp"]);
  const cPanda = findCol(map, ["panda"]);
  const cName = findCol(map, ["nama"]);
  const cTbBb = findCol(map, ["tb bb", "tb/bb"]);
  const cBmi = findCol(map, ["imt", "bmi"]);
  const cKesum = findCol(map, ["kesum"]);
  const cKeswa = findCol(map, ["keswa"]);
  const cHasil = findCol(map, ["hasil akhir"]);
  const cKet = findCol(map, ["keterangan"]);
  const cSaran = findCol(map, ["saran"]);
  const rows: ResumeCasisRow[] = [];
  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const row = matrix[r] || [];
    const name = cName != null ? norm(row[cName]) : "";
    if (!name) continue;
    const tbbb = cTbBb != null ? norm(row[cTbBb]) : "";
    let height: number | null = null;
    let weight: number | null = null;
    if (tbbb.includes("/")) {
      const [h, w] = tbbb.split("/").map((s) => toNum(s));
      height = h;
      weight = w;
    }
    const sn = cNo != null ? parseInt(norm(row[cNo]), 10) : NaN;
    rows.push({
      rowNumber: r + 1,
      serial_number: isFinite(sn) ? sn : null,
      pok_korp: cPok != null ? norm(row[cPok]) || null : null,
      panda: cPanda != null ? norm(row[cPanda]) || null : null,
      combined_identity: name,
      height_cm: height,
      weight_kg: weight,
      bmi: cBmi != null ? toNum(row[cBmi]) : null,
      kesum: cKesum != null ? normalizeClassification(row[cKesum]) : null,
      keswa: cKeswa != null ? norm(row[cKeswa]).toUpperCase() || null : null,
      final_result: cHasil != null ? normalizeFinalResult(row[cHasil]) : null,
      keterangan: cKet != null ? norm(row[cKet]) || null : null,
      saran: cSaran != null ? norm(row[cSaran]) || null : null,
    });
  }
  return rows;
}

/** Merged candidate-centric preview row built from absen + aplikasi + resume */
export interface PreviewRow {
  key: string; // test_number or fallback
  test_number: string;
  full_name: string;
  serial_number: number | null;
  pok_korp: string | null;
  panda: string | null;
  unit_position: string | null;
  birth_place: string | null;
  birth_date: string | null;
  combined_identity: string | null;
  rank: string | null;
  nrp_nip: string | null;
  generation: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  bmi: number | null;
  bmi_calc: number | null;
  chest_or_waist_lp: number | null;
  weight_difference: number | null;
  kesum_classification: string | null;
  keswa_status: string | null;
  final_result: string | null;
  final_score: number | null;
  k1_notes: string | null;
  k2_notes: string | null;
  attention_notes: string | null;
  suggestions: string | null;
  sections: AplikasiRow["sections"];
  sourceSheets: string[];
  errors: string[];
  warnings: string[];
  status: "Ready" | "Warning" | "Error" | "Duplicate";
  rowNumber: number;
  excluded?: boolean;
}

export function mergeAndValidate(input: {
  absen?: AbsenRow[];
  aplikasi?: AplikasiRow[];
  resume?: ResumeCasisRow[];
}): PreviewRow[] {
  const byKey = new Map<string, PreviewRow>();

  const ensure = (key: string, base: Partial<PreviewRow>): PreviewRow => {
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        test_number: "",
        full_name: "",
        serial_number: null,
        pok_korp: null,
        panda: null,
        unit_position: null,
        birth_place: null,
        birth_date: null,
        combined_identity: null,
        rank: null,
        nrp_nip: null,
        generation: null,
        height_cm: null,
        weight_kg: null,
        bmi: null,
        bmi_calc: null,
        chest_or_waist_lp: null,
        weight_difference: null,
        kesum_classification: null,
        keswa_status: null,
        final_result: null,
        final_score: null,
        k1_notes: null,
        k2_notes: null,
        attention_notes: null,
        suggestions: null,
        sections: {},
        sourceSheets: [],
        errors: [],
        warnings: [],
        status: "Ready",
        rowNumber: 0,
        ...base,
      });
    }
    const cur = byKey.get(key)!;
    Object.assign(cur, { ...base, key });
    return cur;
  };

  for (const a of input.absen || []) {
    const key = a.test_number || `absen-${a.rowNumber}`;
    const row = ensure(key, {
      test_number: a.test_number,
      full_name: a.full_name,
      serial_number: a.serial_number,
      pok_korp: a.pok_korp,
      unit_position: a.unit_position,
      birth_place: a.birth_place,
      birth_date: a.birth_date,
      combined_identity: a.combined_identity,
      rank: a.rank,
      nrp_nip: a.nrp_nip,
      generation: a.generation,
      rowNumber: a.rowNumber,
    });
    row.sourceSheets.push("Absen");
  }

  for (const a of input.aplikasi || []) {
    const key = a.test_number || `aplikasi-${a.rowNumber}`;
    const row = ensure(key, {
      test_number: a.test_number || (byKey.get(key)?.test_number ?? ""),
      full_name: byKey.get(key)?.full_name || a.combined_identity || "",
      serial_number: byKey.get(key)?.serial_number ?? a.serial_number,
      pok_korp: byKey.get(key)?.pok_korp ?? a.pok_korp,
      panda: a.panda,
      unit_position: byKey.get(key)?.unit_position ?? a.unit_position,
      combined_identity: byKey.get(key)?.combined_identity ?? a.combined_identity,
      height_cm: a.height_cm,
      weight_kg: a.weight_kg,
      bmi: a.bmi,
      chest_or_waist_lp: a.chest_or_waist_lp,
      weight_difference: a.weight_difference,
      kesum_classification: a.summary.kesum_classification,
      keswa_status: a.summary.keswa_status,
      final_result: a.summary.final_result,
      final_score: a.summary.final_score,
      k1_notes: a.summary.k1_notes,
      k2_notes: a.summary.k2_notes,
      suggestions: a.summary.suggestions,
      sections: a.sections,
      rowNumber: a.rowNumber,
    });
    row.sourceSheets.push("APLIKASI");
  }

  for (const a of input.resume || []) {
    const key =
      [...byKey.values()].find(
        (r) =>
          (a.serial_number && r.serial_number === a.serial_number) ||
          (a.combined_identity && r.combined_identity && r.combined_identity.includes(a.combined_identity.split(" ")[0])),
      )?.key || `resume-${a.rowNumber}`;
    const row = ensure(key, {
      test_number: byKey.get(key)?.test_number || "",
      full_name: byKey.get(key)?.full_name || a.combined_identity || "",
      serial_number: byKey.get(key)?.serial_number ?? a.serial_number,
      pok_korp: byKey.get(key)?.pok_korp ?? a.pok_korp,
      panda: byKey.get(key)?.panda ?? a.panda,
      combined_identity: byKey.get(key)?.combined_identity ?? a.combined_identity,
      height_cm: byKey.get(key)?.height_cm ?? a.height_cm,
      weight_kg: byKey.get(key)?.weight_kg ?? a.weight_kg,
      bmi: byKey.get(key)?.bmi ?? a.bmi,
      kesum_classification: byKey.get(key)?.kesum_classification ?? a.kesum,
      keswa_status: byKey.get(key)?.keswa_status ?? a.keswa,
      final_result: byKey.get(key)?.final_result ?? a.final_result,
      suggestions: byKey.get(key)?.suggestions ?? a.saran,
      k1_notes: byKey.get(key)?.k1_notes ?? a.keterangan,
      rowNumber: byKey.get(key)?.rowNumber ?? a.rowNumber,
    });
    row.sourceSheets.push("RESUME");

    // cross-check
    const apRow = (input.aplikasi || []).find((x) => x.test_number === row.test_number);
    if (apRow) {
      if (apRow.summary.kesum_classification && a.kesum && apRow.summary.kesum_classification !== a.kesum) {
        row.warnings.push(`KESUM berbeda APLIKASI(${apRow.summary.kesum_classification}) vs RESUME(${a.kesum})`);
      }
      if (apRow.summary.final_result && a.final_result && apRow.summary.final_result !== a.final_result) {
        row.warnings.push(`HASIL AKHIR berbeda APLIKASI(${apRow.summary.final_result}) vs RESUME(${a.final_result})`);
      }
    }
  }

  // validation
  const seenTest = new Map<string, number>();
  for (const row of byKey.values()) {
    if (!row.test_number) row.errors.push("No test kosong");
    if (!row.full_name && !row.combined_identity) row.errors.push("Nama kosong");
    if (row.test_number) {
      seenTest.set(row.test_number, (seenTest.get(row.test_number) || 0) + 1);
    }
    if (row.height_cm && row.weight_kg) {
      const h = row.height_cm / 100;
      row.bmi_calc = +(row.weight_kg / (h * h)).toFixed(1);
      if (row.bmi && Math.abs(row.bmi - row.bmi_calc) > 1.0) {
        row.warnings.push(`BMI ${row.bmi} tidak sesuai TB/BB (hitung ${row.bmi_calc})`);
      }
    }
    if (row.kesum_classification === "K2" && row.final_result === "MS") {
      row.warnings.push("KESUM K2 tetapi HASIL AKHIR MS");
    }
    if (row.keswa_status === "TMS" && row.final_result === "MS") {
      row.warnings.push("KESWA TMS tetapi HASIL AKHIR MS");
    }
  }
  for (const row of byKey.values()) {
    if (row.test_number && (seenTest.get(row.test_number) || 0) > 1) {
      row.errors.push("Duplikat no test di file");
    }
    row.status = row.errors.length
      ? "Error"
      : row.warnings.length
        ? "Warning"
        : "Ready";
  }

  return [...byKey.values()].sort(
    (a, b) => (a.serial_number ?? 9999) - (b.serial_number ?? 9999) || a.test_number.localeCompare(b.test_number),
  );
}