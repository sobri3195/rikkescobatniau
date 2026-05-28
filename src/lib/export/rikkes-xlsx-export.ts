import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { localDataApi } from "@/lib/localDataApi";
import { logAudit } from "@/lib/audit";

// ---------- Types ----------
export interface ExportFilters {
  exam_status?: string;
  final_result?: string;
  kesum_classification?: string;
  keswa_status?: string;
  pok_korp?: string;
  panda?: string;
  has_k1?: boolean;
  has_k2?: boolean;
  finalized_only?: boolean;
  revision_needed?: boolean;
  search?: string;
}

export interface ExportOptions {
  selectionId: string;
  filters?: ExportFilters;
  includeHelperColumns?: boolean;
  selectedCandidateIds?: string[];
  format?: "full" | "aplikasi" | "laporan" | "resume";
  disdikauFilter?: "all" | "ms" | "tms" | "finalized";
  fileName?: string;
  requireFinalNoTest?: boolean;
  onProgress?: (label: string, pct: number) => void;
}

export interface ExportResult {
  fileName: string;
  rowCount: number;
  sheetCount: number;
  counts: { MS: number; TMS: number; TH: number; incomplete: number };
}

interface Row {
  candidate: any;
  exam: any | null;
  mm: any | null;
  ms: any | null;
  sections: Record<string, any>;
}

// ---------- Style helpers ----------
const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF888888" } },
  left: { style: "thin", color: { argb: "FF888888" } },
  bottom: { style: "thin", color: { argb: "FF888888" } },
  right: { style: "thin", color: { argb: "FF888888" } },
};
const BORDER_BOTTOM_THICK: Partial<ExcelJS.Borders> = {
  ...BORDER_THIN,
  bottom: { style: "medium", color: { argb: "FF000000" } },
};

function applyDataCellStyle(cell: ExcelJS.Cell) {
  cell.border = BORDER_THIN;
  cell.alignment = { vertical: "top", wrapText: true };
  cell.font = { name: "Arial", size: 9 };
}
function applyHeaderStyle(cell: ExcelJS.Cell) {
  cell.border = BORDER_THIN;
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.font = { name: "Arial", size: 9, bold: true };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
}
function applyClassificationStyle(cell: ExcelJS.Cell, value: string | null | undefined) {
  if (!value) return;
  const map: Record<string, { fg: string; bold?: boolean }> = {
    B: { fg: "FFD1FADF" },
    C: { fg: "FFFEF3C7" },
    K1: { fg: "FFFED7AA" },
    K2: { fg: "FFFECACA", bold: true },
    TH: { fg: "FFE5E7EB" },
    MS: { fg: "FFD1FADF" },
    TMS: { fg: "FFFECACA", bold: true },
  };
  const s = map[value];
  if (!s) return;
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: s.fg } };
  cell.font = { name: "Arial", size: 9, bold: !!s.bold };
  cell.alignment = { horizontal: "center", vertical: "middle" };
}
function applyTitleHeader(ws: ExcelJS.Worksheet, sel: any, title: string, cols: number) {
  const lines = [sel.institution_header_line_1, sel.institution_header_line_2, "", title, sel.report_subtitle ?? `${sel.name} ${sel.year_label}`];
  lines.forEach((text, i) => {
    const r = ws.getRow(i + 1);
    r.getCell(1).value = text ?? "";
    ws.mergeCells(i + 1, 1, i + 1, Math.max(2, cols));
    r.getCell(1).alignment = { horizontal: i < 2 ? "left" : "center" };
    r.getCell(1).font = { name: "Arial", size: i === 3 ? 12 : 10, bold: i < 2 || i === 3 };
  });
}
function applyPrintSettings(ws: ExcelJS.Worksheet, orientation: "portrait" | "landscape" = "landscape") {
  ws.pageSetup = {
    ...ws.pageSetup,
    orientation,
    paperSize: 9, // A4
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
  };
}

// ---------- Data fetch & filter ----------
async function fetchData(selectionId: string): Promise<{ selection: any; rows: Row[] }> {
  const isAll = !selectionId || selectionId === "all" || selectionId === "*";
  const [selRes, cRes, eRes, sRes, mRes, msRes] = await Promise.all([
    isAll
      ? Promise.resolve({ data: { id: "all", name: "SEMUA SELEKSI", year_label: new Date().getFullYear().toString(), report_title: "REKAP APLIKASI — SEMUA SELEKSI" }, error: null } as any)
      : localDataApi.from("selections").select("*").eq("id", selectionId).single(),
    isAll
      ? localDataApi.from("candidates").select("*").is("deleted_at", null).order("serial_number")
      : localDataApi.from("candidates").select("*").eq("selection_id", selectionId).is("deleted_at", null).order("serial_number"),
    isAll
      ? localDataApi.from("exams").select("*")
      : localDataApi.from("exams").select("*").eq("selection_id", selectionId),
    localDataApi.from("exam_sections").select("*"),
    localDataApi.from("medical_measurements").select("*"),
    localDataApi.from("medical_summary").select("*"),
  ]);
  if (selRes.error || !selRes.data) throw new Error("Data seleksi tidak ditemukan");
  const cands = cRes.data ?? [];
  const examByCand = new Map((eRes.data ?? []).map((x) => [x.candidate_id, x]));
  const examIds = new Set((eRes.data ?? []).map((e) => e.id));
  const mmByExam = new Map((mRes.data ?? []).filter((x) => examIds.has(x.exam_id)).map((x) => [x.exam_id, x]));
  const msByExam = new Map((msRes.data ?? []).filter((x) => examIds.has(x.exam_id)).map((x) => [x.exam_id, x]));
  const secsByCand = new Map<string, Record<string, any>>();
  for (const sec of sRes.data ?? []) {
    if (!examIds.has(sec.exam_id)) continue;
    if (!secsByCand.has(sec.candidate_id)) secsByCand.set(sec.candidate_id, {});
    secsByCand.get(sec.candidate_id)![sec.section_key] = sec;
  }
  const rows: Row[] = cands.map((cand) => {
    const exam = examByCand.get(cand.id) ?? null;
    return {
      candidate: cand,
      exam,
      mm: exam ? mmByExam.get(exam.id) ?? null : null,
      ms: exam ? msByExam.get(exam.id) ?? null : null,
      sections: secsByCand.get(cand.id) ?? {},
    };
  });
  return { selection: selRes.data, rows };
}

function applyFilters(rows: Row[], opts: ExportOptions): Row[] {
  const f = opts.filters ?? {};
  let out = rows;
  if (opts.selectedCandidateIds?.length) {
    const set = new Set(opts.selectedCandidateIds);
    out = out.filter((r) => set.has(r.candidate.id));
  }
  out = out.filter((r) => {
    if (f.exam_status && r.exam?.exam_status !== f.exam_status) return false;
    if (f.final_result) {
      const fr = r.exam?.final_result ?? "Belum Lengkap";
      if (fr !== f.final_result) return false;
    }
    if (f.kesum_classification && (r.exam?.kesum_classification ?? "Belum Lengkap") !== f.kesum_classification) return false;
    if (f.keswa_status && (r.exam?.keswa_status ?? "Belum Lengkap") !== f.keswa_status) return false;
    if (f.pok_korp && r.candidate.pok_korp !== f.pok_korp) return false;
    if (f.panda && r.candidate.panda !== f.panda) return false;
    if (f.has_k1 && !(r.ms?.count_k1 ?? 0)) return false;
    if (f.has_k2 && !(r.ms?.count_k2 ?? 0)) return false;
    if (f.finalized_only && r.exam?.exam_status !== "Finalized") return false;
    if (f.revision_needed && r.exam?.exam_status !== "Revision Needed") return false;
    if (f.search) {
      const hay = `${r.candidate.full_name} ${r.candidate.test_number} ${r.candidate.nrp_nip}`.toLowerCase();
      if (!hay.includes(f.search.toLowerCase())) return false;
    }
    return true;
  });
  return out;
}

// ---------- Sheet builders ----------
const SEC_KEYS = [
  "anamnesa", "penyakit_dalam", "ekg_ergo", "paru", "neurologi", "obsgyn",
  "kulit", "laboratorium", "radiologi_ro", "usg", "tht", "bedah",
  "atas", "bawah", "audio_tympano", "mata", "gigi", "jiwa_keswa",
];

function fdg(sec: any) { return sec?.findings ?? ""; }
function cls(sec: any) { return sec?.classification ?? ""; }
function note(sec: any) { return sec?.notes ?? ""; }

function buildAbsenSheet(wb: ExcelJS.Workbook, sel: any, rows: Row[]) {
  const ws = wb.addWorksheet("Absen perkelas", { views: [{ state: "frozen", ySplit: 7 }] });
  applyTitleHeader(ws, sel, "ABSEN PERKELAS", 11);
  const headers = ["NO URT", "TES", "TMP ID", "POK", "PND/SATUAN/JABATAN", "NAMA", "TEMPAT LAHIR", "TGL LAHIR", "IDENTITAS", "STATUS RO", "STATUS EKG"];
  const hr = ws.getRow(7);
  headers.forEach((h, i) => { hr.getCell(i + 1).value = h; applyHeaderStyle(hr.getCell(i + 1)); });
  hr.height = 28;
  rows.forEach((r, i) => {
    const c = r.candidate;
    const ex = r.exam;
    const row = ws.getRow(8 + i);
    const cells = [
      i + 1,
      c.test_number ?? "",
      c.temporary_id ?? "",
      c.pok_korp,
      c.unit_position ?? c.panda,
      c.full_name,
      c.birth_place,
      c.birth_date,
      c.combined_identity,
      ex?.radiology_initial_status ?? "Belum Diisi",
      ex?.ekg_initial_status ?? "Belum Diisi",
    ];
    cells.forEach((v, j) => { row.getCell(j + 1).value = v ?? ""; applyDataCellStyle(row.getCell(j + 1)); });
  });
  [6, 10, 14, 8, 30, 30, 18, 12, 35, 14, 14].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  applyPrintSettings(ws, "landscape");
}

// ===== APLIKASI sheet — mirrors the web Rekap APLIKASI table =====
type AplCol = { key: string; label: string; width: number; align?: "left" | "center" };
type AplGroup = { key: string; label: string; cols: AplCol[]; helper?: boolean };

const APL_IDENTITY: AplCol[] = [
  { key: "urt", label: "URT", width: 5, align: "center" },
  { key: "tes", label: "TES", width: 9, align: "center" },
  { key: "pok", label: "POK", width: 7, align: "center" },
  { key: "panda", label: "PANDA", width: 9, align: "center" },
  { key: "nama", label: "NAMA / PANGKAT / NRP / SATUAN", width: 32, align: "left" },
];

const APL_GROUPS: AplGroup[] = [
  { key: "umum", label: "UMUM / ANTROPOMETRI", cols: [
    { key: "tbbb", label: "TB / BB", width: 10, align: "center" },
    { key: "imt", label: "IMT", width: 7, align: "center" },
    { key: "lp", label: "LP", width: 7, align: "center" },
    { key: "scr", label: "Klasifikasi Screening", width: 12, align: "center" },
  ]},
  { key: "anam", label: "ANAMNESA & PEM. UMUM", cols: [
    { key: "anamnesa", label: "Anamnesa", width: 22, align: "left" },
    { key: "pem_umum", label: "Pemeriksaan Umum", width: 22, align: "left" },
    { key: "cls_umum", label: "Klasifikasi Umum", width: 10, align: "center" },
    { key: "ket_umum", label: "Keterangan Umum", width: 22, align: "left" },
  ]},
  { key: "ekg", label: "EKG / ERGO", cols: [
    { key: "ekg_hasil", label: "Hasil EKG", width: 22, align: "left" },
    { key: "ekg_status", label: "Status EKG", width: 12, align: "center" },
    { key: "ekg_cls", label: "Klasifikasi EKG", width: 10, align: "center" },
  ]},
  { key: "rad", label: "PARU / RONTGEN / USG", cols: [
    { key: "ro", label: "Rontgen / RO", width: 22, align: "left" },
    { key: "usg", label: "USG", width: 22, align: "left" },
    { key: "rad_cls", label: "Klasifikasi Radiologi", width: 12, align: "center" },
  ]},
  { key: "neuro", label: "NEUROLOGI", cols: [
    { key: "neuro_hasil", label: "Hasil Neurologi", width: 22, align: "left" },
    { key: "neuro_cls", label: "Klasifikasi Neurologi", width: 12, align: "center" },
  ]},
  { key: "lab", label: "LABORATORIUM", cols: [
    { key: "lab_hema", label: "Hematologi", width: 18, align: "left" },
    { key: "lab_urin", label: "Urinalisa", width: 18, align: "left" },
    { key: "lab_kimia", label: "Kimia Darah", width: 18, align: "left" },
    { key: "lab_narko", label: "Narkoba", width: 12, align: "left" },
    { key: "lab_kesimp", label: "Kesimpulan Lab", width: 22, align: "left" },
    { key: "lab_cls", label: "Klasifikasi Lab", width: 10, align: "center" },
  ]},
  { key: "tht", label: "THT", cols: [
    { key: "tht_hasil", label: "Hasil THT", width: 22, align: "left" },
    { key: "tht_bisik", label: "Suara Bisikan AD/AS", width: 14, align: "center" },
    { key: "tht_cls", label: "Klasifikasi THT", width: 10, align: "center" },
  ]},
  { key: "bedah", label: "BEDAH", cols: [
    { key: "bedah_hasil", label: "Hasil Bedah", width: 22, align: "left" },
    { key: "bedah_cls", label: "Klasifikasi Bedah", width: 10, align: "center" },
  ]},
  { key: "mata", label: "MATA", cols: [
    { key: "mata_visus", label: "Visus OD/OS", width: 12, align: "center" },
    { key: "mata_kor", label: "Koreksi OD/OS", width: 12, align: "center" },
    { key: "mata_peri", label: "Perimetri", width: 10, align: "center" },
    { key: "mata_iop", label: "IOP", width: 8, align: "center" },
    { key: "mata_cls", label: "Klasifikasi Mata", width: 10, align: "center" },
  ]},
  { key: "gigi", label: "GIGI", cols: [
    { key: "gigi_dmft", label: "DMF-T", width: 8, align: "center" },
    { key: "gigi_odon", label: "Odontogram", width: 22, align: "left" },
    { key: "gigi_kesimp", label: "Kesimpulan Gigi", width: 22, align: "left" },
    { key: "gigi_cls", label: "Klasifikasi Gigi", width: 10, align: "center" },
  ]},
  { key: "keswa", label: "KESWA", cols: [
    { key: "keswa_stakes", label: "STAKES Keswa", width: 14, align: "center" },
    { key: "keswa_cls", label: "Klasifikasi Keswa", width: 10, align: "center" },
    { key: "keswa_status", label: "Status Keswa", width: 10, align: "center" },
    { key: "keswa_diag", label: "Diagnosis Keswa", width: 22, align: "left" },
    { key: "keswa_kesimp", label: "Kesimpulan Keswa", width: 22, align: "left" },
  ]},
  { key: "hasil", label: "HASIL", cols: [
    { key: "h_kesum", label: "KESUM", width: 8, align: "center" },
    { key: "h_keswa", label: "KESWA", width: 8, align: "center" },
    { key: "h_akhir", label: "Hasil Akhir", width: 10, align: "center" },
    { key: "h_nilai", label: "Nilai", width: 8, align: "center" },
    { key: "h_ket", label: "Keterangan", width: 24, align: "left" },
    { key: "h_kesimp", label: "Kesimpulan", width: 24, align: "left" },
    { key: "h_lulus", label: "Penentuan Kelulusan", width: 14, align: "center" },
  ]},
  { key: "helper", label: "HELPER / OTOMATIS", helper: true, cols: [
    { key: "hp_imt", label: "IMT Helper", width: 8, align: "center" },
    { key: "hp_st", label: "Stakes BB/TB", width: 12, align: "center" },
    { key: "hp_bmin", label: "BB Minimal", width: 10, align: "center" },
    { key: "hp_bmax", label: "BB Maksimal", width: 10, align: "center" },
    { key: "hp_sel", label: "Selisih BB", width: 10, align: "center" },
    { key: "hp_kode", label: "Kode Hasil", width: 10, align: "center" },
    { key: "hp_stat", label: "Status Data", width: 12, align: "center" },
  ]},
];

// Light status fills (mirrors web badges)
const STATUS_FILL: Record<string, { fg: string; bold?: boolean }> = {
  Belum: { fg: "FFF3F4F6" },
  Draft: { fg: "FFFEF9C3" },
  Submitted: { fg: "FFD1FAE5" },
  Finalized: { fg: "FFDBEAFE" },
  "In Progress": { fg: "FFFED7AA" },
  "Perlu Review": { fg: "FFFECACA", bold: true },
};

function sectionStatusLabel(sec: any): string {
  const s = sec?.section_status;
  if (!s) return "Belum";
  if (s === "Submitted") return "Submitted";
  if (s === "Approved" || s === "Locked") return "Finalized";
  if (s === "Draft") return "Draft";
  if (s === "Revision") return "Perlu Review";
  return s;
}

function valueOrDash(v: any): string {
  if (v === null || v === undefined) return "-";
  const s = String(v).trim();
  return s === "" ? "-" : s;
}

function buildAplikasiCellValues(row: Row, includeHelper: boolean): Array<{ value: any; align: "left" | "center"; statusFill?: string; classification?: string; wrap?: boolean }> {
  const c = row.candidate, ex = row.exam, mm = row.mm, ms = row.ms, secs = row.sections;
  const sec = (k: string) => secs?.[k];
  const fdgv = (k: string) => valueOrDash(sec(k)?.findings ?? sec(k)?.notes);
  const clsv = (k: string) => sec(k)?.classification ?? null;

  // identity composite (multi-line)
  const identity = [
    c.full_name ?? "-",
    [c.rank, c.nrp_nip].filter(Boolean).join(" / ") || "-",
    c.unit_position ?? c.panda ?? "-",
  ].join("\n");

  const out: Array<{ value: any; align: "left" | "center"; statusFill?: string; classification?: string; wrap?: boolean }> = [];
  // Identity
  out.push({ value: c.serial_number ?? "", align: "center" });
  out.push({ value: valueOrDash(c.test_number), align: "center" });
  out.push({ value: valueOrDash(c.pok_korp), align: "center" });
  out.push({ value: valueOrDash(c.panda), align: "center" });
  out.push({ value: identity, align: "left", wrap: true });

  const push = (v: any, align: "left" | "center" = "left", extra: Partial<{ statusFill: string; classification: string; wrap: boolean }> = {}) =>
    out.push({ value: v, align, ...extra });

  for (const g of APL_GROUPS) {
    if (g.helper && !includeHelper) continue;
    for (const col of g.cols) {
      const k = col.key;
      const align = col.align ?? "left";
      // UMUM
      if (k === "tbbb") { push(mm ? `${valueOrDash(mm.height_cm)} / ${valueOrDash(mm.weight_kg)}` : "-", align); continue; }
      if (k === "imt") { push(valueOrDash(mm?.bmi), align); continue; }
      if (k === "lp") { push(valueOrDash(mm?.chest_or_waist_lp), align); continue; }
      if (k === "scr") { push(valueOrDash(mm?.bmi_classification), align, { classification: mm?.bmi_classification ?? undefined }); continue; }
      // ANAM
      if (k === "anamnesa") { push(fdgv("anamnesa"), align, { statusFill: sectionStatusLabel(sec("anamnesa")), wrap: true }); continue; }
      if (k === "pem_umum") { push(fdgv("penyakit_dalam"), align, { statusFill: sectionStatusLabel(sec("penyakit_dalam")), wrap: true }); continue; }
      if (k === "cls_umum") { const v = clsv("penyakit_dalam") ?? clsv("anamnesa"); push(valueOrDash(v), align, { classification: v ?? undefined }); continue; }
      if (k === "ket_umum") { push(valueOrDash(sec("kulit")?.notes ?? sec("obsgyn")?.notes), align, { wrap: true }); continue; }
      // EKG
      if (k === "ekg_hasil") { push(fdgv("ekg_ergo"), align, { statusFill: sectionStatusLabel(sec("ekg_ergo")), wrap: true }); continue; }
      if (k === "ekg_status") { push(sectionStatusLabel(sec("ekg_ergo")), align, { statusFill: sectionStatusLabel(sec("ekg_ergo")) }); continue; }
      if (k === "ekg_cls") { const v = clsv("ekg_ergo"); push(valueOrDash(v), align, { classification: v ?? undefined }); continue; }
      // RAD
      if (k === "ro") { push(fdgv("radiologi_ro"), align, { statusFill: sectionStatusLabel(sec("radiologi_ro")), wrap: true }); continue; }
      if (k === "usg") { push(fdgv("usg"), align, { statusFill: sectionStatusLabel(sec("usg")), wrap: true }); continue; }
      if (k === "rad_cls") { const v = clsv("paru") ?? clsv("radiologi_ro") ?? clsv("usg"); push(valueOrDash(v), align, { classification: v ?? undefined }); continue; }
      // NEURO
      if (k === "neuro_hasil") { push(fdgv("neurologi"), align, { statusFill: sectionStatusLabel(sec("neurologi")), wrap: true }); continue; }
      if (k === "neuro_cls") { const v = clsv("neurologi"); push(valueOrDash(v), align, { classification: v ?? undefined }); continue; }
      // LAB
      if (k === "lab_hema" || k === "lab_urin" || k === "lab_kimia" || k === "lab_narko") {
        push(fdgv("laboratorium"), align, { statusFill: sectionStatusLabel(sec("laboratorium")), wrap: true });
        continue;
      }
      if (k === "lab_kesimp") { push(valueOrDash(sec("laboratorium")?.notes), align, { statusFill: sectionStatusLabel(sec("laboratorium")), wrap: true }); continue; }
      if (k === "lab_cls") { const v = clsv("laboratorium"); push(valueOrDash(v), align, { classification: v ?? undefined }); continue; }
      // THT
      if (k === "tht_hasil") { push(fdgv("tht") !== "-" ? fdgv("tht") : fdgv("audio_tympano"), align, { statusFill: sectionStatusLabel(sec("tht")), wrap: true }); continue; }
      if (k === "tht_bisik") { push(valueOrDash(sec("audio_tympano")?.findings), align); continue; }
      if (k === "tht_cls") { const v = clsv("tht") ?? clsv("audio_tympano"); push(valueOrDash(v), align, { classification: v ?? undefined }); continue; }
      // BEDAH
      if (k === "bedah_hasil") { push(fdgv("bedah"), align, { statusFill: sectionStatusLabel(sec("bedah")), wrap: true }); continue; }
      if (k === "bedah_cls") { const v = clsv("bedah") ?? clsv("atas") ?? clsv("bawah"); push(valueOrDash(v), align, { classification: v ?? undefined }); continue; }
      // MATA
      if (k === "mata_visus" || k === "mata_kor" || k === "mata_peri" || k === "mata_iop") {
        push(fdgv("mata"), align, { statusFill: sectionStatusLabel(sec("mata")), wrap: true });
        continue;
      }
      if (k === "mata_cls") { const v = clsv("mata"); push(valueOrDash(v), align, { classification: v ?? undefined }); continue; }
      // GIGI
      if (k === "gigi_dmft") { push(valueOrDash(sec("gigi")?.findings?.split(/\s/)[0]), align); continue; }
      if (k === "gigi_odon") { push(fdgv("gigi"), align, { statusFill: sectionStatusLabel(sec("gigi")), wrap: true }); continue; }
      if (k === "gigi_kesimp") { push(valueOrDash(sec("gigi")?.notes), align, { statusFill: sectionStatusLabel(sec("gigi")), wrap: true }); continue; }
      if (k === "gigi_cls") { const v = clsv("gigi"); push(valueOrDash(v), align, { classification: v ?? undefined }); continue; }
      // KESWA
      if (k === "keswa_stakes") { push(valueOrDash((sec("jiwa_keswa") as any)?.stakes_value ?? sec("jiwa_keswa")?.findings), align); continue; }
      if (k === "keswa_cls") { const v = clsv("jiwa_keswa"); push(valueOrDash(v), align, { classification: v ?? undefined }); continue; }
      if (k === "keswa_status") { const v = ex?.keswa_status ?? null; push(valueOrDash(v), align, { classification: v ?? undefined }); continue; }
      if (k === "keswa_diag") { push(valueOrDash(sec("jiwa_keswa")?.findings), align, { wrap: true }); continue; }
      if (k === "keswa_kesimp") { push(valueOrDash(sec("jiwa_keswa")?.notes), align, { wrap: true }); continue; }
      // HASIL
      if (k === "h_kesum") { const v = ex?.kesum_classification ?? null; push(valueOrDash(v), align, { classification: v ?? undefined }); continue; }
      if (k === "h_keswa") { const v = ex?.keswa_status ?? null; push(valueOrDash(v), align, { classification: v ?? undefined }); continue; }
      if (k === "h_akhir") { const v = ex?.final_result ?? null; push(valueOrDash(v), align, { classification: v ?? undefined }); continue; }
      if (k === "h_nilai") { push(valueOrDash(ex?.final_score), align); continue; }
      if (k === "h_ket") { push(valueOrDash(ms?.k1_notes), align, { wrap: true }); continue; }
      if (k === "h_kesimp") { push(valueOrDash(ms?.k2_notes), align, { wrap: true }); continue; }
      if (k === "h_lulus") {
        const label = ex?.exam_status === "Finalized" ? (ex?.final_result ?? "Finalized") : (ex?.exam_status ?? "Belum");
        const fill = label === "Finalized" ? "Finalized" : label === "Pending Review" ? "Submitted" : label === "Revision Needed" ? "Perlu Review" : label === "In Progress" ? "In Progress" : "Belum";
        push(label, align, { statusFill: fill });
        continue;
      }
      // HELPER
      if (k === "hp_imt") { push(valueOrDash(mm?.bmi), align); continue; }
      if (k === "hp_st") { push(valueOrDash(mm?.bmi_classification), align); continue; }
      if (k === "hp_bmin") { push(valueOrDash(mm?.min_ideal_weight), align); continue; }
      if (k === "hp_bmax") { push(valueOrDash(mm?.max_ideal_weight), align); continue; }
      if (k === "hp_sel") { push(valueOrDash(mm?.weight_difference), align); continue; }
      if (k === "hp_kode") { push(valueOrDash(ex?.final_result), align); continue; }
      if (k === "hp_stat") {
        const v = ex?.exam_status ?? "Belum";
        const fill = v === "Finalized" ? "Finalized" : v === "Pending Review" ? "Submitted" : v === "Revision Needed" ? "Perlu Review" : v === "In Progress" ? "In Progress" : "Belum";
        push(v, align, { statusFill: fill });
        continue;
      }
      push("-", align);
    }
  }
  return out;
}

function buildAplikasiSheet(wb: ExcelJS.Workbook, sel: any, rows: Row[], includeHelper: boolean) {
  // Build visible groups list
  const visibleGroups = APL_GROUPS.filter((g) => includeHelper || !g.helper);
  const allCols: AplCol[] = [...APL_IDENTITY, ...visibleGroups.flatMap((g) => g.cols)];
  const totalCols = allCols.length;

  const ws = wb.addWorksheet("APLIKASI", {
    views: [{ state: "frozen", ySplit: 8, xSplit: APL_IDENTITY.length }],
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  // Document title rows (1-5)
  applyTitleHeader(ws, sel, sel.report_title ?? "REKAP APLIKASI — HASIL PEMERIKSAAN KESEHATAN", totalCols);

  // ===== Row 6: Group banner (merged across each group) =====
  const groupRow = ws.getRow(6);
  groupRow.height = 22;
  // Identity group: merge across identity columns under one banner
  const idStart = 1;
  const idEnd = APL_IDENTITY.length;
  ws.mergeCells(6, idStart, 6, idEnd);
  const idCell = groupRow.getCell(idStart);
  idCell.value = "IDENTITAS";
  styleGroupHeader(idCell);

  let colCursor = idEnd + 1;
  for (const g of visibleGroups) {
    const start = colCursor;
    const end = colCursor + g.cols.length - 1;
    if (end > start) ws.mergeCells(6, start, 6, end);
    const cell = groupRow.getCell(start);
    cell.value = g.label;
    styleGroupHeader(cell);
    colCursor = end + 1;
  }

  // ===== Row 7: Sub-header per column =====
  const subRow = ws.getRow(7);
  subRow.height = 28;
  allCols.forEach((col, i) => {
    const cell = subRow.getCell(i + 1);
    cell.value = col.label;
    styleSubHeader(cell);
  });

  // Row 8 spacer reserved for AutoFilter to attach (use as alt sub-header copy)
  // Actually we will let data start at row 8 directly. Apply autoFilter on row 7.
  ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: 7, column: totalCols } };
  ws.views = [{ state: "frozen", ySplit: 7, xSplit: APL_IDENTITY.length }];

  // ===== Data rows starting at row 8 =====
  rows.forEach((row, idx) => {
    const rowNum = 8 + idx;
    const r = ws.getRow(rowNum);
    const cells = buildAplikasiCellValues(row, includeHelper);
    // First cell URT: prefer index over serial_number for sequential numbering when filtered
    cells[0].value = idx + 1;

    cells.forEach((cv, i) => {
      const cell = r.getCell(i + 1);
      cell.value = cv.value as any;
      cell.border = BORDER_THIN;
      cell.font = { name: "Calibri", size: 9 };
      cell.alignment = {
        horizontal: cv.align,
        vertical: "middle",
        wrapText: !!cv.wrap || cv.align === "left",
      };
      if (cv.classification) {
        applyClassificationStyle(cell, cv.classification);
      } else if (cv.statusFill && STATUS_FILL[cv.statusFill]) {
        const s = STATUS_FILL[cv.statusFill];
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: s.fg } };
        if (s.bold) cell.font = { name: "Calibri", size: 9, bold: true };
      }
    });

    // Zebra striping for identity columns (subtle)
    if (idx % 2 === 1) {
      for (let i = 1; i <= APL_IDENTITY.length; i++) {
        const cell = r.getCell(i);
        if (!cell.fill) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
        }
      }
    }
    r.height = 42;
  });

  // Column widths
  allCols.forEach((col, i) => { ws.getColumn(i + 1).width = col.width; });

  applyPrintSettings(ws, "landscape");
}

function styleGroupHeader(cell: ExcelJS.Cell) {
  cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
  cell.border = BORDER_THIN;
}
function styleSubHeader(cell: ExcelJS.Cell) {
  cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
  cell.border = BORDER_THIN;
}

function buildLaporanSheet(wb: ExcelJS.Workbook, sel: any, rows: Row[], name: string, extraCols: string[] = [], extra: (r: Row) => any[] = () => []) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 8 }] });
  const baseHeaders = [
    "NO", "NO TEST", "POK/KORP", "PANDA/SATUAN", "NAMA/PANGKAT/NRP",
    "TB/BB", "IMT", "LP",
    "ANAMNESA", "PENY DALAM", "EKG/ERGO", "PARU", "NEURO", "OBSGYN", "KULIT",
    "LAB B/C/K1", "LAB K2", "RO",
    "USG B/C/K1", "USG K2", "THT B/C/K1", "THT K2", "BEDAH B/C/K1", "BEDAH K2",
    "ATAS B/C/K1", "ATAS K2", "BAWAH B/C/K1", "BAWAH K2",
    "AUDIO/TYMP", "MATA", "GIGI B/C/K1", "GIGI K2", "JIWA",
    "KESUM", "KESWA", "HASIL AKHIR", "NILAI", "KET K1/MS/CATATAN", "KET K2/TMS",
  ];
  const hariHHeaders = ["STAGE HARI-H", "STATUS EKG", "STATUS RO", "IMT KLAS", "JUKNIS"];
  const headers = [...baseHeaders, ...hariHHeaders, ...extraCols];
  applyTitleHeader(ws, sel, `${sel.report_title ?? "HASIL"} — ${name}`, headers.length);
  const hr = ws.getRow(8);
  headers.forEach((h, i) => { hr.getCell(i + 1).value = h; applyHeaderStyle(hr.getCell(i + 1)); });
  hr.height = 30;

  const splitBCK1K2 = (sec: any) => {
    const c = cls(sec);
    const f = fdg(sec);
    if (!f) return ["-", "-"];
    return c === "K2" ? ["-", f] : [f, "-"];
  };

  rows.forEach((row, idx) => {
    const r = ws.getRow(9 + idx);
    const c = row.candidate, ex = row.exam, mm = row.mm, ms = row.ms, secs = row.sections;
    const [labA, labB] = splitBCK1K2(secs.laboratorium);
    const [usgA, usgB] = splitBCK1K2(secs.usg);
    const [thtA, thtB] = splitBCK1K2(secs.tht);
    const [bedA, bedB] = splitBCK1K2(secs.bedah);
    const [atasA, atasB] = splitBCK1K2(secs.atas);
    const [bawA, bawB] = splitBCK1K2(secs.bawah);
    const [gigiA, gigiB] = splitBCK1K2(secs.gigi);
    const base = [
      idx + 1, c.test_number, c.pok_korp, `${c.panda ?? ""}\n${c.unit_position ?? ""}`,
      `${c.full_name}\n${c.rank ?? ""} / ${c.nrp_nip ?? ""}`,
      mm ? `${mm.height_cm ?? "-"}/${mm.weight_kg ?? "-"}` : "",
      mm?.bmi ?? "", mm?.chest_or_waist_lp ?? "",
      fdg(secs.anamnesa), fdg(secs.penyakit_dalam), fdg(secs.ekg_ergo), fdg(secs.paru),
      fdg(secs.neurologi), fdg(secs.obsgyn), fdg(secs.kulit),
      labA, labB, fdg(secs.radiologi_ro),
      usgA, usgB, thtA, thtB, bedA, bedB, atasA, atasB, bawA, bawB,
      fdg(secs.audio_tympano), fdg(secs.mata), gigiA, gigiB, fdg(secs.jiwa_keswa),
      ex?.kesum_classification ?? "", ex?.keswa_status ?? "", ex?.final_result ?? "", ex?.final_score ?? "",
      ms?.k1_notes ?? "", ms?.k2_notes ?? "",
    ];
    const hariH = [
      (ex as any)?.hari_h_stage ?? "",
      (ex as any)?.ekg_initial_status ?? "",
      (ex as any)?.radiology_initial_status ?? "",
      mm?.bmi_classification ?? "",
      (secs.anamnesa as any)?.anamnesis_status ?? "",
    ];
    const full = [...base, ...hariH, ...extra(row)];
    full.forEach((v, i) => { r.getCell(i + 1).value = v ?? ""; applyDataCellStyle(r.getCell(i + 1)); });
    // colorize KESUM/KESWA/HASIL
    applyClassificationStyle(r.getCell(34), ex?.kesum_classification);
    applyClassificationStyle(r.getCell(35), ex?.keswa_status);
    applyClassificationStyle(r.getCell(36), ex?.final_result);
    r.height = 40;
  });

  ws.getColumn(1).width = 4;
  for (let i = 2; i <= headers.length; i++) {
    const w = ws.getColumn(i).width ?? 12;
    ws.getColumn(i).width = Math.max(w, 12);
  }
  ws.getColumn(5).width = 24;
  applyPrintSettings(ws, "landscape");
}

function buildDisminpersauSheet(wb: ExcelJS.Workbook, sel: any, rows: Row[]) {
  const ws = wb.addWorksheet("DISMINPERSAU", { views: [{ state: "frozen", ySplit: 8 }] });
  const headers = ["NO", "NO TEST", "POK/KORP", "PANDA/SATUAN", "NAMA/PANGKAT/NRP", "TB/BB", "IMT", "KESUM", "KESWA", "HASIL AKHIR", "NILAI", "KET K1", "KET K2/TMS", "SARAN"];
  applyTitleHeader(ws, sel, "LAPORAN DISMINPERSAU", headers.length);
  const hr = ws.getRow(8);
  headers.forEach((h, i) => { hr.getCell(i + 1).value = h; applyHeaderStyle(hr.getCell(i + 1)); });
  hr.height = 28;
  rows.forEach((row, idx) => {
    const r = ws.getRow(9 + idx);
    const c = row.candidate, ex = row.exam, mm = row.mm, ms = row.ms;
    const vals = [
      idx + 1, c.test_number, c.pok_korp, `${c.panda ?? ""}\n${c.unit_position ?? ""}`,
      `${c.full_name}\n${c.rank ?? ""} / ${c.nrp_nip ?? ""}`,
      mm ? `${mm.height_cm ?? "-"}/${mm.weight_kg ?? "-"}` : "",
      mm?.bmi ?? "", ex?.kesum_classification ?? "", ex?.keswa_status ?? "",
      ex?.final_result ?? "", ex?.final_score ?? "",
      ms?.k1_notes ?? "", ms?.k2_notes ?? "", ms?.suggestions ?? "",
    ];
    vals.forEach((v, i) => { r.getCell(i + 1).value = v ?? ""; applyDataCellStyle(r.getCell(i + 1)); });
    applyClassificationStyle(r.getCell(8), ex?.kesum_classification);
    applyClassificationStyle(r.getCell(9), ex?.keswa_status);
    applyClassificationStyle(r.getCell(10), ex?.final_result);
    r.height = 36;
  });
  [4, 10, 10, 18, 26, 9, 6, 8, 8, 10, 7, 22, 22, 20].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  applyPrintSettings(ws, "landscape");
}

function buildDisdikauSheet(wb: ExcelJS.Workbook, sel: any, rows: Row[]) {
  const ws = wb.addWorksheet("DISDIKAU", { views: [{ state: "frozen", ySplit: 8 }] });
  const headers = ["NO", "NO TEST", "POK/KORP", "PANDA", "NAMA", "PANGKAT", "NRP/NIP", "ANGKATAN", "SATUAN/JABATAN", "KESUM", "KESWA", "HASIL AKHIR", "NILAI", "KETERANGAN", "SARAN"];
  applyTitleHeader(ws, sel, "LAPORAN DISDIKAU", headers.length);
  const hr = ws.getRow(8);
  headers.forEach((h, i) => { hr.getCell(i + 1).value = h; applyHeaderStyle(hr.getCell(i + 1)); });
  hr.height = 28;
  rows.forEach((row, idx) => {
    const r = ws.getRow(9 + idx);
    const c = row.candidate, ex = row.exam, ms = row.ms;
    const ket = [ms?.k1_notes, ms?.k2_notes].filter(Boolean).join(" | ");
    const vals = [
      idx + 1, c.test_number, c.pok_korp, c.panda, c.full_name, c.rank, c.nrp_nip, c.generation, c.unit_position,
      ex?.kesum_classification ?? "", ex?.keswa_status ?? "", ex?.final_result ?? "", ex?.final_score ?? "",
      ket, ms?.suggestions ?? "",
    ];
    vals.forEach((v, i) => { r.getCell(i + 1).value = v ?? ""; applyDataCellStyle(r.getCell(i + 1)); });
    applyClassificationStyle(r.getCell(10), ex?.kesum_classification);
    applyClassificationStyle(r.getCell(11), ex?.keswa_status);
    applyClassificationStyle(r.getCell(12), ex?.final_result);
    r.height = 32;
  });
  [4, 10, 10, 10, 22, 10, 12, 8, 20, 8, 8, 10, 7, 26, 20].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  applyPrintSettings(ws, "landscape");
}

function buildResumeCasisSheet(wb: ExcelJS.Workbook, sel: any, rows: Row[]) {
  const ws = wb.addWorksheet("RESUME CASIS", { views: [{ state: "frozen", ySplit: 8 }] });
  const headers = ["NO URT", "POK", "PANDA", "NAMA/TTL", "TB/BB", "IMT", "KESUM", "KESWA", "HASIL KESUM", "HASIL KESWA", "HASIL AKHIR", "KETERANGAN", "SARAN"];
  applyTitleHeader(ws, sel, "RESUME CASIS", headers.length);
  const hr = ws.getRow(8);
  headers.forEach((h, i) => { hr.getCell(i + 1).value = h; applyHeaderStyle(hr.getCell(i + 1)); });
  hr.height = 28;
  rows.forEach((row, idx) => {
    const r = ws.getRow(9 + idx);
    const c = row.candidate, ex = row.exam, mm = row.mm, ms = row.ms;
    const kesum = ex?.kesum_classification;
    const hasilKesum = kesum === "K2" ? "TMS" : kesum === "TH" ? "TH" : kesum ? "MS" : "";
    const ket = [ms?.k1_notes, ms?.k2_notes].filter(Boolean).join(" | ");
    const vals = [
      c.serial_number ?? idx + 1, c.pok_korp, c.panda,
      `${c.full_name}\n${c.birth_place ?? ""}, ${c.birth_date ?? ""}`,
      mm ? `${mm.height_cm ?? "-"}/${mm.weight_kg ?? "-"}` : "",
      mm?.bmi ?? "", kesum ?? "", ex?.keswa_status ?? "", hasilKesum, ex?.keswa_status ?? "",
      ex?.final_result ?? "", ket, ms?.suggestions ?? "",
    ];
    vals.forEach((v, i) => { r.getCell(i + 1).value = v ?? ""; applyDataCellStyle(r.getCell(i + 1)); });
    applyClassificationStyle(r.getCell(7), ex?.kesum_classification);
    applyClassificationStyle(r.getCell(8), ex?.keswa_status);
    applyClassificationStyle(r.getCell(9), hasilKesum);
    applyClassificationStyle(r.getCell(11), ex?.final_result);
    r.height = 36;
  });
  [6, 8, 10, 26, 9, 6, 7, 8, 10, 10, 10, 26, 20].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  applyPrintSettings(ws, "landscape");
}

async function buildLampiranSheet(wb: ExcelJS.Workbook, sel: any, rows: Row[]) {
  const examIds = rows.map((r) => r.exam?.id).filter(Boolean) as string[];
  if (examIds.length === 0) return;
  const [cardRes, radRes] = await Promise.all([
    localDataApi.from("exam_cardiology").select("exam_id, examination_type, examined_on, status, attachments_json, updated_at").in("exam_id", examIds),
    localDataApi.from("exam_radiology").select("exam_id, examination_type, examined_on, status, attachments_json, updated_at").in("exam_id", examIds),
  ]);
  const candByExam = new Map<string, any>();
  for (const r of rows) if (r.exam?.id) candByExam.set(r.exam.id, r.candidate);

  type Att = { name: string; path?: string; size?: number; type?: string; uploaded_at?: string };
  const lines: any[] = [];
  function pushSource(src: any[] | null | undefined, kind: "EKG" | "Rontgen") {
    for (const row of src ?? []) {
      const cand = candByExam.get(row.exam_id);
      if (!cand) continue;
      const atts: Att[] = Array.isArray(row.attachments_json) ? row.attachments_json : [];
      if (atts.length === 0) {
        lines.push({ cand, kind, type: row.examination_type ?? "-", status: row.status ?? "-", examinedOn: row.examined_on ?? "", name: "(belum ada lampiran)", size: "", uploadedAt: "" });
        continue;
      }
      for (const a of atts) {
        lines.push({
          cand, kind,
          type: row.examination_type ?? "-",
          status: row.status ?? "-",
          examinedOn: row.examined_on ?? "",
          name: a.name ?? "(tanpa nama)",
          size: a.size ?? "",
          uploadedAt: a.uploaded_at ?? "",
        });
      }
    }
  }
  pushSource(cardRes.data, "EKG");
  pushSource(radRes.data, "Rontgen");

  // Sort by candidate serial number, then kind
  lines.sort((a, b) => {
    const sa = a.cand.serial_number ?? 0, sb = b.cand.serial_number ?? 0;
    if (sa !== sb) return sa - sb;
    return String(a.kind).localeCompare(String(b.kind));
  });

  const ws = wb.addWorksheet("LAMPIRAN", { views: [{ state: "frozen", ySplit: 8 }] });
  const headers = ["NO", "NO TEST", "NAMA", "JENIS", "TIPE", "STATUS", "TGL PERIKSA", "NAMA FILE", "UKURAN (KB)", "TGL UPLOAD"];
  applyTitleHeader(ws, sel, "DAFTAR LAMPIRAN EKG & RONTGEN", headers.length);
  const hr = ws.getRow(8);
  headers.forEach((h, i) => { hr.getCell(i + 1).value = h; applyHeaderStyle(hr.getCell(i + 1)); });
  hr.height = 28;

  lines.forEach((ln, idx) => {
    const r = ws.getRow(9 + idx);
    const vals = [
      idx + 1,
      ln.cand.test_number ?? ln.cand.temporary_id ?? "-",
      ln.cand.full_name ?? "",
      ln.kind,
      ln.type,
      ln.status,
      ln.examinedOn,
      ln.name,
      ln.size ? Math.round(Number(ln.size) / 1024) : "",
      ln.uploadedAt ? new Date(ln.uploadedAt).toLocaleString("id-ID") : "",
    ];
    vals.forEach((v, i) => { r.getCell(i + 1).value = v ?? ""; applyDataCellStyle(r.getCell(i + 1)); });
  });
  [4, 12, 26, 10, 14, 12, 12, 36, 10, 20].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  applyPrintSettings(ws, "landscape");
}

// ---------- Save history ----------
async function saveExportHistory(args: {
  selection_id: string;
  file_name: string;
  filter_json: any;
  row_count: number;
  sheet_count: number;
}) {
  const { data: u } = await localDataApi.auth.getUser();
  const { error } = await localDataApi.from("document_exports").insert({
    selection_id: args.selection_id,
    export_type: "XLSX",
    document_type: "RIKKES_MULTI_SHEET",
    file_name: args.file_name,
    filter_json: { ...args.filter_json, row_count: args.row_count, sheet_count: args.sheet_count },
    exported_by: u.user?.id ?? null,
  });
  if (error) console.warn("saveExportHistory:", error.message);
}

// ---------- Public entry ----------
export async function exportRikkesWorkbook(opts: ExportOptions): Promise<ExportResult> {
  const progress = opts.onProgress ?? (() => {});
  const filters = opts.filters ?? {};
  await logAudit({
    action: "export_xlsx_started", module: "Export XLSX", record_id: opts.selectionId,
    after: { filters, format: opts.format ?? "full" },
  }).catch(() => {});
  try {
    progress("Mengambil data", 5);
    const { selection, rows: allRows } = await fetchData(opts.selectionId);
    const rows = applyFilters(allRows, opts);
    if (rows.length === 0) throw new Error("Tidak ada peserta sesuai filter.");

    if (opts.requireFinalNoTest) {
      const noTest = rows.filter((r) => {
        const t = r.candidate?.test_number;
        return !t || String(t).trim() === "" || String(t).startsWith("TMP-");
      });
      if (noTest.length > 0) {
        throw new Error(
          `Export final ditolak: ${noTest.length} peserta belum punya No Test final.`,
        );
      }
    }

    progress("Menyusun workbook", 15);
    const wb = new ExcelJS.Workbook();
    wb.creator = "RIKKES TNI AU";
    wb.created = new Date();
    const fmt = opts.format ?? "full";

    let sheetCount = 0;
    if (fmt === "full" || fmt === "aplikasi") {
      progress("Membuat sheet Absen", 25);
      buildAbsenSheet(wb, selection, rows); sheetCount++;
      progress("Membuat sheet APLIKASI", 35);
      buildAplikasiSheet(wb, selection, rows, !!opts.includeHelperColumns); sheetCount++;
    }
    if (fmt === "full" || fmt === "laporan") {
      progress("Membuat sheet Laporan", 50);
      buildLaporanSheet(wb, selection, rows, "Laporan 1"); sheetCount++;
      buildLaporanSheet(wb, selection, rows, "DIRBINDUKKES", ["ATENSI"], (r) => [r.ms?.attention_notes ?? ""]); sheetCount++;
      progress("Membuat sheet Parade/Rakor", 65);
      buildLaporanSheet(wb, selection, rows, "PARADE", ["CATATAN PARADE", "HASIL AWAL", "HASIL SETELAH PARADE"],
        (r) => [r.ms?.parade_notes ?? "", r.ms?.initial_result ?? "", r.ms?.after_parade_result ?? ""]); sheetCount++;
      buildLaporanSheet(wb, selection, rows, "RAKOR", ["CATATAN PARADE", "HASIL AWAL", "HASIL SETELAH PARADE", "HASIL RAKOR"],
        (r) => [r.ms?.parade_notes ?? "", r.ms?.initial_result ?? "", r.ms?.after_parade_result ?? "", r.ms?.rakor_result ?? ""]); sheetCount++;
      buildLaporanSheet(wb, selection, rows, "PRA PANTUKHIR", ["CATATAN PARADE", "HASIL AWAL", "HASIL SETELAH PARADE", "HASIL RAKOR", "HASIL PRA PANTUKHIR"],
        (r) => [r.ms?.parade_notes ?? "", r.ms?.initial_result ?? "", r.ms?.after_parade_result ?? "", r.ms?.rakor_result ?? "", r.ms?.pra_pantukhir_result ?? ""]); sheetCount++;
      progress("Membuat sheet Disminpersau/Disdikau", 80);
      buildDisminpersauSheet(wb, selection, rows); sheetCount++;
      // DISDIKAU filter
      let dRows = rows;
      const df = opts.disdikauFilter ?? "all";
      if (df === "ms") dRows = rows.filter((r) => r.exam?.final_result === "MS");
      else if (df === "tms") dRows = rows.filter((r) => r.exam?.final_result === "TMS");
      else if (df === "finalized") dRows = rows.filter((r) => r.exam?.exam_status === "Finalized");
      buildDisdikauSheet(wb, selection, dRows); sheetCount++;
    }
    if (fmt === "full" || fmt === "resume") {
      progress("Membuat sheet Resume", 90);
      buildResumeCasisSheet(wb, selection, rows); sheetCount++;
    }
    if (fmt === "full" || fmt === "laporan") {
      progress("Membuat sheet Lampiran", 92);
      await buildLampiranSheet(wb, selection, rows); sheetCount++;
    }

    progress("Menyimpan file", 95);
    const today = new Date().toISOString().slice(0, 10);
    const safeName = (selection.name ?? "SELEKSI").replace(/[^\w]+/g, "_");
    const safeYear = (selection.year_label ?? "").replace(/[^\w]+/g, "_");
    const fileName = opts.fileName?.trim() || `RIKKES_${safeName}_${safeYear}_${today}.xlsx`;
    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName);

    const counts = rows.reduce((a, r) => {
      const fr = r.exam?.final_result;
      if (fr === "MS") a.MS++;
      else if (fr === "TMS") a.TMS++;
      else if (fr === "TH") a.TH++;
      else a.incomplete++;
      return a;
    }, { MS: 0, TMS: 0, TH: 0, incomplete: 0 });

    await saveExportHistory({
      selection_id: opts.selectionId, file_name: fileName,
      filter_json: { filters, format: fmt, disdikauFilter: opts.disdikauFilter, includeHelperColumns: opts.includeHelperColumns },
      row_count: rows.length, sheet_count: sheetCount,
    });
    await logAudit({
      action: "export_xlsx_success", module: "Export XLSX", record_id: opts.selectionId,
      after: { file_name: fileName, row_count: rows.length, sheet_count: sheetCount, counts },
    }).catch(() => {});

    progress("Selesai", 100);
    return { fileName, rowCount: rows.length, sheetCount, counts };
  } catch (e: any) {
    await logAudit({
      action: "export_xlsx_failed", module: "Export XLSX", record_id: opts.selectionId,
      after: { error: e?.message ?? String(e) },
    }).catch(() => {});
    throw e;
  }
}

/** Quick preview: count rows that would be exported, with status breakdown. */
export async function previewExport(opts: ExportOptions): Promise<{ total: number; MS: number; TMS: number; TH: number; incomplete: number; noTestCount: number; selectionName: string }> {
  const { selection, rows } = await fetchData(opts.selectionId);
  const filtered = applyFilters(rows, opts);
  const counts = filtered.reduce((a, r) => {
    const fr = r.exam?.final_result;
    if (fr === "MS") a.MS++;
    else if (fr === "TMS") a.TMS++;
    else if (fr === "TH") a.TH++;
    else a.incomplete++;
    return a;
  }, { MS: 0, TMS: 0, TH: 0, incomplete: 0 });
  const noTestCount = filtered.filter((r) => {
    const t = r.candidate?.test_number;
    return !t || String(t).trim() === "" || String(t).startsWith("TMP-");
  }).length;
  return { total: filtered.length, ...counts, noTestCount, selectionName: `${selection.name} ${selection.year_label}` };
}