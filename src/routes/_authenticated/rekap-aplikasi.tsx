import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { localDataApi } from "@/lib/localDataApi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle, ExternalLink, RefreshCw, Save, Search, Settings2, Flag, FileSpreadsheet, FileText, Files, FileDown } from "lucide-react";
import { logAudit } from "@/lib/audit";
import { recalculateExamSummary } from "@/lib/rikkes-calculations";
import { ExportDialog } from "@/components/export/ExportDialog";
import { STATUS_BADGES } from "@/lib/sections";
import { TableExportMenu } from "@/components/export/TableExportMenu";
import { useAuth } from "@/lib/use-auth";
import { backfillRekapSync } from "@/lib/rekap-backfill";
import { downloadCandidateResumeById } from "@/lib/candidate-resume-fetch";
import { PROGRESS_STATUS_LABEL, PROGRESS_STATUS_CLASS, type ProgressItemStatus } from "@/lib/candidate-progress";

export const Route = createFileRoute("/_authenticated/rekap-aplikasi")({
  component: RekapAplikasiPage,
});

// ---------------- Types ----------------
type Sel = { id: string; name: string; year_label: string };
type Cand = {
  id: string; selection_id: string; serial_number: number | null; test_number: string | null;
  pok_korp: string | null; panda: string | null; full_name: string; rank: string | null;
  nrp_nip: string | null; generation: string | null; unit_position: string | null;
  birth_place: string | null; birth_date: string | null; combined_identity: string | null;
};
type Exam = {
  id: string; candidate_id: string; selection_id: string; exam_status: string;
  progress_percentage: number; kesum_classification: string | null; keswa_status: string | null;
  final_result: string | null; final_score: number | null;
};
type Section = {
  exam_id: string; candidate_id: string; section_key: string; section_name: string;
  section_status: string; classification: string | null; findings: string | null; notes: string | null;
};
type MM = {
  exam_id: string; candidate_id: string; height_cm: number | null; weight_kg: number | null;
  bmi: number | null; bmi_classification: string | null; chest_or_waist_lp: number | null;
  weight_difference: number | null; min_ideal_weight: number | null; max_ideal_weight: number | null;
};
type MS = {
  id: string; exam_id: string; candidate_id: string;
  count_b: number; count_c: number; count_k1: number; count_k2: number;
  kesum_classification: string | null; keswa_status: string | null;
  final_result: string | null; final_score: number | null;
  k1_notes: string | null; k2_notes: string | null;
  attention_notes: string | null; parade_notes: string | null; suggestions: string | null;
  initial_result: string | null; after_parade_result: string | null;
  rakor_result: string | null; pra_pantukhir_result: string | null;
  updated_at?: string | null;
};
type Row = {
  candidate: Cand; exam?: Exam; mm?: MM; ms?: MS;
  sections: Record<string, Section>;
  count_th: number;
  issues: string[];
  validation: string[];
  last_sync_at: string | null;
};

// ---------------- Constants ----------------
const SECTION_COLS: { key: string; label: string }[] = [
  { key: "anamnesa", label: "Anamnesa" },
  { key: "penyakit_dalam", label: "Tensi/Nadi/Penyakit Dalam" },
  { key: "ekg_ergo", label: "EKG/Ergo" },
  { key: "paru", label: "Paru FVC/FEV1" },
  { key: "neurologi", label: "Neurologi" },
  { key: "obsgyn", label: "Obsgyn" },
  { key: "kulit", label: "Kulit" },
  { key: "laboratorium", label: "Lab" },
  { key: "radiologi_ro", label: "RO" },
  { key: "usg", label: "USG" },
  { key: "tht", label: "THT" },
  { key: "bedah", label: "Bedah" },
];
const DUAL_COLS: { key: string; label: string }[] = [
  { key: "atas", label: "Atas" },
  { key: "bawah", label: "Bawah" },
  { key: "audio_tympano", label: "Audio/Tympano" },
  { key: "mata", label: "Mata" },
  { key: "gigi", label: "Gigi" },
  { key: "jiwa_keswa", label: "Jiwa" },
];

// ============== XLS-style column structure ==============
// Mirror sheet APLIKASI from RIKKES workbook.
type ColDef = { key: string; label: string; min?: number; align?: "left" | "center" };
type Grp = { key: string; label: string; cols: ColDef[]; helper?: boolean };

const XLS_GROUPS: Grp[] = [
  { key: "umum", label: "UMUM / ANTROPOMETRI", cols: [
    { key: "tbbb", label: "TB / BB", min: 70, align: "center" },
    { key: "sel", label: "Selisih", min: 60, align: "center" },
    { key: "imt", label: "IMT", min: 60, align: "center" },
    { key: "lp", label: "LP", min: 55, align: "center" },
    { key: "scr", label: "Klasifikasi Screening", min: 90, align: "center" },
  ]},
  { key: "anam", label: "ANAMNESA & PEM. UMUM", cols: [
    { key: "anamnesa", label: "Anamnesa", min: 130 },
    { key: "penyakit_dalam", label: "Tensi/Nadi/Peny. Dalam", min: 130 },
    { key: "ket_umum", label: "Keterangan Umum", min: 130 },
    { key: "cls_umum", label: "Klasifikasi Umum", min: 90, align: "center" },
  ]},
  { key: "ekg", label: "EKG / ERGO", cols: [
    { key: "ekg_hasil", label: "Hasil EKG", min: 130 },
    { key: "ekg_status", label: "Status EKG", min: 90, align: "center" },
    { key: "ekg_cls", label: "Klasifikasi EKG", min: 90, align: "center" },
  ]},
  { key: "rad", label: "PARU / RONTGEN / USG", cols: [
    { key: "paru", label: "Paru FVC / FEV1", min: 110 },
    { key: "ro", label: "Rontgen / RO", min: 130 },
    { key: "usg", label: "USG", min: 130 },
    { key: "rad_cls", label: "Klasifikasi Radiologi", min: 100, align: "center" },
  ]},
  { key: "neuro", label: "NEUROLOGI", cols: [
    { key: "neuro_hasil", label: "Hasil Neurologi", min: 130 },
    { key: "neuro_cls", label: "Klasifikasi Neurologi", min: 100, align: "center" },
  ]},
  { key: "lab", label: "LABORATORIUM", cols: [
    { key: "lab_hema", label: "Hematologi", min: 110 },
    { key: "lab_urin", label: "Urinalisa", min: 110 },
    { key: "lab_kimia", label: "Kimia Darah", min: 110 },
    { key: "lab_narko", label: "Narkoba", min: 90 },
    { key: "lab_kesimp", label: "Kesimpulan Lab", min: 130 },
    { key: "lab_cls", label: "Klasifikasi Lab", min: 90, align: "center" },
  ]},
  { key: "tht", label: "THT", cols: [
    { key: "tht_hasil", label: "Hasil THT", min: 130 },
    { key: "tht_bisik", label: "Suara Bisikan AD/AS", min: 110, align: "center" },
    { key: "tht_cls", label: "Klasifikasi THT", min: 90, align: "center" },
  ]},
  { key: "bedah", label: "BEDAH", cols: [
    { key: "bedah_hasil", label: "Hasil Bedah", min: 130 },
    { key: "bedah_cls", label: "Klasifikasi Bedah", min: 90, align: "center" },
  ]},
  { key: "mata", label: "MATA", cols: [
    { key: "mata_visus", label: "Visus OD/OS", min: 110, align: "center" },
    { key: "mata_kor", label: "Koreksi OD/OS", min: 110, align: "center" },
    { key: "mata_peri", label: "Perimetri", min: 90, align: "center" },
    { key: "mata_iop", label: "IOP", min: 70, align: "center" },
    { key: "mata_cls", label: "Klasifikasi Mata", min: 90, align: "center" },
  ]},
  { key: "gigi", label: "GIGI", cols: [
    { key: "gigi_dmft", label: "DMF-T", min: 70, align: "center" },
    { key: "gigi_odon", label: "Odontogram", min: 130 },
    { key: "gigi_kesimp", label: "Kesimpulan Gigi", min: 130 },
    { key: "gigi_cls", label: "Klasifikasi Gigi", min: 90, align: "center" },
  ]},
  { key: "keswa", label: "KESWA", cols: [
    { key: "keswa_anam", label: "Anamnesa Keswa", min: 130 },
    { key: "keswa_prib", label: "Kepribadian", min: 110 },
    { key: "keswa_cerd", label: "Kecerdasan", min: 100, align: "center" },
    { key: "keswa_kesimp", label: "Kesimpulan Keswa", min: 130 },
    { key: "keswa_cls", label: "Klasifikasi Keswa", min: 90, align: "center" },
  ]},
  { key: "stakes", label: "RUMUS STAKES", cols: [
    { key: "st_u", label: "U", min: 40, align: "center" },
    { key: "st_a", label: "A", min: 40, align: "center" },
    { key: "st_b", label: "B", min: 40, align: "center" },
    { key: "st_d", label: "D", min: 40, align: "center" },
    { key: "st_l", label: "L", min: 40, align: "center" },
    { key: "st_g", label: "G", min: 40, align: "center" },
    { key: "st_j", label: "J", min: 40, align: "center" },
  ]},
  { key: "hasil", label: "HASIL", cols: [
    { key: "h_kesum", label: "KESUM", min: 70, align: "center" },
    { key: "h_keswa", label: "KESWA", min: 70, align: "center" },
    { key: "h_akhir", label: "Hasil Akhir", min: 90, align: "center" },
    { key: "h_nilai", label: "Nilai", min: 60, align: "center" },
    { key: "h_ket", label: "Keterangan", min: 160 },
    { key: "h_kesimp", label: "Kesimpulan", min: 160 },
    { key: "h_lulus", label: "Penentuan Kelulusan", min: 110, align: "center" },
  ]},
  { key: "helper", label: "HELPER / OTOMATIS", helper: true, cols: [
    { key: "hp_imt", label: "IMT helper", min: 70, align: "center" },
    { key: "hp_st", label: "Stakes BB/TB", min: 90, align: "center" },
    { key: "hp_bmin", label: "BB min", min: 60, align: "center" },
    { key: "hp_bmax", label: "BB max", min: 60, align: "center" },
    { key: "hp_sel", label: "Selisih BB", min: 70, align: "center" },
    { key: "hp_kode", label: "Kode hasil", min: 80, align: "center" },
    { key: "hp_stat", label: "Status data", min: 90, align: "center" },
  ]},
];

const COMPACT_KEYS = new Set([
  "tbbb","imt","cls_umum","ekg_cls","rad_cls","neuro_cls","lab_cls",
  "tht_cls","bedah_cls","mata_cls","gigi_cls","keswa_cls",
  "h_kesum","h_keswa","h_akhir","h_nilai","h_lulus",
]);
const CLASSIFICATION_KEYS = new Set([
  "cls_umum","ekg_cls","rad_cls","neuro_cls","lab_cls","tht_cls",
  "bedah_cls","mata_cls","gigi_cls","keswa_cls","h_kesum","h_keswa","h_akhir","h_lulus",
]);

// XLS-like dark blue header
const XLS_HEAD_BG = "bg-[#1e3a8a] text-white";
const XLS_HEAD_BG_SUB = "bg-[#1e40af] text-white";
const XLS_BORDER = "border border-slate-400";
const XLS_CELL = "border border-slate-300 px-2 py-1 align-top";
const XLS_GROUP_BG: Record<string, string> = {
  umum: "bg-slate-50",
  anam: "bg-white",
  ekg: "bg-slate-50",
  rad: "bg-white",
  neuro: "bg-slate-50",
  lab: "bg-white",
  tht: "bg-slate-50",
  bedah: "bg-white",
  mata: "bg-slate-50",
  gigi: "bg-white",
  keswa: "bg-slate-50",
  stakes: "bg-amber-50",
  hasil: "bg-emerald-50",
  helper: "bg-violet-50",
};

function classificationRank(v: string | null | undefined): number {
  if (!v) return 99;
  if (v === "K2") return 1;
  if (v === "K1") return 2;
  if (v === "C") return 3;
  if (v === "B") return 4;
  if (v === "TH") return 0;
  return 99;
}

function ClsBadge({ value }: { value: string | null | undefined }) {
  const v = value || "Belum";
  const cls = (STATUS_BADGES as any)[v] || "bg-muted text-muted-foreground border";
  return <Badge className={`${cls} text-[10px] px-1.5 py-0`}>{v}</Badge>;
}
function ResBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted-foreground text-xs">—</span>;
  const cls = (STATUS_BADGES as any)[value] || "bg-muted text-muted-foreground";
  return <Badge className={`${cls} text-[10px]`}>{value}</Badge>;
}
function ExamStatusBadge({ value }: { value: string | null | undefined }) {
  if (!value) return null;
  const cls = (STATUS_BADGES as any)[value] || "bg-muted text-muted-foreground";
  return <Badge className={`${cls} text-[10px]`}>{value}</Badge>;
}

// ---------------- Validation ----------------
function validateRow(r: Row): string[] {
  const out: string[] = [];
  if (!r.exam) { out.push("Tidak ada exam"); return out; }
  if (r.mm?.height_cm && r.mm?.weight_kg && r.mm.bmi) {
    const h = Number(r.mm.height_cm) / 100;
    const expected = +(Number(r.mm.weight_kg) / (h * h)).toFixed(1);
    if (Math.abs(expected - Number(r.mm.bmi)) > 0.3) out.push("BMI tidak sinkron dengan TB/BB");
  }
  if (r.ms && r.exam) {
    if ((r.ms.kesum_classification ?? null) !== (r.exam.kesum_classification ?? null)) out.push("KESUM exam ≠ summary");
    if ((r.ms.final_result ?? null) !== (r.exam.final_result ?? null)) out.push("Hasil exam ≠ summary");
  }
  return out;
}

// ---------------- Page ----------------
function RekapAplikasiPage() {
  const [sels, setSels] = useState<Sel[]>([]);
  const [selId, setSelId] = useState<string>("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [resultF, setResultF] = useState("all");
  const [kesumF, setKesumF] = useState("all");
  const [keswaF, setKeswaF] = useState("all");
  const [pokF, setPokF] = useState("all");
  const [pandaF, setPandaF] = useState("all");
  const [viewMode, setViewMode] = useState<"compact" | "full" | "classification" | "issue">("full");
  const [showHelper, setShowHelper] = useState(false);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [openRow, setOpenRow] = useState<Row | null>(null);
  const [placeholderDlg, setPlaceholderDlg] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, e, s, m, ms, sl] = await Promise.all([
      localDataApi.from("candidates").select("*").is("deleted_at", null).order("serial_number"),
      localDataApi.from("exams").select("*"),
      localDataApi.from("exam_sections").select("exam_id,candidate_id,section_key,section_name,section_status,classification,findings,notes"),
      localDataApi.from("medical_measurements").select("*"),
      localDataApi.from("medical_summary").select("*"),
      localDataApi.from("selections").select("id,name,year_label").order("created_at", { ascending: false }),
    ]);
    const cands = (c.data ?? []) as Cand[];
    const exams = (e.data ?? []) as Exam[];
    const sections = (s.data ?? []) as Section[];
    const mms = (m.data ?? []) as MM[];
    const mss = (ms.data ?? []) as MS[];
    const examByCand = new Map(exams.map((x) => [x.candidate_id, x]));
    const mmByExam = new Map(mms.map((x) => [x.exam_id, x]));
    const msByExam = new Map(mss.map((x) => [x.exam_id, x]));
    const secsByCand = new Map<string, Record<string, Section>>();
    for (const sec of sections) {
      if (!secsByCand.has(sec.candidate_id)) secsByCand.set(sec.candidate_id, {});
      secsByCand.get(sec.candidate_id)![sec.section_key] = sec;
    }
    const built: Row[] = cands.map((cand) => {
      const exam = examByCand.get(cand.id);
      const mm = exam ? mmByExam.get(exam.id) : undefined;
      const ms = exam ? msByExam.get(exam.id) : undefined;
      const secs = secsByCand.get(cand.id) ?? {};
      let count_th = 0;
      const issues: string[] = [];
      for (const k of Object.keys(secs)) {
        const cls = secs[k].classification;
        if (cls === "TH") count_th++;
        if (secs[k].section_status === "Revision") issues.push("Revisi");
      }
      if (exam?.kesum_classification === "K1" || ms?.count_k1) issues.push("K1");
      if (exam?.kesum_classification === "K2" || ms?.count_k2) issues.push("K2");
      if (exam?.final_result === "TMS") issues.push("TMS");
      if (exam?.final_result === "TH") issues.push("TH");
      const row: Row = { candidate: cand, exam, mm, ms, sections: secs, count_th, issues, validation: [], last_sync_at: ms?.updated_at ?? null };
      row.validation = validateRow(row);
      return row;
    });
    setRows(built);
    setSels((sl.data ?? []) as Sel[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date>(() => new Date());
  const { roles } = useAuth();
  const isAdmin = roles.includes("super_admin") || roles.includes("admin") || roles.includes("tester");
  const [backfilling, setBackfilling] = useState(false);
  const autoBackfillRanRef = useRef(false);
  async function runBackfill() {
    if (!confirm("Jalankan backfill rekap untuk seluruh data submitted (mungkin butuh beberapa menit)?")) return;
    setBackfilling(true);
    try {
      const res = await backfillRekapSync({ selectionId: selId === "all" ? null : selId });
      toast.success(`Backfill selesai — ${res.done}/${res.total} ok, ${res.failed} gagal`);
      await logAudit({ action: "backfill_rekap_sync", module: "Rekap APLIKASI", after: { selection_id: selId, ...res } });
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Backfill gagal");
    } finally {
      setBackfilling(false);
    }
  }
  useEffect(() => { if (!loading) setLastRefreshAt(new Date()); }, [loading]);
  useEffect(() => {
    logAudit({ action: "view", module: "Rekap APLIKASI" }).catch(() => {});
  }, []);

  // Auto-backfill silently sekali per session untuk admin bila terdeteksi
  // rikkes_form_sections sudah Submitted tapi medical_summary belum sinkron
  // (rows.exam ada tapi ms tidak ada / progress > 0 tapi kesum kosong).
  useEffect(() => {
    if (loading || autoBackfillRanRef.current || !isAdmin || rows.length === 0) return;
    const needs = rows.some(
      (r) => r.exam && (r.exam.progress_percentage ?? 0) > 0 && !r.ms,
    );
    if (!needs) return;
    autoBackfillRanRef.current = true;
    (async () => {
      try {
        const res = await backfillRekapSync({ selectionId: selId === "all" ? null : selId });
        if (res.done > 0) {
          toast.success(`Auto-sync rekap selesai — ${res.done}/${res.total} diperbarui`);
          await load();
        }
      } catch { /* silent */ }
    })();
  }, [loading, rows, isAdmin, selId, load]);

  // Realtime invalidation: refetch saat rikkes_form_sections / exam_sections / medical_summary berubah
  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => { load(); }, 800);
    };
    const channel = localDataApi
      .channel("rekap-aplikasi-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "rikkes_form_sections" }, trigger)
      .on("postgres_changes", { event: "*", schema: "public", table: "exam_sections" }, trigger)
      .on("postgres_changes", { event: "*", schema: "public", table: "medical_summary" }, trigger)
      .on("postgres_changes", { event: "*", schema: "public", table: "exams" }, trigger)
      .subscribe();
    return () => { if (debounce) clearTimeout(debounce); localDataApi.removeChannel(channel); };
  }, [load]);

  const pokOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.candidate.pok_korp).filter(Boolean))) as string[], [rows]);
  const pandaOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.candidate.panda).filter(Boolean))) as string[], [rows]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (selId !== "all" && r.candidate.selection_id !== selId) return false;
      if (statusF !== "all" && r.exam?.exam_status !== statusF) return false;
      if (resultF !== "all") {
        const fr = r.exam?.final_result ?? "Belum Lengkap";
        if (fr !== resultF) return false;
      }
      if (kesumF !== "all") {
        const v = r.exam?.kesum_classification ?? "Belum Lengkap";
        if (v !== kesumF) return false;
      }
      if (keswaF !== "all") {
        const v = r.exam?.keswa_status ?? "Belum Lengkap";
        if (v !== keswaF) return false;
      }
      if (pokF !== "all" && r.candidate.pok_korp !== pokF) return false;
      if (pandaF !== "all" && r.candidate.panda !== pandaF) return false;
      if (viewMode === "issue") {
        const hasIssue = r.issues.length > 0 || r.exam?.exam_status === "Revision Needed" || !r.exam?.final_result;
        if (!hasIssue) return false;
      }
      if (qq) {
        const hay = [
          r.candidate.full_name, r.candidate.test_number, r.candidate.nrp_nip, r.candidate.rank,
          r.candidate.unit_position, r.candidate.combined_identity,
          ...Object.values(r.sections).map((s) => s.findings ?? ""),
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
  }, [rows, selId, statusF, resultF, kesumF, keswaF, pokF, pandaF, q, viewMode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);

  const summary = useMemo(() => {
    const s = { total: filtered.length, MS: 0, TMS: 0, TH: 0, Belum: 0, kB: 0, kC: 0, kK1: 0, kK2: 0, jMS: 0, jTMS: 0, hasK1: 0, hasK2: 0, pending: 0, revision: 0, finalized: 0 };
    for (const r of filtered) {
      const fr = r.exam?.final_result ?? null;
      if (fr === "MS") s.MS++;
      else if (fr === "TMS") s.TMS++;
      else if (fr === "TH") s.TH++;
      else s.Belum++;
      const kc = r.exam?.kesum_classification;
      if (kc === "B") s.kB++;
      else if (kc === "C") s.kC++;
      else if (kc === "K1") s.kK1++;
      else if (kc === "K2") s.kK2++;
      const kw = r.exam?.keswa_status;
      if (kw === "MS") s.jMS++;
      else if (kw === "TMS") s.jTMS++;
      if ((r.ms?.count_k1 ?? 0) > 0) s.hasK1++;
      if ((r.ms?.count_k2 ?? 0) > 0) s.hasK2++;
      if (r.exam?.exam_status === "Pending Review") s.pending++;
      else if (r.exam?.exam_status === "Revision Needed") s.revision++;
      else if (r.exam?.exam_status === "Finalized") s.finalized++;
    }
    return s;
  }, [filtered]);

  function resetFilters() {
    setQ(""); setSelId("all"); setStatusF("all"); setResultF("all");
    setKesumF("all"); setKeswaF("all"); setPokF("all"); setPandaF("all");
  }

  async function handleRecalculate(r: Row) {
    if (!r.exam) return;
    const t = toast.loading("Menghitung ulang…");
    try {
      await recalculateExamSummary(r.exam.id);
      await logAudit({ action: "recalculate_from_rekap", module: "Rekap APLIKASI", record_id: r.exam.id, candidate_id: r.candidate.id });
      toast.success("Recalculated", { id: t });
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal", { id: t });
    }
  }

  async function handleMarkReview(r: Row, reason: string) {
    const { data: u } = await localDataApi.auth.getUser();
    if (!u.user) return;
    const { error } = await localDataApi.from("review_marks").insert({
      candidate_id: r.candidate.id, exam_id: r.exam?.id ?? null,
      marked_by: u.user.id, reason, status: "open",
    });
    if (error) { toast.error(error.message); return; }
    await logAudit({ action: "mark_for_review", module: "Rekap APLIKASI", candidate_id: r.candidate.id, after: { reason } });
    toast.success("Ditandai untuk review");
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Rekap APLIKASI</h1>
            <p className="text-sm text-muted-foreground">Tampilan workbook lintas peserta — sumber data untuk export XLSX.</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Data live (termasuk section yang sudah Submitted meski peserta belum Finalized). Terakhir diperbarui: <b>{lastRefreshAt.toLocaleTimeString("id-ID")}</b>
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={runBackfill} disabled={backfilling}>
                <RefreshCw className={`h-4 w-4 mr-1 ${backfilling ? "animate-spin" : ""}`} />
                {backfilling ? "Backfill…" : "Backfill Data Lama"}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => { setExportOpen(true); logAudit({ action: "export_xlsx_open", module: "Rekap APLIKASI", after: { selection_id: selId } }).catch(() => {}); }}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Export XLSX
            </Button>
            <TableExportMenu<Row>
              data={filtered}
              filename="rekap_aplikasi"
              title="Rekap APLIKASI"
              columns={[
                { key: "test_number", label: "No Tes", accessor: (r) => r.candidate.test_number ?? "" },
                { key: "full_name", label: "Nama", accessor: (r) => r.candidate.full_name },
                { key: "rank", label: "Pangkat", accessor: (r) => r.candidate.rank ?? "" },
                { key: "nrp_nip", label: "NRP/NIP", accessor: (r) => r.candidate.nrp_nip ?? "" },
                { key: "pok_korp", label: "Pok/Korp", accessor: (r) => r.candidate.pok_korp ?? "" },
                { key: "panda", label: "Panda", accessor: (r) => r.candidate.panda ?? "" },
                { key: "exam_status", label: "Status", accessor: (r) => r.exam?.exam_status ?? "" },
                { key: "kesum", label: "KESUM", accessor: (r) => r.exam?.kesum_classification ?? "" },
                { key: "keswa", label: "KESWA", accessor: (r) => r.exam?.keswa_status ?? "" },
                { key: "final_result", label: "Hasil", accessor: (r) => r.exam?.final_result ?? "" },
                { key: "final_score", label: "Skor", accessor: (r) => r.exam?.final_score ?? "" },
                { key: "count_b", label: "B", accessor: (r) => r.ms?.count_b ?? 0 },
                { key: "count_c", label: "C", accessor: (r) => r.ms?.count_c ?? 0 },
                { key: "count_k1", label: "K1", accessor: (r) => r.ms?.count_k1 ?? 0 },
                { key: "count_k2", label: "K2", accessor: (r) => r.ms?.count_k2 ?? 0 },
                { key: "count_th", label: "TH", accessor: (r) => r.count_th },
              ]}
            />
            <Button variant="outline" size="sm" onClick={() => setPlaceholderDlg("Generate Laporan 1 / Resume Casis")}>
              <Files className="h-4 w-4 mr-1" /> Generate Laporan
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
              <div className="lg:col-span-2 relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8 h-9" placeholder="Cari nama, tes, NRP, temuan…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <Sel v={selId} on={setSelId} opts={[{ v: "all", l: "Semua Seleksi" }, ...sels.map((s) => ({ v: s.id, l: `${s.name} — ${s.year_label}` }))]} />
              <Sel v={statusF} on={setStatusF} opts={[{ v: "all", l: "Status: Semua" }, ...["In Progress", "Pending Review", "Revision Needed", "Finalized"].map((x) => ({ v: x, l: x }))]} />
              <Sel v={resultF} on={setResultF} opts={[{ v: "all", l: "Hasil: Semua" }, ...["MS", "TMS", "TH", "Belum Lengkap"].map((x) => ({ v: x, l: x }))]} />
              <Sel v={kesumF} on={setKesumF} opts={[{ v: "all", l: "KESUM: Semua" }, ...["B", "C", "K1", "K2", "Belum Lengkap"].map((x) => ({ v: x, l: x }))]} />
              <Sel v={keswaF} on={setKeswaF} opts={[{ v: "all", l: "KESWA: Semua" }, ...["MS", "TMS", "TH", "Belum Lengkap"].map((x) => ({ v: x, l: x }))]} />
              <Sel v={pokF} on={setPokF} opts={[{ v: "all", l: "Pok: Semua" }, ...pokOptions.map((x) => ({ v: x, l: x }))]} />
              <Sel v={pandaF} on={setPandaF} opts={[{ v: "all", l: "Panda: Semua" }, ...pandaOptions.map((x) => ({ v: x, l: x }))]} />
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-muted-foreground mr-1">Mode:</span>
                {(["compact", "full", "classification", "issue"] as const).map((m) => (
                  <Button key={m} size="sm" variant={viewMode === m ? "default" : "outline"} className="h-7 text-xs capitalize" onClick={() => setViewMode(m)}>{m}</Button>
                ))}
                <Button size="sm" variant={showHelper ? "default" : "outline"} className="h-7 text-xs ml-2" onClick={() => setShowHelper((v) => !v)}>
                  <Settings2 className="h-3 w-3 mr-1" /> Helper Columns
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={resetFilters}>Reset Filter</Button>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Page size</span>
                <select className="h-7 rounded border bg-background px-2" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                  {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <span className="text-muted-foreground">{filtered.length} peserta</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary bar */}
        <Card>
          <CardContent className="p-3 flex flex-wrap gap-2 text-xs">
            {[
              ["Total", summary.total], ["MS", summary.MS], ["TMS", summary.TMS], ["TH", summary.TH], ["Belum", summary.Belum],
              ["KESUM B", summary.kB], ["KESUM C", summary.kC], ["KESUM K1", summary.kK1], ["KESUM K2", summary.kK2],
              ["KESWA MS", summary.jMS], ["KESWA TMS", summary.jTMS],
              ["Ada K1", summary.hasK1], ["Ada K2", summary.hasK2],
              ["Pending Review", summary.pending], ["Revision", summary.revision], ["Finalized", summary.finalized],
            ].map(([l, v]) => (
              <Badge key={l as string} variant="outline" className="font-normal">
                <span className="text-muted-foreground mr-1">{l}:</span>
                <span className="font-semibold">{v as number}</span>
              </Badge>
            ))}
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden">
          <div className="overflow-auto max-h-[calc(100vh-320px)] border-t border-slate-300">
            <table className="text-[11px] border-collapse w-max font-sans" style={{ fontFamily: "'Inter','Segoe UI',Arial,sans-serif" }}>
              <XlsHeader viewMode={viewMode} showHelper={showHelper} />
              <tbody>
                {loading && (
                  <tr><td colSpan={200} className="p-8 text-center text-muted-foreground">Memuat Rekap APLIKASI…</td></tr>
                )}
                {!loading && paged.length === 0 && (
                  <tr><td colSpan={200} className="p-8 text-center text-muted-foreground">Tidak ada data sesuai filter.</td></tr>
                )}
                {paged.map((r, idx) => (
                  <XlsRow
                    key={r.candidate.id}
                    row={r}
                    index={(page - 1) * pageSize + idx + 1}
                    viewMode={viewMode}
                    showHelper={showHelper}
                    zebra={idx % 2 === 1}
                    onOpen={() => setOpenRow(r)}
                    onRecalc={() => handleRecalculate(r)}
                    onMarkReview={(reason) => handleMarkReview(r, reason)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Pagination */}
        <div className="flex items-center justify-end gap-2 text-xs">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <span>Hal. {page} / {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>

        {/* Side Panel */}
        <Sheet open={!!openRow} onOpenChange={(o) => !o && setOpenRow(null)}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            {openRow && (
              <SidePanel row={openRow} onChanged={load} onClose={() => setOpenRow(null)} />
            )}
          </SheetContent>
        </Sheet>

        <Dialog open={!!placeholderDlg} onOpenChange={(o) => !o && setPlaceholderDlg(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{placeholderDlg}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              Fitur export multi-sheet akan dibuat pada Fase 5. Struktur data pada tabel ini sudah siap dipakai sebagai sumber export.
            </p>
            <DialogFooter>
              <Button onClick={() => setPlaceholderDlg(null)}>Mengerti</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <ExportDialog
            open={exportOpen}
            onOpenChange={setExportOpen}
            selectionId={selId}
            selectionLabel={selId === "all" ? "Semua Seleksi" : sels.find((s) => s.id === selId)?.name}
            activeFilters={{
              exam_status: statusF !== "all" ? statusF : undefined,
              final_result: resultF !== "all" ? resultF : undefined,
              kesum_classification: kesumF !== "all" ? kesumF : undefined,
              keswa_status: keswaF !== "all" ? keswaF : undefined,
              pok_korp: pokF !== "all" ? pokF : undefined,
              panda: pandaF !== "all" ? pandaF : undefined,
              search: q || undefined,
            }}
          />
      </div>
    </TooltipProvider>
  );
}

function Sel({ v, on, opts }: { v: string; on: (x: string) => void; opts: { v: string; l: string }[] }) {
  return (
    <select className="h-9 rounded-md border border-input bg-background px-2 text-xs" value={v} onChange={(e) => on(e.target.value)}>
      {opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

// ---------------- XLS-style Header (matches sheet APLIKASI) ----------------
function visibleGroups(viewMode: string, showHelper: boolean): Grp[] {
  return XLS_GROUPS.filter((g) => {
    if (g.helper) return showHelper;
    if (viewMode === "classification") return true;
    return true;
  }).map((g) => {
    if (viewMode === "compact") {
      const cols = g.cols.filter((c) => COMPACT_KEYS.has(c.key));
      return cols.length ? { ...g, cols } : null;
    }
    if (viewMode === "classification") {
      const cols = g.cols.filter((c) => CLASSIFICATION_KEYS.has(c.key));
      return cols.length ? { ...g, cols } : null;
    }
    return g;
  }).filter(Boolean) as Grp[];
}

function XlsHeader({ viewMode, showHelper }: { viewMode: string; showHelper: boolean }) {
  const groups = visibleGroups(viewMode, showHelper);
  const thMain = `sticky top-0 z-20 ${XLS_HEAD_BG} ${XLS_BORDER} px-2 py-1.5 text-center font-bold text-[11px] uppercase tracking-wide whitespace-nowrap`;
  const thSub = `sticky z-20 ${XLS_HEAD_BG_SUB} ${XLS_BORDER} px-2 py-1 text-center font-semibold text-[10px] whitespace-nowrap`;
  const leftSticky = "sticky z-30";
  return (
    <thead>
      {/* Row 1 — Identity group + group banners */}
      <tr style={{ top: 0 }}>
        <th className={`${thMain} ${leftSticky}`} style={{ left: 0 }} rowSpan={2}>URT</th>
        <th className={`${thMain} ${leftSticky}`} style={{ left: 42 }} rowSpan={2}>TES</th>
        <th className={`${thMain} ${leftSticky}`} style={{ left: 92 }} rowSpan={2}>POK</th>
        <th className={`${thMain} ${leftSticky}`} style={{ left: 138 }} rowSpan={2}>PANDA</th>
        <th className={`${thMain} ${leftSticky} text-left`} style={{ left: 194, minWidth: 240 }} rowSpan={2}>NAMA / PANGKAT / NRP / SATUAN</th>
        {groups.map((g) => (
          <th key={g.key} className={thMain} colSpan={g.cols.length}>{g.label}</th>
        ))}
        <th className={`${thMain} sticky right-0 z-30`} rowSpan={2}>AKSI</th>
      </tr>
      <tr style={{ top: 30 }}>
        {groups.flatMap((g) => g.cols.map((c) => (
          <th key={`${g.key}.${c.key}`} className={thSub} style={{ minWidth: c.min }}>{c.label}</th>
        )))}
      </tr>
    </thead>
  );
}

// ---------------- XLS-style single Row per peserta ----------------
function XlsRow({
  row, index, viewMode, showHelper, zebra, onOpen, onRecalc, onMarkReview,
}: {
  row: Row; index: number; viewMode: string; showHelper: boolean; zebra: boolean;
  onOpen: () => void; onRecalc: () => void; onMarkReview: (reason: string) => void;
}) {
  const c = row.candidate;
  const m = row.mm;
  const ex = row.exam;
  const ms = row.ms;
  const groups = visibleGroups(viewMode, showHelper);
  const sect = (k: string) => row.sections[k];
  const find = (k: string) => sect(k)?.findings ?? sect(k)?.notes ?? "";
  const cls = (k: string) => sect(k)?.classification ?? null;
  const sstat = (k: string): string => {
    const s = sect(k)?.section_status;
    const submitted = sect(k)?.section_status === "Submitted";
    if (!s) return "belum";
    if (s === "Locked" || s === "Approved") return "finalized";
    if (s === "Submitted" || submitted) return "selesai";
    if (s === "Revision") return "revised";
    if (s === "Draft") return "berjalan";
    return "belum";
  };

  const rowBg = zebra ? "bg-slate-50/60" : "bg-white";
  const stickyL = `sticky z-10 ${rowBg}`;
  const cellL = `${XLS_CELL} text-left whitespace-pre-wrap break-words leading-tight`;
  const cellC = `${XLS_CELL} text-center whitespace-nowrap`;

  function renderCell(gkey: string, key: string): React.ReactNode {
    // Klasifikasi screening
    if (key === "scr") return <ClsBadge value={m?.bmi_classification ?? null} />;
    // Umum
    if (key === "tbbb") return `${m?.height_cm ?? "-"} / ${m?.weight_kg ?? "-"}`;
    if (key === "sel") return m?.weight_difference ?? "-";
    if (key === "imt") return m?.bmi ?? "-";
    if (key === "lp") return m?.chest_or_waist_lp ?? "-";
    // Anamnesa group
    if (key === "anamnesa") return <FindingCell text={find("anamnesa")} status={sstat("anamnesa")} />;
    if (key === "penyakit_dalam") return <FindingCell text={find("penyakit_dalam")} status={sstat("penyakit_dalam")} />;
    if (key === "ket_umum") return <FindingCell text={find("kulit") || find("obsgyn")} status={sstat("kulit")} />;
    if (key === "cls_umum") return <ClsBadge value={cls("penyakit_dalam") ?? cls("anamnesa")} />;
    // EKG
    if (key === "ekg_hasil") return <FindingCell text={find("ekg_ergo")} status={sstat("ekg_ergo")} />;
    if (key === "ekg_status") return sect("ekg_ergo")?.section_status ?? "-";
    if (key === "ekg_cls") return <ClsBadge value={cls("ekg_ergo")} />;
    // RAD
    if (key === "paru") return <FindingCell text={find("paru")} status={sstat("paru")} />;
    if (key === "ro") return <FindingCell text={find("radiologi_ro")} status={sstat("radiologi_ro")} />;
    if (key === "usg") return <FindingCell text={find("usg")} status={sstat("usg")} />;
    if (key === "rad_cls") return <ClsBadge value={cls("paru") ?? cls("radiologi_ro") ?? cls("usg")} />;
    // NEURO
    if (key === "neuro_hasil") return <FindingCell text={find("neurologi")} status={sstat("neurologi")} />;
    if (key === "neuro_cls") return <ClsBadge value={cls("neurologi")} />;
    // LAB
    if (key === "lab_hema" || key === "lab_urin" || key === "lab_kimia" || key === "lab_narko") {
      return <FindingCell text={find("laboratorium")} status={sstat("laboratorium")} />;
    }
    if (key === "lab_kesimp") return <FindingCell text={sect("laboratorium")?.notes ?? ""} status={sstat("laboratorium")} />;
    if (key === "lab_cls") return <ClsBadge value={cls("laboratorium")} />;
    // THT
    if (key === "tht_hasil") return <FindingCell text={find("tht") || find("audio_tympano")} status={sstat("tht")} />;
    if (key === "tht_bisik") return sect("audio_tympano")?.findings ?? "-";
    if (key === "tht_cls") return <ClsBadge value={cls("tht") ?? cls("audio_tympano")} />;
    // BEDAH
    if (key === "bedah_hasil") return <FindingCell text={find("bedah") || find("atas") || find("bawah")} status={sstat("bedah")} />;
    if (key === "bedah_cls") return <ClsBadge value={cls("bedah") ?? cls("atas") ?? cls("bawah")} />;
    // MATA
    if (key === "mata_visus" || key === "mata_kor" || key === "mata_peri" || key === "mata_iop") {
      return <FindingCell text={find("mata")} status={sstat("mata")} />;
    }
    if (key === "mata_cls") return <ClsBadge value={cls("mata")} />;
    // GIGI
    if (key === "gigi_dmft") return sect("gigi")?.findings?.split(/\s/)[0] ?? "-";
    if (key === "gigi_odon") return <FindingCell text={find("gigi")} status={sstat("gigi")} />;
    if (key === "gigi_kesimp") return <FindingCell text={sect("gigi")?.notes ?? ""} status={sstat("gigi")} />;
    if (key === "gigi_cls") return <ClsBadge value={cls("gigi")} />;
    // KESWA
    if (key === "keswa_anam" || key === "keswa_prib" || key === "keswa_cerd" || key === "keswa_kesimp") {
      return <FindingCell text={find("jiwa_keswa")} status={sstat("jiwa_keswa")} />;
    }
    if (key === "keswa_cls") return <ClsBadge value={cls("jiwa_keswa") ?? (ex?.keswa_status ?? null)} />;
    // STAKES — placeholder breakdown (rumus akan dihitung di backend)
    if (gkey === "stakes") return ex?.kesum_classification ? "-" : "-";
    // HASIL
    if (key === "h_kesum") return <ClsBadge value={ex?.kesum_classification} />;
    if (key === "h_keswa") return <ResBadge value={ex?.keswa_status} />;
    if (key === "h_akhir") return <ResBadge value={ex?.final_result} />;
    if (key === "h_nilai") return ex?.final_score ?? "-";
    if (key === "h_ket") return <FindingCell text={ms?.k1_notes ?? ""} status={undefined} />;
    if (key === "h_kesimp") return <FindingCell text={ms?.k2_notes ?? ""} status={undefined} />;
    if (key === "h_lulus") return <ResBadge value={ex?.exam_status === "Finalized" ? (ex?.final_result ?? "-") : (ex?.exam_status ?? "-")} />;
    // HELPER
    if (key === "hp_imt") return m?.bmi ?? "-";
    if (key === "hp_st") return m?.bmi_classification ?? "-";
    if (key === "hp_bmin") return m?.min_ideal_weight ?? "-";
    if (key === "hp_bmax") return m?.max_ideal_weight ?? "-";
    if (key === "hp_sel") return m?.weight_difference ?? "-";
    if (key === "hp_kode") return ex?.final_result ?? "-";
    if (key === "hp_stat") return ex?.exam_status ?? "Belum";
    return "-";
  }

  return (
    <tr className={`${rowBg} hover:bg-amber-50/60 cursor-pointer`} onClick={onOpen}>
      <td className={`${XLS_CELL} text-center ${stickyL}`} style={{ left: 0 }}>{index}</td>
      <td className={`${XLS_CELL} text-center font-medium ${stickyL}`} style={{ left: 42 }}>{c.test_number ?? "-"}</td>
      <td className={`${XLS_CELL} text-center ${stickyL}`} style={{ left: 92 }}>{c.pok_korp ?? "-"}</td>
      <td className={`${XLS_CELL} text-center ${stickyL}`} style={{ left: 138 }}>{c.panda ?? "-"}</td>
      <td className={`${cellL} ${stickyL}`} style={{ left: 194, minWidth: 240, maxWidth: 280 }}>
        <div className="font-semibold flex items-center gap-1">
          {c.full_name}
          {row.validation.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild><AlertTriangle className="h-3 w-3 text-amber-600" /></TooltipTrigger>
              <TooltipContent><div className="text-xs">{row.validation.join("; ")}</div></TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground">{[c.rank, c.nrp_nip, c.generation].filter(Boolean).join(" / ")}</div>
        <div className="text-[10px] text-muted-foreground">{c.unit_position ?? ""}</div>
        <div className="mt-1"><ExamStatusBadge value={ex?.exam_status} /></div>
      </td>
      {groups.flatMap((g) =>
        g.cols.map((col) => {
          const align = col.align ?? "left";
          const klass = `${XLS_CELL} ${XLS_GROUP_BG[g.key] ?? ""} ${align === "center" ? "text-center" : "text-left whitespace-pre-wrap break-words leading-tight"}`;
          return (
            <td key={`${g.key}.${col.key}`} className={klass} style={{ minWidth: col.min, maxWidth: align === "left" ? 220 : undefined }}>
              {renderCell(g.key, col.key)}
            </td>
          );
        })
      )}
      <td className={`${XLS_CELL} sticky right-0 z-10 ${rowBg}`}>
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="outline" className="h-6 text-[10px]" asChild onClick={(e) => e.stopPropagation()}>
            <Link to="/candidates/$id" params={{ id: c.id }}><ExternalLink className="h-3 w-3 mr-1" />Detail</Link>
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={(e) => { e.stopPropagation(); onRecalc(); }}>
            <RefreshCw className="h-3 w-3 mr-1" />Recalc
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={(e) => { e.stopPropagation(); onMarkReview("Marked from rekap"); }}>
            <Flag className="h-3 w-3 mr-1" />Review
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px]"
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await downloadCandidateResumeById(c.id);
                logAudit({ action: "export_pdf_single", module: "Rekap APLIKASI", candidate_id: c.id }).catch(() => {});
              } catch (err: any) { toast.error(err?.message ?? "Gagal membuat PDF"); }
            }}
          >
            <FileDown className="h-3 w-3 mr-1" />PDF
          </Button>
        </div>
      </td>
    </tr>
  );
}

function FindingCell({ text, status }: { text: string; status: string | undefined }) {
  const t = (text || "").trim();
  const key = (status ?? "belum") as ProgressItemStatus;
  const label = PROGRESS_STATUS_LABEL[key] ?? status ?? "";
  const klass = PROGRESS_STATUS_CLASS[key] ?? "";
  return (
    <div className="space-y-0.5">
      <div className="text-[11px]">{t || <span className="text-muted-foreground">-</span>}</div>
      {status && status !== "belum" && (
        <Badge variant="outline" className={`text-[9px] px-1 py-0 leading-tight ${klass}`}>{label}</Badge>
      )}
      {status === "belum" && !t && (
        <Badge variant="outline" className={`text-[9px] px-1 py-0 leading-tight ${PROGRESS_STATUS_CLASS.belum}`}>Belum</Badge>
      )}
    </div>
  );
}

function truncate(s: string, n: number) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// ---------------- Side Panel ----------------
function SidePanel({ row, onChanged, onClose }: { row: Row; onChanged: () => void; onClose: () => void }) {
  const ms = row.ms;
  const [attention, setAttention] = useState(ms?.attention_notes ?? "");
  const [parade, setParade] = useState(ms?.parade_notes ?? "");
  const [initial, setInitial] = useState(ms?.initial_result ?? "");
  const [afterParade, setAfterParade] = useState(ms?.after_parade_result ?? "");
  const [rakor, setRakor] = useState(ms?.rakor_result ?? "");
  const [pra, setPra] = useState(ms?.pra_pantukhir_result ?? "");
  const [suggestions, setSuggestions] = useState(ms?.suggestions ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!ms) { toast.error("Belum ada summary"); return; }
    setSaving(true);
    const before = { ...ms };
    const patch = {
      attention_notes: attention || null, parade_notes: parade || null,
      initial_result: initial || null, after_parade_result: afterParade || null,
      rakor_result: rakor || null, pra_pantukhir_result: pra || null,
      suggestions: suggestions || null,
    };
    const { error } = await localDataApi.from("medical_summary").update(patch).eq("id", ms.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await logAudit({
      action: "inline_edit_admin", module: "Rekap APLIKASI",
      record_id: ms.id, candidate_id: row.candidate.id,
      before, after: patch,
    });
    toast.success("Tersimpan");
    onChanged();
    onClose();
  }

  const pendingSections = Object.values(row.sections)
    .filter((s) => !["Submitted", "Approved", "Locked"].includes(s.section_status));
  const revisionSections = Object.values(row.sections).filter((s) => s.section_status === "Revision");

  return (
    <>
      <SheetHeader>
        <SheetTitle>{row.candidate.full_name}</SheetTitle>
      </SheetHeader>
      <div className="space-y-4 mt-4 text-sm">
        <div className="text-xs text-muted-foreground">
          {row.candidate.rank} · {row.candidate.nrp_nip} · {row.candidate.unit_position}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Tile l="KESUM" v={<ClsBadge value={row.exam?.kesum_classification} />} />
          <Tile l="KESWA" v={<ResBadge value={row.exam?.keswa_status} />} />
          <Tile l="Hasil" v={<ResBadge value={row.exam?.final_result} />} />
          <Tile l="Nilai" v={<span className="font-semibold">{row.exam?.final_score ?? "-"}</span>} />
          <Tile l="BMI" v={`${row.mm?.bmi ?? "-"} (${row.mm?.bmi_classification ?? "-"})`} />
          <Tile l="Progress" v={`${row.exam?.progress_percentage ?? 0}%`} />
        </div>
        <div className="text-xs">
          <b>Counts:</b> B {row.ms?.count_b ?? 0} · C {row.ms?.count_c ?? 0} · K1 {row.ms?.count_k1 ?? 0} · K2 {row.ms?.count_k2 ?? 0} · TH {row.count_th}
        </div>
        {row.last_sync_at && (
          <div className="text-[11px] text-muted-foreground">
            <b>Sinkron rekap terakhir:</b> {new Date(row.last_sync_at).toLocaleString("id-ID")}
          </div>
        )}
        {row.ms?.k1_notes && <div className="text-xs"><b>K1:</b> {row.ms.k1_notes}</div>}
        {row.ms?.k2_notes && <div className="text-xs"><b>K2/TMS:</b> {row.ms.k2_notes}</div>}
        {pendingSections.length > 0 && (
          <div className="text-xs"><b>Belum lengkap:</b> {pendingSections.map((s) => s.section_name).join(", ")}</div>
        )}
        {revisionSections.length > 0 && (
          <div className="text-xs text-amber-700"><b>Revisi:</b> {revisionSections.map((s) => s.section_name).join(", ")}</div>
        )}

        <div className="space-y-2 border-t pt-3">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Edit Administratif</div>
          <Field label="Atensi"><Textarea rows={2} value={attention} onChange={(e) => setAttention(e.target.value)} /></Field>
          <Field label="Catatan Parade"><Textarea rows={2} value={parade} onChange={(e) => setParade(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Initial result"><Input value={initial} onChange={(e) => setInitial(e.target.value)} /></Field>
            <Field label="After parade"><Input value={afterParade} onChange={(e) => setAfterParade(e.target.value)} /></Field>
            <Field label="Rakor result"><Input value={rakor} onChange={(e) => setRakor(e.target.value)} /></Field>
            <Field label="Pra-Pantukhir"><Input value={pra} onChange={(e) => setPra(e.target.value)} /></Field>
          </div>
          <Field label="Saran"><Textarea rows={2} value={suggestions} onChange={(e) => setSuggestions(e.target.value)} /></Field>
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={saving}><Save className="h-3 w-3 mr-1" />{saving ? "Menyimpan…" : "Simpan"}</Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/candidates/$id" params={{ id: row.candidate.id }}><ExternalLink className="h-3 w-3 mr-1" />Open Detail</Link>
          </Button>
        </div>
      </div>
    </>
  );
}

function Tile({ l, v }: { l: string; v: React.ReactNode }) {
  return (
    <div className="rounded border p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{l}</div>
      <div className="mt-1">{v}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground mb-0.5">{label}</div>
      {children}
    </div>
  );
}