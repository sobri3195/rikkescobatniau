import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { localDataApi } from "@/lib/localDataApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, RefreshCw, Search, ExternalLink, Printer, FileDown } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { STATUS_BADGES } from "@/lib/sections";
import { TableExportMenu } from "@/components/export/TableExportMenu";
import { downloadCandidateResumeById } from "@/lib/candidate-resume-fetch";

export const Route = createFileRoute("/_authenticated/laporan-tahap")({
  component: LaporanTahap,
});

type Sel = { id: string; name: string; year_label: string; report_title: string | null; institution_header_line_1: string | null; institution_header_line_2: string | null };
type Cand = {
  id: string; selection_id: string; serial_number: number | null; test_number: string | null;
  pok_korp: string | null; panda: string | null; full_name: string; rank: string | null;
  nrp_nip: string | null; generation: string | null; unit_position: string | null;
};
type Exam = {
  id: string; candidate_id: string; selection_id: string; exam_status: string;
  progress_percentage: number; kesum_classification: string | null; keswa_status: string | null;
  final_result: string | null; final_score: number | null; finalized_at: string | null;
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
type Row = { candidate: Cand; exam?: Exam; ms?: MS };

type StageKey = "laporan1" | "dirbindukkes" | "parade" | "rakor" | "pra_pantukhir" | "disminpersau" | "disdikau";

const STAGES: { key: StageKey; label: string; desc: string }[] = [
  { key: "laporan1", label: "Laporan 1", desc: "Hasil awal pemeriksaan (initial result) — KESUM, KESWA, Hasil Awal." },
  { key: "dirbindukkes", label: "Dirbindukkes", desc: "Daftar peserta dengan catatan K1/K2, perhatian khusus, dan saran medis." },
  { key: "parade", label: "Parade", desc: "Hasil setelah parade — after_parade_result + catatan parade." },
  { key: "rakor", label: "Rakor", desc: "Hasil Rapat Koordinasi — keputusan rakor_result per peserta." },
  { key: "pra_pantukhir", label: "Pra Pantukhir", desc: "Hasil tahap Pra Pantukhir — pra_pantukhir_result." },
  { key: "disminpersau", label: "Disminpersau", desc: "Daftar nominatif kelulusan MS untuk Disminpersau." },
  { key: "disdikau", label: "Disdikau", desc: "Daftar nominatif kelulusan MS untuk Disdikau (pendidikan)." },
];

function Bdg({ v }: { v: string | null | undefined }) {
  if (!v) return <span className="text-muted-foreground text-xs">—</span>;
  const cls = (STATUS_BADGES as any)[v] || "bg-muted text-muted-foreground";
  return <Badge className={`${cls} text-[10px]`}>{v}</Badge>;
}

function stageValue(row: Row, key: StageKey): string | null {
  const ms = row.ms;
  const ex = row.exam;
  switch (key) {
    case "laporan1": return ms?.initial_result ?? ex?.final_result ?? null;
    case "parade": return ms?.after_parade_result ?? null;
    case "rakor": return ms?.rakor_result ?? null;
    case "pra_pantukhir": return ms?.pra_pantukhir_result ?? null;
    case "disminpersau":
    case "disdikau":
      return ex?.final_result ?? null;
    case "dirbindukkes": {
      const k1 = ms?.count_k1 ?? 0; const k2 = ms?.count_k2 ?? 0;
      if (k2 > 0) return "K2";
      if (k1 > 0) return "K1";
      if ((ms?.attention_notes ?? "").trim()) return "Perhatian";
      return ex?.kesum_classification ?? null;
    }
  }
}

function stageNotes(row: Row, key: StageKey): string {
  const ms = row.ms;
  if (!ms) return "";
  if (key === "parade") return ms.parade_notes ?? "";
  if (key === "dirbindukkes") {
    return [ms.k2_notes, ms.k1_notes, ms.attention_notes, ms.suggestions].filter(Boolean).join(" • ");
  }
  return ms.suggestions ?? "";
}

function summarize(rows: Row[], key: StageKey) {
  const s: Record<string, number> = { MS: 0, TMS: 0, TH: 0, "Belum Lengkap": 0, K1: 0, K2: 0, B: 0, C: 0, Perhatian: 0 };
  for (const r of rows) {
    const v = stageValue(r, key) ?? "Belum Lengkap";
    s[v] = (s[v] ?? 0) + 1;
  }
  return s;
}

function LaporanTahap() {
  const [sels, setSels] = useState<Sel[]>([]);
  const [selId, setSelId] = useState<string>("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [pokF, setPokF] = useState<string>("all");
  const [statusF, setStatusF] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [stage, setStage] = useState<StageKey>("laporan1");
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, e, ms, sl] = await Promise.all([
      localDataApi.from("candidates").select("id,selection_id,serial_number,test_number,pok_korp,panda,full_name,rank,nrp_nip,generation,unit_position").is("deleted_at", null).order("serial_number"),
      localDataApi.from("exams").select("id,candidate_id,selection_id,exam_status,progress_percentage,kesum_classification,keswa_status,final_result,final_score,finalized_at"),
      localDataApi.from("medical_summary").select("exam_id,candidate_id,count_b,count_c,count_k1,count_k2,kesum_classification,keswa_status,final_result,final_score,k1_notes,k2_notes,attention_notes,parade_notes,suggestions,initial_result,after_parade_result,rakor_result,pra_pantukhir_result"),
      localDataApi.from("selections").select("id,name,year_label,report_title,institution_header_line_1,institution_header_line_2").order("created_at", { ascending: false }),
    ]);
    const examByCand = new Map(((e.data ?? []) as Exam[]).map((x) => [x.candidate_id, x]));
    const msByExam = new Map(((ms.data ?? []) as MS[]).map((x) => [x.exam_id, x]));
    const built: Row[] = ((c.data ?? []) as Cand[]).map((cand) => {
      const exam = examByCand.get(cand.id);
      const msr = exam ? msByExam.get(exam.id) : undefined;
      return { candidate: cand, exam, ms: msr };
    });
    setRows(built);
    setSels((sl.data ?? []) as Sel[]);
    setLoading(false);
    setLastLoaded(new Date());
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { logAudit({ action: "view", module: "Laporan Tahap" }).catch(() => {}); }, []);

  const pokOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.candidate.pok_korp).filter(Boolean))) as string[], [rows]);

  const baseFiltered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;
    return rows.filter((r) => {
      if (selId !== "all" && r.candidate.selection_id !== selId) return false;
      if (pokF !== "all" && r.candidate.pok_korp !== pokF) return false;
      if (statusF !== "all") {
        const v = stageValue(r, stage) ?? "Belum Lengkap";
        if (v !== statusF) return false;
      }
      if (from || to) {
        const fa = r.exam?.finalized_at ? new Date(r.exam.finalized_at).getTime() : null;
        if (!fa) return false;
        if (from && fa < from) return false;
        if (to && fa > to) return false;
      }
      if (qq) {
        const hay = [r.candidate.full_name, r.candidate.test_number, r.candidate.nrp_nip, r.candidate.unit_position].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
  }, [rows, selId, pokF, q, statusF, dateFrom, dateTo, stage]);

  const stageFiltered = useMemo(() => {
    if (stage === "disminpersau" || stage === "disdikau") {
      return baseFiltered.filter((r) => (r.exam?.final_result ?? null) === "MS");
    }
    if (stage === "dirbindukkes") {
      return baseFiltered.filter((r) => {
        const v = stageValue(r, "dirbindukkes");
        return v === "K1" || v === "K2" || v === "Perhatian";
      });
    }
    return baseFiltered;
  }, [baseFiltered, stage]);

  const summary = useMemo(() => summarize(stageFiltered, stage), [stageFiltered, stage]);
  const stageMeta = STAGES.find((s) => s.key === stage)!;
  const selMeta = sels.find((s) => s.id === selId);

  function exportXlsx() {
    if (!stageFiltered.length) { toast.error("Tidak ada data untuk diexport"); return; }
    const header = ["No", "No Tes", "Nama", "Pangkat", "NRP/NIP", "Pok/Korp", "Panda", "Unit/Jabatan", "Generasi", "Hasil Tahap", "Catatan"];
    const data = stageFiltered.map((r, i) => [
      i + 1,
      r.candidate.test_number ?? "",
      r.candidate.full_name,
      r.candidate.rank ?? "",
      r.candidate.nrp_nip ?? "",
      r.candidate.pok_korp ?? "",
      r.candidate.panda ?? "",
      r.candidate.unit_position ?? "",
      r.candidate.generation ?? "",
      stageValue(r, stage) ?? "Belum Lengkap",
      stageNotes(r, stage),
    ]);
    const sumRows = [
      [],
      ["Ringkasan"],
      ...Object.entries(summary).filter(([, v]) => v > 0).map(([k, v]) => [k, v]),
    ];
    const ws = XLSX.utils.aoa_to_sheet([
      [`${selMeta?.institution_header_line_1 ?? ""}`],
      [`${selMeta?.institution_header_line_2 ?? ""}`],
      [`Laporan Tahap: ${stageMeta.label}`],
      [`Seleksi: ${selMeta ? `${selMeta.name} — ${selMeta.year_label}` : "Semua Seleksi"}`],
      [],
      header,
      ...data,
      ...sumRows,
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, stageMeta.label.slice(0, 28));
    const fname = `Laporan_${stageMeta.label.replace(/\s+/g, "_")}_${selMeta?.year_label ?? "All"}.xlsx`;
    XLSX.writeFile(wb, fname);
    logAudit({ action: "export_xlsx", module: "Laporan Tahap", after: { stage, count: stageFiltered.length } }).catch(() => {});
    toast.success(`Exported ${stageFiltered.length} baris`);
  }

  function exportPrint() {
    window.print();
    logAudit({ action: "print", module: "Laporan Tahap", after: { stage } }).catch(() => {});
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Laporan Tahap</h1>
          <p className="text-sm text-muted-foreground">Rangkaian laporan operasional RIKKES: Laporan 1 → Dirbindukkes → Parade → Rakor → Pra Pantukhir → Disminpersau → Disdikau.</p>
          {lastLoaded && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Terakhir diperbarui: {lastLoaded.toLocaleString("id-ID")}
              <span className="ml-2">Hasil sementara tampil walaupun peserta belum finalized.</span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Refresh Data</Button>
          <Button variant="outline" size="sm" onClick={exportPrint}><Printer className="h-4 w-4 mr-1" /> Print / PDF</Button>
          <Button size="sm" onClick={exportXlsx}><FileSpreadsheet className="h-4 w-4 mr-1" /> Export XLSX (Lengkap)</Button>
          <TableExportMenu<Row>
            data={stageFiltered}
            filename={`Laporan_${stageMeta.label.replace(/\s+/g, "_")}`}
            title={`Laporan ${stageMeta.label}`}
            columns={[
              { key: "test_number", label: "No Tes", accessor: (r) => r.candidate.test_number ?? "" },
              { key: "full_name", label: "Nama", accessor: (r) => r.candidate.full_name },
              { key: "rank", label: "Pangkat", accessor: (r) => r.candidate.rank ?? "" },
              { key: "nrp_nip", label: "NRP/NIP", accessor: (r) => r.candidate.nrp_nip ?? "" },
              { key: "pok_korp", label: "Pok/Korp", accessor: (r) => r.candidate.pok_korp ?? "" },
              { key: "panda", label: "Panda", accessor: (r) => r.candidate.panda ?? "" },
              { key: "hasil", label: "Hasil Tahap", accessor: (r) => stageValue(r, stage) ?? "Belum Lengkap" },
              { key: "catatan", label: "Catatan", accessor: (r) => stageNotes(r, stage) },
            ]}
          />
        </div>
      </div>

      <Card className="print:hidden">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8 h-9" placeholder="Cari nama, no tes, NRP…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="h-9 rounded border bg-background px-2 text-sm" value={selId} onChange={(e) => setSelId(e.target.value)}>
            <option value="all">Semua Seleksi</option>
            {sels.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.year_label}</option>)}
          </select>
          <select className="h-9 rounded border bg-background px-2 text-sm" value={pokF} onChange={(e) => setPokF(e.target.value)}>
            <option value="all">Pok/Korp: Semua</option>
            {pokOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="h-9 rounded border bg-background px-2 text-sm" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
            <option value="all">Status Tahap: Semua</option>
            {["MS","TMS","TH","K1","K2","B","C","Perhatian","Belum Lengkap"].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <Input type="date" className="h-9" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Finalized dari" />
          <Input type="date" className="h-9" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Finalized sampai" />
        </CardContent>
      </Card>

      <Tabs value={stage} onValueChange={(v) => setStage(v as StageKey)}>
        <TabsList className="flex flex-wrap h-auto print:hidden">
          {STAGES.map((s) => <TabsTrigger key={s.key} value={s.key} className="text-xs">{s.label}</TabsTrigger>)}
        </TabsList>

        {STAGES.map((s) => (
          <TabsContent key={s.key} value={s.key} className="space-y-3 mt-3">
            {/* Print header */}
            <div className="hidden print:block text-center mb-4">
              <div className="font-bold uppercase">{selMeta?.institution_header_line_1 ?? "TNI ANGKATAN UDARA"}</div>
              <div className="text-sm">{selMeta?.institution_header_line_2 ?? ""}</div>
              <div className="font-bold mt-2">LAPORAN {s.label.toUpperCase()}</div>
              <div className="text-sm">{selMeta ? `${selMeta.name} — ${selMeta.year_label}` : "Semua Seleksi"}</div>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{s.label}</CardTitle>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">Total: {stageFiltered.length}</Badge>
                  {Object.entries(summary).filter(([, v]) => v > 0).map(([k, v]) => (
                    <Badge key={k} className={`${(STATUS_BADGES as any)[k] || "bg-muted text-muted-foreground"} text-[10px]`}>{k}: {v}</Badge>
                  ))}
                </div>

                <div className="border rounded overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead className="w-12">No</TableHead>
                        <TableHead>No Tes</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Pangkat</TableHead>
                        <TableHead>NRP/NIP</TableHead>
                        <TableHead>Pok/Korp</TableHead>
                        <TableHead>Panda</TableHead>
                        <TableHead>Hasil Tahap</TableHead>
                        <TableHead>Catatan</TableHead>
                        <TableHead className="w-12 print:hidden"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">Memuat…</TableCell></TableRow>}
                      {!loading && stageFiltered.length === 0 && (
                        <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">Tidak ada data untuk tahap ini.</TableCell></TableRow>
                      )}
                      {stageFiltered.map((r, i) => (
                        <TableRow key={r.candidate.id} className="text-xs">
                          <TableCell>{i + 1}</TableCell>
                          <TableCell>{r.candidate.test_number ?? "—"}</TableCell>
                          <TableCell className="font-medium">{r.candidate.full_name}</TableCell>
                          <TableCell>{r.candidate.rank ?? "—"}</TableCell>
                          <TableCell>{r.candidate.nrp_nip ?? "—"}</TableCell>
                          <TableCell>{r.candidate.pok_korp ?? "—"}</TableCell>
                          <TableCell>{r.candidate.panda ?? "—"}</TableCell>
                          <TableCell><Bdg v={stageValue(r, s.key)} /></TableCell>
                          <TableCell className="max-w-[280px] truncate" title={stageNotes(r, s.key)}>{stageNotes(r, s.key) || "—"}</TableCell>
                          <TableCell className="print:hidden">
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Download PDF Resume"
                                onClick={async () => {
                                  try {
                                    await downloadCandidateResumeById(r.candidate.id);
                                    logAudit({ action: "export_pdf_single", module: "Laporan Tahap", candidate_id: r.candidate.id }).catch(() => {});
                                  } catch (e: any) { toast.error(e?.message ?? "Gagal membuat PDF"); }
                                }}
                              >
                                <FileDown className="h-3.5 w-3.5" />
                              </Button>
                              <Link to="/candidates/$id" params={{ id: r.candidate.id }}>
                                <Button size="icon" variant="ghost" className="h-7 w-7"><ExternalLink className="h-3.5 w-3.5" /></Button>
                              </Link>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}