// Phase 6: PDF export engine for RIKKES documents.
// Pulls data from localDb — never from dummy/mocks.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { localDataApi } from "@/lib/localDataApi";
import { SECTIONS } from "@/lib/sections";

type Selection = {
  id: string;
  name: string;
  year_label?: string | null;
  location?: string | null;
  institution_header_line_1?: string | null;
  institution_header_line_2?: string | null;
  report_title?: string | null;
  report_subtitle?: string | null;
};

type Candidate = Record<string, any>;
type Exam = Record<string, any>;
type SectionRow = Record<string, any>;
type Summary = Record<string, any>;
type Measurement = Record<string, any>;

interface CandidateBundle {
  selection: Selection;
  candidate: Candidate;
  exam: Exam | null;
  sections: SectionRow[];
  summary: Summary | null;
  measurements: Measurement | null;
  cardiology?: any | null;
  radiology?: any | null;
}

const FONT = "helvetica"; // Times not bundled by default; Helvetica reads well in print

function safe(v: any, fallback = "-"): string {
  if (v === null || v === undefined || v === "") return fallback;
  return String(v);
}

function fmtDate(v: any): string {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleDateString("id-ID");
  } catch {
    return String(v);
  }
}

// --------- Draft watermark ---------
function draftWatermarks(b: CandidateBundle): string[] {
  const labels: string[] = [];
  const c = b.candidate;
  if (!c?.test_number || String(c.test_number).trim() === "") {
    labels.push("DRAFT - NO TEST BELUM ADA");
  }
  const ekg = b.exam?.ekg_initial_status;
  const rad = b.exam?.radiology_initial_status;
  if (ekg !== "Cleared" || rad !== "Cleared") {
    labels.push("DRAFT - EKG/RONTGEN BELUM LENGKAP");
  }
  return labels;
}

function stampWatermarks(doc: jsPDF, labels: string[]) {
  if (!labels.length) return;
  const pageCount = (doc as any).internal.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.saveGraphicsState?.();
    const gs = (doc as any).GState ? new (doc as any).GState({ opacity: 0.14 }) : null;
    if (gs) (doc as any).setGState(gs);
    doc.setFont(FONT, "bold");
    doc.setTextColor(200, 0, 0);
    labels.forEach((label, idx) => {
      const size = Math.min(60, Math.max(28, 400 / label.length));
      doc.setFontSize(size);
      const offsetY = labels.length === 1 ? h / 2 : h / 2 + (idx - 0.5) * 30;
      doc.text(label, w / 2, offsetY, { align: "center", angle: 30 });
    });
    doc.setTextColor(0, 0, 0);
    doc.restoreGraphicsState?.();
  }
}

// --------- Image attachment helpers ---------
async function fetchAttachmentDataUrl(
  path: string,
): Promise<{ dataUrl: string; format: string } | null> {
  try {
    const { data, error } = await localDataApi.storage
      .from("hari-h-attachments")
      .createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return null;
    const res = await fetch(data.signedUrl);
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    const format = blob.type.includes("png") ? "PNG" : "JPEG";
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return { dataUrl, format };
  } catch {
    return null;
  }
}

async function drawAttachmentPages(
  doc: jsPDF,
  b: CandidateBundle,
  title: string,
  attachments: any[],
) {
  if (!attachments?.length) return;
  for (const att of attachments) {
    if (!att?.path) continue;
    if (att.type && !String(att.type).startsWith("image/")) continue;
    const img = await fetchAttachmentDataUrl(att.path);
    if (!img) continue;
    doc.addPage();
    drawHeader(doc, b.selection, {
      confidential: true,
      subtitle: `LAMPIRAN — ${title.toUpperCase()}`,
    });
    doc.setFont(FONT, "normal");
    doc.setFontSize(9);
    doc.text(`${safe(b.candidate.full_name)} — ${safe(b.candidate.test_number)}`, 15, 48);
    doc.text(`File: ${safe(att.name)}`, 15, 53);
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const maxW = pw - 30;
    const maxH = ph - 80;
    try {
      const props = (doc as any).getImageProperties(img.dataUrl);
      const ratio = Math.min(maxW / props.width, maxH / props.height);
      const w = props.width * ratio;
      const h = props.height * ratio;
      doc.addImage(img.dataUrl, img.format, (pw - w) / 2, 58, w, h);
    } catch {
      doc.text("Gagal memuat gambar.", 15, 60);
    }
  }
}

function drawHeader(
  doc: jsPDF,
  selection: Selection,
  options: { confidential?: boolean; subtitle?: string } = {},
) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFont(FONT, "bold");
  doc.setFontSize(11);
  doc.text(
    safe(selection.institution_header_line_1, "MARKAS BESAR TNI ANGKATAN UDARA"),
    w / 2,
    14,
    {
      align: "center",
    },
  );
  doc.text(safe(selection.institution_header_line_2, "PUSAT KESEHATAN"), w / 2, 19, {
    align: "center",
  });
  doc.setDrawColor(0);
  doc.setLineWidth(0.6);
  doc.line(15, 22, w - 15, 22);

  doc.setFontSize(12);
  doc.text(safe(selection.report_title, "HASIL PEMERIKSAAN KESEHATAN"), w / 2, 30, {
    align: "center",
  });
  if (options.subtitle) {
    doc.setFontSize(10);
    doc.setFont(FONT, "normal");
    doc.text(options.subtitle, w / 2, 36, { align: "center" });
  }
  if (selection.name) {
    doc.setFontSize(10);
    doc.setFont(FONT, "normal");
    doc.text(
      `${selection.name}${selection.year_label ? " — " + selection.year_label : ""}`,
      w / 2,
      options.subtitle ? 41 : 36,
      { align: "center" },
    );
  }

  if (options.confidential) {
    doc.setFontSize(8);
    doc.setTextColor(180, 0, 0);
    doc.setFont(FONT, "bold");
    doc.text("RAHASIA KEDOKTERAN", w - 15, 10, { align: "right" });
    doc.setTextColor(0);
  }
}

function drawFooter(doc: jsPDF) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont(FONT, "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Halaman ${i} dari ${pageCount}`, w - 15, h - 8, { align: "right" });
    doc.text(`Dicetak ${new Date().toLocaleString("id-ID")}`, 15, h - 8);
    doc.setTextColor(0);
  }
}

function identityRows(b: CandidateBundle): [string, string][] {
  const c = b.candidate;
  return [
    ["Nama", safe(c.full_name)],
    ["Pangkat / NRP / NIP", `${safe(c.rank)} / ${safe(c.nrp_nip)}`],
    ["Jenis Kelamin", safe(c.gender)],
    ["Tempat / Tgl Lahir", `${safe(c.birth_place)} / ${fmtDate(c.birth_date)}`],
    ["No Test", safe(c.test_number)],
    ["Pok / Korp", safe(c.pok_korp)],
    ["Kesatuan / Panda", `${safe(c.unit_position)} / ${safe(c.panda)}`],
    ["Angkatan", safe(c.generation)],
    ["Alamat", safe(c.address)],
    ["Telp / HP", safe(c.phone)],
  ];
}

function drawIdentityBlock(doc: jsPDF, b: CandidateBundle, startY: number): number {
  autoTable(doc, {
    startY,
    margin: { left: 15, right: 15 },
    theme: "grid",
    styles: { fontSize: 9, font: FONT, cellPadding: 1.5, textColor: 20 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50, fillColor: [240, 240, 240] },
      1: { cellWidth: "auto" },
    },
    body: identityRows(b),
  });
  return (doc as any).lastAutoTable.finalY + 4;
}

async function loadBundle(candidateId: string): Promise<CandidateBundle | null> {
  const { data: candidate } = await localDataApi
    .from("candidates")
    .select("*")
    .eq("id", candidateId)
    .single();
  if (!candidate) return null;
  const { data: selection } = await localDataApi
    .from("selections")
    .select("*")
    .eq("id", candidate.selection_id)
    .single();
  const { data: exam } = await localDataApi
    .from("exams")
    .select("*")
    .eq("candidate_id", candidateId)
    .maybeSingle();
  let sections: SectionRow[] = [];
  let summary: Summary | null = null;
  let measurements: Measurement | null = null;
  let cardiology: any = null;
  let radiology: any = null;
  if (exam) {
    const [{ data: s }, { data: ms }, { data: mm }, { data: card }, { data: rad }] =
      await Promise.all([
        localDataApi.from("exam_sections").select("*").eq("exam_id", exam.id),
        localDataApi.from("medical_summary").select("*").eq("exam_id", exam.id).maybeSingle(),
        localDataApi.from("medical_measurements").select("*").eq("exam_id", exam.id).maybeSingle(),
        localDataApi.from("exam_cardiology").select("*").eq("exam_id", exam.id).maybeSingle(),
        localDataApi.from("exam_radiology").select("*").eq("exam_id", exam.id).maybeSingle(),
      ]);
    sections = s ?? [];
    summary = ms;
    measurements = mm;
    cardiology = card;
    radiology = rad;
  }
  return {
    selection: selection!,
    candidate,
    exam,
    sections,
    summary,
    measurements,
    cardiology,
    radiology,
  };
}

function sectionsBySection(b: CandidateBundle, key: string): SectionRow | undefined {
  return b.sections.find((s) => s.section_key === key);
}

function drawSectionPage(doc: jsPDF, b: CandidateBundle, key: string, title: string) {
  drawHeader(doc, b.selection, { confidential: true });
  doc.setFont(FONT, "bold");
  doc.setFontSize(11);
  doc.text(`LEMBAR PEMERIKSAAN — ${title.toUpperCase()}`, 15, 50);

  const y = drawIdentityBlock(doc, b, 54);
  const section = sectionsBySection(b, key);

  const rows: [string, string][] = [
    ["Status", safe(section?.section_status, "Belum diisi")],
    ["Klasifikasi", safe(section?.classification, "-")],
    ["Tanggal Pemeriksaan", fmtDate(section?.examined_at)],
  ];

  if (key === "pemeriksaan_umum" && b.measurements) {
    rows.push(
      ["Tinggi Badan (cm)", safe(b.measurements.height_cm)],
      ["Berat Badan (kg)", safe(b.measurements.weight_kg)],
      ["IMT / BMI", safe(b.measurements.bmi)],
      ["Klasifikasi IMT", safe(b.measurements.bmi_classification)],
      ["LP (cm)", safe(b.measurements.chest_or_waist_lp)],
    );
  }

  autoTable(doc, {
    startY: y,
    margin: { left: 15, right: 15 },
    theme: "grid",
    styles: { fontSize: 9, font: FONT, cellPadding: 1.5 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 60, fillColor: [245, 245, 245] },
      1: { cellWidth: "auto" },
    },
    body: rows,
  });

  let cur = (doc as any).lastAutoTable.finalY + 4;
  const block = (label: string, text: string) => {
    doc.setFont(FONT, "bold");
    doc.setFontSize(9);
    doc.text(label, 15, cur);
    cur += 4;
    doc.setFont(FONT, "normal");
    const lines = doc.splitTextToSize(text || "Belum diisi", 180);
    doc.text(lines, 15, cur);
    cur += lines.length * 4 + 4;
  };
  block("TEMUAN / HASIL PEMERIKSAAN", safe(section?.findings, "Belum diisi"));
  block("CATATAN PEMERIKSA", safe(section?.notes, "-"));

  // Signature block
  const h = doc.internal.pageSize.getHeight();
  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  const sigY = Math.max(cur + 10, h - 45);
  doc.text(
    `${safe(b.selection.location, "..............")}, ${fmtDate(section?.examined_at) === "-" ? "....................." : fmtDate(section?.examined_at)}`,
    140,
    sigY,
  );
  doc.text("Pemeriksa,", 140, sigY + 6);
  doc.text("(...................................)", 140, sigY + 30);
}

function drawConsentPage(doc: jsPDF, b: CandidateBundle) {
  drawHeader(doc, b.selection, { confidential: true });
  doc.setFont(FONT, "bold");
  doc.setFontSize(12);
  doc.text("SURAT PERNYATAAN", doc.internal.pageSize.getWidth() / 2, 50, {
    align: "center",
  });
  drawIdentityBlock(doc, b, 56);
  const cur = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  const body = `Menyatakan bersedia untuk dilakukan pemeriksaan kesehatan sesuai standar pemeriksaan kesehatan bagi calon anggota TNI AU yang akan melaksanakan pemeriksaan kesehatan ${safe(b.selection.name)} dan setuju atas keputusan yang diambil oleh panitia kesehatan.`;
  const lines = doc.splitTextToSize(body, 180);
  doc.text(lines, 15, cur);
  const sigY = cur + lines.length * 5 + 16;
  doc.text(
    `${safe(b.selection.location, "..............")}, ${new Date().toLocaleDateString("id-ID")}`,
    140,
    sigY,
  );
  doc.text("Yang menyatakan,", 140, sigY + 6);
  doc.text(`(${safe(b.candidate.full_name)})`, 140, sigY + 32);
}

function drawResumePage(doc: jsPDF, b: CandidateBundle) {
  drawHeader(doc, b.selection, { confidential: true });
  doc.setFont(FONT, "bold");
  doc.setFontSize(12);
  doc.text("RESUME HASIL PEMERIKSAAN", doc.internal.pageSize.getWidth() / 2, 50, {
    align: "center",
  });
  let y = drawIdentityBlock(doc, b, 56);

  const s = b.summary ?? {};
  const ex = b.exam ?? {};
  autoTable(doc, {
    startY: y,
    margin: { left: 15, right: 15 },
    theme: "grid",
    styles: { fontSize: 9, font: FONT, cellPadding: 1.5 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 60, fillColor: [245, 245, 245] },
      1: { cellWidth: "auto" },
    },
    body: [
      ["KESUM", safe(s.kesum_classification ?? ex.kesum_classification, "-")],
      ["KESWA", safe(s.keswa_status ?? ex.keswa_status, "-")],
      ["Hasil Akhir", safe(s.final_result ?? ex.final_result, "-")],
      ["Nilai Akhir", safe(s.final_score ?? ex.final_score, "-")],
      [
        "Jumlah B / C / K1 / K2",
        `${safe(s.count_b, "0")} / ${safe(s.count_c, "0")} / ${safe(s.count_k1, "0")} / ${safe(s.count_k2, "0")}`,
      ],
      ["Status Pemeriksaan", safe(ex.exam_status, "-")],
      ["Difinalisasi", ex.finalized_at ? `${fmtDate(ex.finalized_at)}` : "Belum"],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  const block = (label: string, text: string) => {
    doc.setFont(FONT, "bold");
    doc.setFontSize(9);
    doc.text(label, 15, y);
    y += 4;
    doc.setFont(FONT, "normal");
    const lines = doc.splitTextToSize(text || "-", 180);
    doc.text(lines, 15, y);
    y += lines.length * 4 + 4;
  };
  block("KETERANGAN K1", safe(s.k1_notes, "-"));
  block("KETERANGAN K2 / TMS", safe(s.k2_notes, "-"));
  block("ATENSI", safe(s.attention_notes, "-"));
  block("SARAN", safe(s.suggestions, "-"));
}

function fileName(b: CandidateBundle, kind: string): string {
  const safeName = (b.candidate.full_name || "PESERTA")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .toUpperCase();
  const t = (b.candidate.test_number || "000").replace(/[^a-zA-Z0-9]+/g, "");
  const sel = (b.selection.name || "SELEKSI").replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase();
  return `RIKKES_${kind}_${safeName}_${t}_${sel}.pdf`;
}

async function recordExport(args: {
  selection_id: string;
  candidate_id?: string;
  exam_id?: string;
  document_type: string;
  file_name: string;
  status?: string;
  error?: string;
  filter?: any;
}) {
  const { data: u } = await localDataApi.auth.getUser();
  await localDataApi.from("document_exports").insert({
    selection_id: args.selection_id,
    candidate_id: args.candidate_id ?? null,
    exam_id: args.exam_id ?? null,
    export_type: "PDF",
    document_type: args.document_type,
    file_name: args.file_name,
    status: args.status ?? "success",
    error_message: args.error ?? null,
    filter_json: args.filter ?? null,
    exported_by: u.user?.id ?? null,
  });
}

// ------- Public entry points -------

const SECTION_TITLES: Record<string, string> = Object.fromEntries(
  SECTIONS.map((s) => [s.key, s.name]),
);

export async function exportSectionPDF(candidateId: string, sectionKey: string): Promise<void> {
  const b = await loadBundle(candidateId);
  if (!b) throw new Error("Peserta tidak ditemukan");
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  drawSectionPage(doc, b, sectionKey, SECTION_TITLES[sectionKey] ?? sectionKey);
  if (sectionKey === "ekg_ergo") {
    const atts = Array.isArray(b.cardiology?.attachments_json)
      ? b.cardiology!.attachments_json
      : [];
    await drawAttachmentPages(doc, b, "EKG / Ergo", atts);
  } else if (sectionKey === "radiologi_ro") {
    const atts = Array.isArray(b.radiology?.attachments_json) ? b.radiology!.attachments_json : [];
    await drawAttachmentPages(doc, b, "Rontgen", atts);
  }
  stampWatermarks(doc, draftWatermarks(b));
  drawFooter(doc);
  const f = fileName(b, sectionKey.toUpperCase());
  doc.save(f);
  await recordExport({
    selection_id: b.selection.id,
    candidate_id: b.candidate.id,
    exam_id: b.exam?.id,
    document_type: `section:${sectionKey}`,
    file_name: f,
  });
}

export async function exportConsentPDF(candidateId: string): Promise<void> {
  const b = await loadBundle(candidateId);
  if (!b) throw new Error("Peserta tidak ditemukan");
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  drawConsentPage(doc, b);
  stampWatermarks(doc, draftWatermarks(b));
  drawFooter(doc);
  const f = fileName(b, "SURAT_PERNYATAAN");
  doc.save(f);
  await recordExport({
    selection_id: b.selection.id,
    candidate_id: b.candidate.id,
    exam_id: b.exam?.id,
    document_type: "consent",
    file_name: f,
  });
}

export async function exportResumePDF(candidateId: string): Promise<void> {
  const b = await loadBundle(candidateId);
  if (!b) throw new Error("Peserta tidak ditemukan");
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  drawResumePage(doc, b);
  stampWatermarks(doc, draftWatermarks(b));
  drawFooter(doc);
  const f = fileName(b, "RESUME");
  doc.save(f);
  await recordExport({
    selection_id: b.selection.id,
    candidate_id: b.candidate.id,
    exam_id: b.exam?.id,
    document_type: "resume",
    file_name: f,
  });
}

export async function exportFullPackagePDF(candidateId: string): Promise<void> {
  const b = await loadBundle(candidateId);
  if (!b) throw new Error("Peserta tidak ditemukan");
  const doc = new jsPDF({ format: "a4", unit: "mm" });

  // Cover: Resume
  drawResumePage(doc, b);

  // Consent
  doc.addPage();
  drawConsentPage(doc, b);

  // All medical sections
  for (const s of SECTIONS) {
    if (s.key === "identitas" || s.key === "surat_pernyataan" || s.key === "resume_kesimpulan")
      continue;
    doc.addPage();
    drawSectionPage(doc, b, s.key, s.name);
  }

  // Lampiran gambar EKG & Rontgen
  const ekgAtts = Array.isArray(b.cardiology?.attachments_json)
    ? b.cardiology!.attachments_json
    : [];
  await drawAttachmentPages(doc, b, "EKG / Ergo", ekgAtts);
  const roAtts = Array.isArray(b.radiology?.attachments_json) ? b.radiology!.attachments_json : [];
  await drawAttachmentPages(doc, b, "Rontgen", roAtts);

  stampWatermarks(doc, draftWatermarks(b));
  drawFooter(doc);
  const f = fileName(b, "PAKET_LENGKAP");
  doc.save(f);
  await recordExport({
    selection_id: b.selection.id,
    candidate_id: b.candidate.id,
    exam_id: b.exam?.id,
    document_type: "full_package",
    file_name: f,
  });
}

// ------- Mass recap PDF -------

export interface RekapPdfRow {
  no: number;
  test_number?: string | null;
  full_name: string;
  pok_korp?: string | null;
  panda?: string | null;
  kesum?: string | null;
  keswa?: string | null;
  final_result?: string | null;
  final_score?: number | null;
  k1_notes?: string | null;
  k2_notes?: string | null;
}

export async function exportRekapMassalPDF(
  selectionId: string,
  rows: RekapPdfRow[],
  options: { title?: string; documentType?: string; filter?: any } = {},
): Promise<void> {
  const { data: selection } = await localDataApi
    .from("selections")
    .select("*")
    .eq("id", selectionId)
    .single();
  if (!selection) throw new Error("Seleksi tidak ditemukan");

  const doc = new jsPDF({ orientation: "landscape", format: "a4", unit: "mm" });
  drawHeader(doc, selection as Selection, {
    confidential: true,
    subtitle: options.title ?? "REKAP HASIL PEMERIKSAAN",
  });

  autoTable(doc, {
    startY: 48,
    margin: { left: 10, right: 10 },
    theme: "grid",
    headStyles: { fillColor: [30, 60, 110], textColor: 255, fontSize: 8 },
    styles: { fontSize: 8, font: FONT, cellPadding: 1.2 },
    head: [
      [
        "No",
        "No Test",
        "Nama",
        "Pok",
        "Panda",
        "KESUM",
        "KESWA",
        "Hasil",
        "Nilai",
        "Ket. K1",
        "Ket. K2/TMS",
      ],
    ],
    body: rows.map((r) => [
      r.no,
      safe(r.test_number),
      safe(r.full_name),
      safe(r.pok_korp),
      safe(r.panda),
      safe(r.kesum),
      safe(r.keswa),
      safe(r.final_result),
      safe(r.final_score),
      safe(r.k1_notes, "-"),
      safe(r.k2_notes, "-"),
    ]),
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 18 },
      2: { cellWidth: 45 },
      3: { cellWidth: 18 },
      4: { cellWidth: 18 },
      5: { cellWidth: 18 },
      6: { cellWidth: 18 },
      7: { cellWidth: 16 },
      8: { cellWidth: 14 },
      9: { cellWidth: 50 },
      10: { cellWidth: 50 },
    },
    didDrawPage: () => {
      drawHeader(doc, selection as Selection, {
        confidential: true,
        subtitle: options.title ?? "REKAP HASIL PEMERIKSAAN",
      });
    },
  });

  drawFooter(doc);
  const docType = options.documentType ?? "rekap";
  const f = `RIKKES_${docType.toUpperCase()}_${(selection.name || "SELEKSI")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .toUpperCase()}.pdf`;
  doc.save(f);
  await recordExport({
    selection_id: selectionId,
    document_type: docType,
    file_name: f,
    filter: options.filter ?? null,
  });
}
