import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ResumeCandidate = {
  id: string;
  test_number: string | null;
  full_name: string;
  rank: string | null;
  nrp_nip: string | null;
  pok_korp: string | null;
  panda: string | null;
  generation?: string | null;
  unit_position: string | null;
  birth_place?: string | null;
  birth_date?: string | null;
  gender?: string | null;
};
export type ResumeExam = {
  exam_status?: string | null;
  progress_percentage?: number | null;
  kesum_classification: string | null;
  keswa_status: string | null;
  final_result: string | null;
  final_score: number | null;
  finalized_at?: string | null;
};
export type ResumeMM = {
  height_cm: number | null;
  weight_kg: number | null;
  bmi: number | null;
  bmi_classification: string | null;
  chest_or_waist_lp: number | null;
  min_ideal_weight?: number | null;
  max_ideal_weight?: number | null;
};
export type ResumeMS = {
  count_b: number;
  count_c: number;
  count_k1: number;
  count_k2: number;
  k1_notes: string | null;
  k2_notes: string | null;
  attention_notes: string | null;
  parade_notes: string | null;
  suggestions: string | null;
  initial_result: string | null;
  after_parade_result: string | null;
  rakor_result: string | null;
  pra_pantukhir_result: string | null;
};
export type ResumeSection = {
  section_key: string;
  section_name: string;
  classification: string | null;
  findings: string | null;
  notes: string | null;
};
export type ResumeHeader = {
  line1?: string | null;
  line2?: string | null;
  selectionLabel?: string | null;
};

const DEFAULT_KEY_SECTIONS = [
  "anamnesa", "pemeriksaan_umum", "tanda_vital", "penyakit_dalam", "ekg_ergo", "paru",
  "neurologi", "obsgyn", "kulit", "laboratorium", "radiologi_ro", "usg", "tht", "bedah",
  "atas", "bawah", "audio_tympano", "mata", "gigi", "jiwa_keswa",
];

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }); }
  catch { return d; }
}

export function buildCandidateResumePdf(opts: {
  candidate: ResumeCandidate;
  exam?: ResumeExam | null;
  mm?: ResumeMM | null;
  ms?: ResumeMS | null;
  sections?: Record<string, ResumeSection> | ResumeSection[];
  header?: ResumeHeader;
  keySections?: string[];
}): jsPDF {
  const { candidate: c, exam, mm, ms, header, keySections = DEFAULT_KEY_SECTIONS } = opts;
  const sectionsArr: ResumeSection[] = Array.isArray(opts.sections)
    ? opts.sections
    : Object.values(opts.sections ?? {});
  const sectionsByKey = new Map(sectionsArr.map((s) => [s.section_key, s]));

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 12;
  const headerL1 = header?.line1 ?? "TNI ANGKATAN UDARA";
  const headerL2 = header?.line2 ?? "";
  const selLabel = header?.selectionLabel ?? "";

  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text(headerL1, pageW / 2, y, { align: "center" }); y += 5;
  if (headerL2) { doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.text(headerL2, pageW / 2, y, { align: "center" }); y += 5; }
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text("RESUME CASIS", pageW / 2, y + 2, { align: "center" }); y += 7;
  if (selLabel) { doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(selLabel, pageW / 2, y, { align: "center" }); y += 6; }

  autoTable(doc, {
    startY: y,
    theme: "grid", styles: { fontSize: 8, cellPadding: 1.5 },
    head: [["Identitas", ""]],
    body: [
      ["No Tes", c.test_number ?? "—"],
      ["Nama", c.full_name],
      ["Pangkat / NRP", `${c.rank ?? "—"} / ${c.nrp_nip ?? "—"}`],
      ["Pok/Korp / Panda", `${c.pok_korp ?? "—"} / ${c.panda ?? "—"}`],
      ["Unit/Jabatan", c.unit_position ?? "—"],
      ["TTL", `${c.birth_place ?? "—"}, ${fmtDate(c.birth_date)}`],
      ["Jenis Kelamin", c.gender ?? "—"],
      ["Generasi", c.generation ?? "—"],
    ],
  });
  autoTable(doc, {
    theme: "grid", styles: { fontSize: 8, cellPadding: 1.5 },
    head: [["Antropometri", "", "Status Ujian", ""]],
    body: [
      ["TB", mm?.height_cm ? `${mm.height_cm} cm` : "—", "Status", exam?.exam_status ?? "—"],
      ["BB", mm?.weight_kg ? `${mm.weight_kg} kg` : "—", "Progress", exam?.progress_percentage != null ? `${exam.progress_percentage}%` : "—"],
      ["BMI", mm?.bmi != null ? `${mm.bmi} (${mm.bmi_classification ?? "—"})` : "—", "KESUM", exam?.kesum_classification ?? "—"],
      ["LP", mm?.chest_or_waist_lp ? `${mm.chest_or_waist_lp} cm` : "—", "KESWA", exam?.keswa_status ?? "—"],
      ["BB Ideal", (mm?.min_ideal_weight && mm?.max_ideal_weight) ? `${mm.min_ideal_weight}–${mm.max_ideal_weight} kg` : "—", "Hasil Akhir", exam?.final_result ?? "—"],
      ["", "", "Skor", exam?.final_score != null ? String(exam.final_score) : "—"],
    ],
  });
  autoTable(doc, {
    theme: "grid", styles: { fontSize: 8, cellPadding: 1.5 },
    head: [["Rekap Klasifikasi", "B", "C", "K1", "K2"]],
    body: [["Jumlah", String(ms?.count_b ?? 0), String(ms?.count_c ?? 0), String(ms?.count_k1 ?? 0), String(ms?.count_k2 ?? 0)]],
  });
  autoTable(doc, {
    theme: "grid", styles: { fontSize: 8, cellPadding: 1.5 },
    head: [["Tahap", "Hasil"]],
    body: [
      ["Laporan 1 (Awal)", ms?.initial_result ?? "—"],
      ["Setelah Parade", ms?.after_parade_result ?? "—"],
      ["Rakor", ms?.rakor_result ?? "—"],
      ["Pra Pantukhir", ms?.pra_pantukhir_result ?? "—"],
      ["Hasil Akhir", exam?.final_result ?? "—"],
    ],
  });

  const findings = keySections
    .map((k) => sectionsByKey.get(k))
    .filter((s): s is ResumeSection => !!s && ((!!s.classification && s.classification !== "B") || !!s.findings));
  if (findings.length) {
    autoTable(doc, {
      theme: "grid", styles: { fontSize: 8, cellPadding: 1.5 },
      head: [["Section", "Klas", "Temuan / Catatan"]],
      body: findings.map((s) => [s.section_name, s.classification ?? "—", [s.findings, s.notes].filter(Boolean).join(" — ") || "—"]),
    });
  }

  const notes: [string, string][] = [];
  if (ms?.k2_notes) notes.push(["Catatan K2", ms.k2_notes]);
  if (ms?.k1_notes) notes.push(["Catatan K1", ms.k1_notes]);
  if (ms?.attention_notes) notes.push(["Perhatian", ms.attention_notes]);
  if (ms?.parade_notes) notes.push(["Parade", ms.parade_notes]);
  if (ms?.suggestions) notes.push(["Saran", ms.suggestions]);
  if (notes.length) {
    autoTable(doc, {
      theme: "grid", styles: { fontSize: 8, cellPadding: 1.5 },
      head: [["Catatan", ""]],
      body: notes,
    });
  }
  return doc;
}

export function candidateResumeFilename(c: ResumeCandidate): string {
  const safe = (c.full_name || "casis").replace(/[^a-zA-Z0-9_\- ]/g, "").trim().replace(/\s+/g, "_");
  return `${c.test_number ?? "NO-TEST"}_${safe}.pdf`;
}

export function downloadCandidateResumePdf(opts: Parameters<typeof buildCandidateResumePdf>[0]): void {
  const doc = buildCandidateResumePdf(opts);
  doc.save(candidateResumeFilename(opts.candidate));
}