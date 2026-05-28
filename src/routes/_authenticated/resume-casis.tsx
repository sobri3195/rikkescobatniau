import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { localDataApi } from "@/lib/localDataApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileSpreadsheet, Printer, RefreshCw, Search, ExternalLink, ChevronLeft, ChevronRight, Archive, Loader2, FileDown } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { STATUS_BADGES } from "@/lib/sections";
import { TableExportMenu } from "@/components/export/TableExportMenu";
import { buildCandidateResumePdf, candidateResumeFilename, downloadCandidateResumePdf } from "@/lib/candidate-resume-pdf";

export const Route = createFileRoute("/_authenticated/resume-casis")({
  component: ResumeCasis,
});

type Sel = { id: string; name: string; year_label: string; institution_header_line_1: string | null; institution_header_line_2: string | null };
type Cand = {
  id: string; selection_id: string; serial_number: number | null; test_number: string | null;
  pok_korp: string | null; panda: string | null; full_name: string; rank: string | null;
  nrp_nip: string | null; generation: string | null; unit_position: string | null;
  birth_place: string | null; birth_date: string | null; gender: string | null;
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
  min_ideal_weight: number | null; max_ideal_weight: number | null;
};
type MS = {
  exam_id: string; candidate_id: string;
  count_b: number; count_c: number; count_k1: number; count_k2: number;
  kesum_classification: string | null; keswa_status: string | null;
  final_result: string | null; final_score: number | null;
  k1_notes: string | null; k2_notes: string | null;
  attention_notes: string | null; parade_notes: string | null; suggestions: string | null;
  initial_result: string | null; after_parade_result: string | null;
  rakor_result: string | null; pra_pantukhir_result: string | null;
};
type Row = { candidate: Cand; exam?: Exam; mm?: MM; ms?: MS; sections: Record<string, Section> };

const KEY_SECTIONS = [
  "anamnesa", "pemeriksaan_umum", "tanda_vital", "penyakit_dalam", "ekg_ergo", "paru",
  "neurologi", "obsgyn", "kulit", "laboratorium", "radiologi_ro", "usg", "tht", "bedah",
  "atas", "bawah", "audio_tympano", "mata", "gigi", "jiwa_keswa",
];

function Bdg({ v }: { v: string | null | undefined }) {
  if (!v) return <span className="text-muted-foreground text-xs">—</span>;
  const cls = (STATUS_BADGES as any)[v] || "bg-muted text-muted-foreground";
  return <Badge className={`${cls} text-[10px]`}>{v}</Badge>;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }); }
  catch { return d; }
}

function ResumeCasis() {
  const [sels, setSels] = useState<Sel[]>([]);
  const [selId, setSelId] = useState<string>("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [resultF, setResultF] = useState<string>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [bundling, setBundling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, e, s, m, ms, sl] = await Promise.all([
      localDataApi.from("candidates").select("id,selection_id,serial_number,test_number,pok_korp,panda,full_name,rank,nrp_nip,generation,unit_position,birth_place,birth_date,gender").is("deleted_at", null).order("serial_number"),
      localDataApi.from("exams").select("id,candidate_id,selection_id,exam_status,progress_percentage,kesum_classification,keswa_status,final_result,final_score"),
      localDataApi.from("exam_sections").select("exam_id,candidate_id,section_key,section_name,section_status,classification,findings,notes"),
      localDataApi.from("medical_measurements").select("exam_id,candidate_id,height_cm,weight_kg,bmi,bmi_classification,chest_or_waist_lp,min_ideal_weight,max_ideal_weight"),
      localDataApi.from("medical_summary").select("exam_id,candidate_id,count_b,count_c,count_k1,count_k2,kesum_classification,keswa_status,final_result,final_score,k1_notes,k2_notes,attention_notes,parade_notes,suggestions,initial_result,after_parade_result,rakor_result,pra_pantukhir_result"),
      localDataApi.from("selections").select("id,name,year_label,institution_header_line_1,institution_header_line_2").order("created_at", { ascending: false }),
    ]);
    const examByCand = new Map(((e.data ?? []) as Exam[]).map((x) => [x.candidate_id, x]));
    const mmByExam = new Map(((m.data ?? []) as MM[]).map((x) => [x.exam_id, x]));
    const msByExam = new Map(((ms.data ?? []) as MS[]).map((x) => [x.exam_id, x]));
    const secsByCand = new Map<string, Record<string, Section>>();
    for (const sec of (s.data ?? []) as Section[]) {
      if (!secsByCand.has(sec.candidate_id)) secsByCand.set(sec.candidate_id, {});
      secsByCand.get(sec.candidate_id)![sec.section_key] = sec;
    }
    const built: Row[] = ((c.data ?? []) as Cand[]).map((cand) => {
      const exam = examByCand.get(cand.id);
      return {
        candidate: cand,
        exam,
        mm: exam ? mmByExam.get(exam.id) : undefined,
        ms: exam ? msByExam.get(exam.id) : undefined,
        sections: secsByCand.get(cand.id) ?? {},
      };
    });
    setRows(built);
    setSels((sl.data ?? []) as Sel[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { logAudit({ action: "view", module: "Resume Casis" }).catch(() => {}); }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (selId !== "all" && r.candidate.selection_id !== selId) return false;
      if (resultF !== "all" && (r.exam?.final_result ?? "Belum Lengkap") !== resultF) return false;
      if (qq) {
        const hay = [r.candidate.full_name, r.candidate.test_number, r.candidate.nrp_nip, r.candidate.unit_position].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
  }, [rows, selId, resultF, q]);

  useEffect(() => {
    if (!filtered.length) { setActiveId(null); return; }
    if (!activeId || !filtered.find((r) => r.candidate.id === activeId)) {
      setActiveId(filtered[0].candidate.id);
    }
  }, [filtered, activeId]);

  const active = useMemo(() => filtered.find((r) => r.candidate.id === activeId) ?? null, [filtered, activeId]);
  const activeIdx = useMemo(() => filtered.findIndex((r) => r.candidate.id === activeId), [filtered, activeId]);
  const selMeta = sels.find((s) => s.id === selId);

  function go(delta: number) {
    if (activeIdx < 0) return;
    const next = filtered[activeIdx + delta];
    if (next) setActiveId(next.candidate.id);
  }

  function exportXlsx() {
    if (!filtered.length) { toast.error("Tidak ada data"); return; }
    const header = ["No", "No Tes", "Nama", "Pangkat", "NRP/NIP", "Pok/Korp", "Panda", "TB(cm)", "BB(kg)", "BMI", "Klas BMI", "KESUM", "KESWA", "Hasil Awal", "Parade", "Rakor", "Pra Pantukhir", "Hasil Akhir", "Skor", "Catatan K1", "Catatan K2", "Perhatian", "Saran"];
    const data = filtered.map((r, i) => [
      i + 1,
      r.candidate.test_number ?? "",
      r.candidate.full_name,
      r.candidate.rank ?? "",
      r.candidate.nrp_nip ?? "",
      r.candidate.pok_korp ?? "",
      r.candidate.panda ?? "",
      r.mm?.height_cm ?? "",
      r.mm?.weight_kg ?? "",
      r.mm?.bmi ?? "",
      r.mm?.bmi_classification ?? "",
      r.exam?.kesum_classification ?? "",
      r.exam?.keswa_status ?? "",
      r.ms?.initial_result ?? "",
      r.ms?.after_parade_result ?? "",
      r.ms?.rakor_result ?? "",
      r.ms?.pra_pantukhir_result ?? "",
      r.exam?.final_result ?? "",
      r.exam?.final_score ?? "",
      r.ms?.k1_notes ?? "",
      r.ms?.k2_notes ?? "",
      r.ms?.attention_notes ?? "",
      r.ms?.suggestions ?? "",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([
      [selMeta?.institution_header_line_1 ?? "TNI ANGKATAN UDARA"],
      [selMeta?.institution_header_line_2 ?? ""],
      [`Resume Casis — ${selMeta ? `${selMeta.name} — ${selMeta.year_label}` : "Semua Seleksi"}`],
      [],
      header,
      ...data,
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resume Casis");
    XLSX.writeFile(wb, `Resume_Casis_${selMeta?.year_label ?? "All"}.xlsx`);
    logAudit({ action: "export_xlsx", module: "Resume Casis", after: { count: filtered.length } }).catch(() => {});
    toast.success(`Exported ${filtered.length} peserta`);
  }

  function exportPrint() {
    window.print();
    logAudit({ action: "print", module: "Resume Casis" }).catch(() => {});
  }

  async function exportFinalizedZipPdf() {
    const finalized = filtered.filter((r) => r.exam?.exam_status === "Finalized");
    if (!finalized.length) { toast.error("Tidak ada peserta dengan status Finalized pada filter ini."); return; }
    setBundling(true);
    try {
      const zip = new JSZip();
      const header = {
        line1: selMeta?.institution_header_line_1 ?? null,
        line2: selMeta?.institution_header_line_2 ?? null,
        selectionLabel: selMeta ? `${selMeta.name} — ${selMeta.year_label}` : "Semua Seleksi",
      };
      for (const r of finalized) {
        const doc = buildCandidateResumePdf({
          candidate: r.candidate,
          exam: r.exam ?? null,
          mm: r.mm ?? null,
          ms: r.ms ?? null,
          sections: r.sections,
          header,
          keySections: KEY_SECTIONS,
        });
        zip.file(candidateResumeFilename(r.candidate), doc.output("arraybuffer"));
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Resume_Casis_${selMeta?.year_label ?? "All"}_Finalized.zip`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);

      logAudit({ action: "export_pdf_bundle", module: "Resume Casis", after: { count: finalized.length, selection_id: selId } }).catch(() => {});
      toast.success(`Bundle PDF berhasil dibuat untuk ${finalized.length} peserta Finalized`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat bundle PDF");
    } finally {
      setBundling(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Resume Casis</h1>
          <p className="text-sm text-muted-foreground">Rekap ringkas per peserta untuk Pantukhir — identitas, antropometri, KESUM/KESWA, hasil per tahap, dan catatan.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
          <Button variant="outline" size="sm" onClick={exportPrint}><Printer className="h-4 w-4 mr-1" /> Print / PDF</Button>
          <Button size="sm" onClick={exportXlsx}><FileSpreadsheet className="h-4 w-4 mr-1" /> Export XLSX (Lengkap)</Button>
          <Button size="sm" variant="secondary" onClick={exportFinalizedZipPdf} disabled={bundling}>
            {bundling ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Archive className="h-4 w-4 mr-1" />}
            Bundle PDF (Finalized)
          </Button>
          <TableExportMenu<Row>
            data={filtered}
            filename="resume_casis"
            title="Resume Casis"
            columns={[
              { key: "test_number", label: "No Tes", accessor: (r) => r.candidate.test_number ?? "" },
              { key: "full_name", label: "Nama", accessor: (r) => r.candidate.full_name },
              { key: "rank", label: "Pangkat", accessor: (r) => r.candidate.rank ?? "" },
              { key: "nrp_nip", label: "NRP/NIP", accessor: (r) => r.candidate.nrp_nip ?? "" },
              { key: "pok_korp", label: "Pok/Korp", accessor: (r) => r.candidate.pok_korp ?? "" },
              { key: "panda", label: "Panda", accessor: (r) => r.candidate.panda ?? "" },
              { key: "bmi", label: "BMI", accessor: (r) => r.mm?.bmi ?? "" },
              { key: "kesum", label: "KESUM", accessor: (r) => r.exam?.kesum_classification ?? "" },
              { key: "keswa", label: "KESWA", accessor: (r) => r.exam?.keswa_status ?? "" },
              { key: "final_result", label: "Hasil Akhir", accessor: (r) => r.exam?.final_result ?? "" },
              { key: "final_score", label: "Skor", accessor: (r) => r.exam?.final_score ?? "" },
            ]}
          />
        </div>
      </div>

      <Card className="print:hidden">
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="relative col-span-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8 h-9" placeholder="Cari nama, no tes, NRP…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="h-9 rounded border bg-background px-2 text-sm" value={selId} onChange={(e) => setSelId(e.target.value)}>
            <option value="all">Semua Seleksi</option>
            {sels.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.year_label}</option>)}
          </select>
          <select className="h-9 rounded border bg-background px-2 text-sm" value={resultF} onChange={(e) => setResultF(e.target.value)}>
            <option value="all">Hasil: Semua</option>
            {["MS", "TMS", "TH", "Belum Lengkap"].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* List */}
        <Card className="print:hidden">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Peserta ({filtered.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-260px)]">
              {loading && <div className="p-4 text-xs text-muted-foreground">Memuat…</div>}
              {!loading && filtered.length === 0 && <div className="p-4 text-xs text-muted-foreground">Tidak ada peserta.</div>}
              <div className="divide-y">
                {filtered.map((r, i) => (
                  <button
                    key={r.candidate.id}
                    onClick={() => setActiveId(r.candidate.id)}
                    className={`w-full text-left px-3 py-2 hover:bg-accent transition ${activeId === r.candidate.id ? "bg-accent" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">#{i + 1} • {r.candidate.test_number ?? "—"}</div>
                        <div className="text-sm font-medium truncate">{r.candidate.full_name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{r.candidate.pok_korp ?? "—"} • {r.candidate.panda ?? "—"}</div>
                      </div>
                      <Bdg v={r.exam?.final_result ?? "Belum Lengkap"} />
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Detail Resume */}
        <div className="space-y-3">
          {!active && <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Pilih peserta dari daftar untuk melihat resume.</CardContent></Card>}
          {active && <ResumeDetail row={active} selMeta={selMeta} onPrev={() => go(-1)} onNext={() => go(1)} hasPrev={activeIdx > 0} hasNext={activeIdx < filtered.length - 1} idx={activeIdx + 1} total={filtered.length} />}
        </div>
      </div>
    </div>
  );
}

function ResumeDetail({ row, selMeta, onPrev, onNext, hasPrev, hasNext, idx, total }: {
  row: Row; selMeta?: Sel; onPrev: () => void; onNext: () => void; hasPrev: boolean; hasNext: boolean; idx: number; total: number;
}) {
  const { candidate: c, exam, mm, ms, sections } = row;

  const findings = KEY_SECTIONS
    .map((k) => sections[k])
    .filter((s): s is Section => !!s && ((s.classification && s.classification !== "B") || !!s.findings));

  return (
    <Card className="print:shadow-none print:border-0">
      <CardHeader className="pb-2 print:hidden">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">Resume Peserta</CardTitle>
          <div className="flex items-center gap-2 text-xs">
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={onPrev} disabled={!hasPrev}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-muted-foreground">{idx} / {total}</span>
            <Button size="icon" variant="outline" className="h-7 w-7" onClick={onNext} disabled={!hasNext}><ChevronRight className="h-4 w-4" /></Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                downloadCandidateResumePdf({
                  candidate: row.candidate,
                  exam: row.exam ?? null,
                  mm: row.mm ?? null,
                  ms: row.ms ?? null,
                  sections: row.sections,
                  header: {
                    line1: selMeta?.institution_header_line_1 ?? null,
                    line2: selMeta?.institution_header_line_2 ?? null,
                    selectionLabel: selMeta ? `${selMeta.name} — ${selMeta.year_label}` : null,
                  },
                  keySections: KEY_SECTIONS,
                });
                logAudit({ action: "export_pdf_single", module: "Resume Casis", candidate_id: row.candidate.id }).catch(() => {});
              }}
            >
              <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
            </Button>
            <Link to="/candidates/$id" params={{ id: c.id }}>
              <Button size="sm" variant="outline" className="h-7"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Detail</Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5 space-y-4 text-sm">
        {/* Print header */}
        <div className="hidden print:block text-center mb-4">
          <div className="font-bold uppercase">{selMeta?.institution_header_line_1 ?? "TNI ANGKATAN UDARA"}</div>
          <div className="text-xs">{selMeta?.institution_header_line_2 ?? ""}</div>
          <div className="font-bold mt-2 underline">RESUME CASIS</div>
          <div className="text-xs">{selMeta ? `${selMeta.name} — ${selMeta.year_label}` : ""}</div>
        </div>

        {/* Identity */}
        <section>
          <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Identitas</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs">
            <KV label="No Tes" value={c.test_number} />
            <KV label="Nama" value={c.full_name} />
            <KV label="Pangkat" value={c.rank} />
            <KV label="NRP/NIP" value={c.nrp_nip} />
            <KV label="Generasi" value={c.generation} />
            <KV label="Jenis Kelamin" value={c.gender} />
            <KV label="TTL" value={`${c.birth_place ?? "—"}, ${fmtDate(c.birth_date)}`} />
            <KV label="Pok/Korp" value={c.pok_korp} />
            <KV label="Panda" value={c.panda} />
            <KV label="Unit/Jabatan" value={c.unit_position} />
          </div>
        </section>

        <Separator />

        {/* Anthropometry + Status */}
        <section className="grid md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Antropometri</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <KV label="Tinggi Badan" value={mm?.height_cm ? `${mm.height_cm} cm` : null} />
              <KV label="Berat Badan" value={mm?.weight_kg ? `${mm.weight_kg} kg` : null} />
              <KV label="BMI" value={mm?.bmi ? `${mm.bmi}` : null} />
              <KV label="Klasifikasi BMI" value={mm?.bmi_classification} />
              <KV label="LP/Dada" value={mm?.chest_or_waist_lp ? `${mm.chest_or_waist_lp} cm` : null} />
              <KV label="BB Ideal" value={mm?.min_ideal_weight && mm?.max_ideal_weight ? `${mm.min_ideal_weight}–${mm.max_ideal_weight} kg` : null} />
            </div>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Status Ujian</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <KV label="Status" value={exam?.exam_status} />
              <KV label="Progress" value={exam?.progress_percentage != null ? `${exam.progress_percentage}%` : null} />
              <div className="flex gap-2"><span className="text-muted-foreground">KESUM:</span> <Bdg v={exam?.kesum_classification} /></div>
              <div className="flex gap-2"><span className="text-muted-foreground">KESWA:</span> <Bdg v={exam?.keswa_status} /></div>
              <KV label="Skor Akhir" value={exam?.final_score != null ? String(exam.final_score) : null} />
              <div className="flex gap-2"><span className="text-muted-foreground">Hasil Akhir:</span> <Bdg v={exam?.final_result} /></div>
            </div>
          </div>
        </section>

        <Separator />

        {/* Counts */}
        <section>
          <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Rekap Klasifikasi</h3>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge className={`${(STATUS_BADGES as any).B} text-[10px]`}>B: {ms?.count_b ?? 0}</Badge>
            <Badge className={`${(STATUS_BADGES as any).C} text-[10px]`}>C: {ms?.count_c ?? 0}</Badge>
            <Badge className={`${(STATUS_BADGES as any).K1} text-[10px]`}>K1: {ms?.count_k1 ?? 0}</Badge>
            <Badge className={`${(STATUS_BADGES as any).K2} text-[10px]`}>K2: {ms?.count_k2 ?? 0}</Badge>
          </div>
        </section>

        <Separator />

        {/* Stages */}
        <section>
          <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Hasil Per Tahap</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-xs">
            <div className="flex justify-between gap-2"><span className="text-muted-foreground">Laporan 1 (Awal):</span> <Bdg v={ms?.initial_result} /></div>
            <div className="flex justify-between gap-2"><span className="text-muted-foreground">Setelah Parade:</span> <Bdg v={ms?.after_parade_result} /></div>
            <div className="flex justify-between gap-2"><span className="text-muted-foreground">Rakor:</span> <Bdg v={ms?.rakor_result} /></div>
            <div className="flex justify-between gap-2"><span className="text-muted-foreground">Pra Pantukhir:</span> <Bdg v={ms?.pra_pantukhir_result} /></div>
            <div className="flex justify-between gap-2"><span className="text-muted-foreground">Hasil Akhir:</span> <Bdg v={exam?.final_result} /></div>
          </div>
        </section>

        <Separator />

        {/* Findings */}
        <section>
          <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Temuan Pemeriksaan (non-B)</h3>
          {findings.length === 0 && <p className="text-xs text-muted-foreground">Tidak ada temuan signifikan.</p>}
          {findings.length > 0 && (
            <div className="border rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr><th className="text-left px-2 py-1.5">Section</th><th className="text-left px-2 py-1.5 w-20">Klas</th><th className="text-left px-2 py-1.5">Temuan / Catatan</th></tr>
                </thead>
                <tbody>
                  {findings.map((s) => (
                    <tr key={s.section_key} className="border-t">
                      <td className="px-2 py-1.5">{s.section_name}</td>
                      <td className="px-2 py-1.5"><Bdg v={s.classification} /></td>
                      <td className="px-2 py-1.5">{[s.findings, s.notes].filter(Boolean).join(" — ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Notes */}
        {(ms?.k1_notes || ms?.k2_notes || ms?.attention_notes || ms?.parade_notes || ms?.suggestions) && (
          <>
            <Separator />
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Catatan</h3>
              {ms?.k2_notes && <NoteBlock label="Catatan K2" text={ms.k2_notes} />}
              {ms?.k1_notes && <NoteBlock label="Catatan K1" text={ms.k1_notes} />}
              {ms?.attention_notes && <NoteBlock label="Perhatian" text={ms.attention_notes} />}
              {ms?.parade_notes && <NoteBlock label="Parade" text={ms.parade_notes} />}
              {ms?.suggestions && <NoteBlock label="Saran" text={ms.suggestions} />}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function KV({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground min-w-[110px]">{label}:</span>
      <span className="font-medium">{value ?? "—"}</span>
    </div>
  );
}

function NoteBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="text-xs">
      <div className="text-muted-foreground mb-0.5">{label}</div>
      <div className="whitespace-pre-wrap border-l-2 border-muted pl-2">{text}</div>
    </div>
  );
}