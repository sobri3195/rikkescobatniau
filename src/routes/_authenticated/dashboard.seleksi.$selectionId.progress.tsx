import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, RefreshCw, AlertCircle, Search, RotateCcw,
} from "lucide-react";
import { CandidateProgressPopover } from "@/components/candidate/CandidateProgressPopover";
import { logAudit } from "@/lib/audit";
import { getSelectionParticipantsProgress } from "@/lib/dashboard-monitoring.functions";
import { NoTestBadge } from "@/components/app/NoTestBadge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard/seleksi/$selectionId/progress")({
  component: SelectionParticipantsProgress,
});

type Selection = {
  id: string; name: string; year_label: string; participant_label: string;
  location: string | null; status: string;
};

type Cand = {
  id: string; full_name: string; test_number: string | null; temporary_id: string | null;
  rank: string | null; nrp_nip: string | null; unit_position: string | null;
  pok_group: string | null; created_at: string;
};

type Exam = {
  id: string; candidate_id: string; exam_status: string | null;
  hari_h_stage: string | null; progress_percentage: number | null;
  ekg_initial_status: string | null; radiology_initial_status: string | null;
};

type Row = Cand & {
  exam: Exam | null;
  completed: number;
  total: number;
};

type Stats = {
  total: number;
  finalized: number;
  inProgress: number;
  incomplete: number;
  waitingEkg: number;
  waitingRo: number;
  screening: number;
  subteam: number;
  avgProgress: number;
  peserta0: number;
  p1to50: number;
  pOver50: number;
  pendingReview: number;
};

type LoadStatus = "loading" | "error" | "empty" | "success";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EMPTY_STATS: Stats = { total: 0, finalized: 0, inProgress: 0, incomplete: 0, waitingEkg: 0, waitingRo: 0, screening: 0, subteam: 0, avgProgress: 0, peserta0: 0, p1to50: 0, pOver50: 0, pendingReview: 0 };

function StatPill({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <Card className={`border ${tone}`}>
      <CardContent className="p-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide truncate">{label}</div>
        <div className="text-2xl font-bold tabular-nums leading-tight mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function statusBadge(exam: Exam | null) {
  const st = exam?.exam_status ?? "Draft";
  const tone =
    st === "Finalized" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
    st === "Submitted" ? "bg-indigo-100 text-indigo-700 border-indigo-200" :
    st === "Pending Review" ? "bg-cyan-100 text-cyan-700 border-cyan-200" :
    st === "In Progress" ? "bg-sky-100 text-sky-700 border-sky-200" :
    "bg-slate-100 text-slate-600 border-slate-200";
  const label = st === "Pending Review" ? "Perlu Review" : st === "Not Started" ? "Draft" : st;
  return <Badge variant="outline" className={`${tone} text-[11px]`}>{label}</Badge>;
}

function progressTone(pct: number) {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 40) return "bg-amber-500";
  return "bg-orange-500";
}

function ParticipantCard({ row, selectionName }: { row: Row; selectionName: string }) {
  const pct = Math.round(row.exam?.progress_percentage ?? 0);
  const noTes = row.test_number ?? row.temporary_id ?? "-";
  const isTmp = !row.test_number || row.test_number.startsWith("TMP-");
  return (
    <Card className="flex flex-col">
      <CardContent className="p-4 flex-1 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-bold text-slate-900 truncate">{row.full_name}</div>
            <div className="text-xs text-muted-foreground truncate">{row.nrp_nip ?? "-"}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {statusBadge(row.exam)}
            {isTmp && (
              <NoTestBadge testNumber={row.test_number} temporaryId={null} showLabel={false} className="text-[10px]" />
            )}
          </div>
        </div>
        <div className="text-xs space-y-0.5">
          <div className="grid grid-cols-[80px_1fr] gap-1"><span className="text-muted-foreground">Pangkat</span><span className="text-slate-700 truncate">: {row.rank ?? "-"}</span></div>
          <div className="grid grid-cols-[80px_1fr] gap-1"><span className="text-muted-foreground">Satuan</span><span className="text-slate-700 truncate">: {row.unit_position ?? "-"}</span></div>
          <div className="grid grid-cols-[80px_1fr] gap-1"><span className="text-muted-foreground">No. Tes</span><span className="text-slate-700 font-mono">: {noTes}</span></div>
          {row.pok_group && (
            <div className="grid grid-cols-[80px_1fr] gap-1"><span className="text-muted-foreground">Pok/Korp</span><span className="text-slate-700 truncate">: {row.pok_group}</span></div>
          )}
          <div className="grid grid-cols-[80px_1fr] gap-1"><span className="text-muted-foreground">Seleksi</span><span className="text-slate-700 truncate">: {selectionName}</span></div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Progress</span>
            <span className="text-slate-700 flex items-center gap-1">
              <span className="font-semibold tabular-nums">{pct}%</span>
              <span className="text-muted-foreground">— {row.completed}/{row.total} selesai</span>
              <CandidateProgressPopover candidateId={row.id} candidateName={row.full_name} iconOnly />
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full transition-all ${progressTone(pct)}`} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <div className="text-xs text-emerald-700">
            Tahap: <span className="font-semibold">{row.exam?.hari_h_stage ?? "—"}</span>
          </div>
        </div>
        <Button asChild className="mt-auto bg-[#0f1b3d] hover:bg-[#0f1b3d]/90 text-white">
          <Link to="/rikkes/$id" params={{ id: row.id }}>Lihat Detail</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function SelectionParticipantsProgress() {
  const { selectionId } = Route.useParams();
  const navigate = useNavigate();
  const fetchProgress = useServerFn(getSelectionParticipantsProgress);
  const requestIdRef = useRef(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [progressF, setProgressF] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortF, setSortF] = useState<"newest" | "oldest" | "name_asc" | "name_desc" | "progress_desc" | "progress_asc">("newest");
  const [page, setPage] = useState(1);
  const pageSize = 24;
  const loading = status === "loading";
  const [selectionOptions, setSelectionOptions] = useState<{ id: string; name: string; year_label: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("selections")
        .select("id,name,year_label,status")
        .eq("status", "Aktif")
        .order("name");
      if (!cancelled && data) setSelectionOptions(data as any);
    })();
    return () => { cancelled = true; };
  }, []);

  const onSelectionChange = (value: string) => {
    if (value && value !== selectionId) {
      navigate({ to: "/dashboard/seleksi/$selectionId/progress", params: { selectionId: value } });
    }
  };

  const load = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (!selectionId) {
      setErr("ID seleksi tidak ditemukan.");
      setStatus("error");
      setRows([]);
      return;
    }
    if (!UUID_RE.test(selectionId)) {
      setErr("Seleksi tidak ditemukan.");
      setStatus("error");
      setRows([]);
      return;
    }
    setStatus("loading");
    setErr(null);
    setForbidden(false);
    let timeoutId: number | undefined;
    try {
      const res = await Promise.race([
        fetchProgress({
          data: { selectionId, search: q, status: statusF, progress: progressF as any, dateFrom: dateFrom || null, dateTo: dateTo || null, page, pageSize, sort: sortF },
        }),
        new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(() => reject(new Error("Permintaan memuat data terlalu lama.")), 20_000);
        }),
      ]);
      if (requestId !== requestIdRef.current) return;
      setSelection(res.selection as Selection);
      setRows(res.rows as Row[]);
      setStats(res.stats);
      setTotalFiltered(res.totalFiltered);
      setStatus((res.rows?.length ?? 0) > 0 ? "success" : "empty");
      logAudit({ action: "view_selection_participants_progress", module: "dashboard", record_id: selectionId }).catch(() => {});
    } catch (e: any) {
      const msg = (e?.message ?? "").toString();
      if (requestId !== requestIdRef.current) return;
      setRows([]);
      if (msg.includes("401") || /unauthor/i.test(msg)) {
        setErr("Sesi Anda telah berakhir. Silakan login kembali.");
      } else if (msg.includes("403")) {
        setForbidden(true);
        setErr("Anda tidak memiliki akses melihat progress seleksi.");
      } else if (msg.includes("tidak ditemukan")) {
        setErr("Seleksi tidak ditemukan.");
      } else if (/network|fetch|failed to fetch/i.test(msg)) {
        setErr("Gagal terhubung ke server. Periksa koneksi internet Anda.");
      } else {
        setErr(`Gagal memuat progress peserta: ${msg || "kesalahan tidak diketahui"}.`);
      }
      setStatus("error");
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    }
  }, [dateFrom, dateTo, fetchProgress, page, progressF, q, selectionId, statusF, sortF]);

  useEffect(() => {
    void load();
    return () => { requestIdRef.current += 1; };
  }, [load]);

  const updateQ = (value: string) => { setPage(1); setQ(value); };
  const updateStatusF = (value: string) => { setPage(1); setStatusF(value); };
  const updateProgressF = (value: string) => { setPage(1); setProgressF(value); };
  const updateDateFrom = (value: string) => { setPage(1); setDateFrom(value); };
  const updateDateTo = (value: string) => { setPage(1); setDateTo(value); };
  const updateSortF = (value: string) => { setPage(1); setSortF(value as any); };
  const resetFilters = () => {
    setPage(1);
    setQ("");
    setStatusF("all");
    setProgressF("all");
    setDateFrom("");
    setDateTo("");
    setSortF("newest");
  };

  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Kembali ke Dashboard Seleksi
        </Button>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Progress Peserta — {selection?.name ?? "…"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {selection ? `${selection.year_label} · ${selection.participant_label}${selection.location ? ` · ${selection.location}` : ""}` : ""}
              {" · "}{stats.total} peserta seleksi ini · {totalFiltered} tampil
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh Progress
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatPill label="Rata-rata Progress" value={`${stats.avgProgress}%`} tone="bg-slate-50 border-slate-200" />
        <StatPill label="Peserta 0%" value={stats.peserta0} tone="bg-sky-50 border-sky-200" />
        <StatPill label="1–50%" value={stats.p1to50} tone="bg-amber-50 border-amber-200" />
        <StatPill label=">50%" value={stats.pOver50} tone="bg-blue-50 border-blue-200" />
        <StatPill label="Pending Review" value={stats.pendingReview} tone="bg-yellow-50 border-yellow-200" />
        <StatPill label="Finalized" value={stats.finalized} tone="bg-emerald-50 border-emerald-200" />
      </div>

      {err && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      {(err || forbidden) && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Coba Lagi
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Kembali ke Dashboard
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Filter Status</label>
              <Select value={statusF} onValueChange={updateStatusF}>
                <SelectTrigger><SelectValue placeholder="Semua Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Submitted">Submitted</SelectItem>
                  <SelectItem value="Finalized">Finalized</SelectItem>
                  <SelectItem value="incomplete">Belum Lengkap</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Progress</label>
              <Select value={progressF} onValueChange={updateProgressF}>
                <SelectTrigger><SelectValue placeholder="Semua Progress" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Progress</SelectItem>
                  <SelectItem value="0-25">0–25%</SelectItem>
                  <SelectItem value="26-50">26–50%</SelectItem>
                  <SelectItem value="51-75">51–75%</SelectItem>
                  <SelectItem value="76-99">76–99%</SelectItem>
                  <SelectItem value="100">100%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Urutkan</label>
              <Select value={sortF} onValueChange={updateSortF}>
                <SelectTrigger><SelectValue placeholder="Terbaru" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Terbaru</SelectItem>
                  <SelectItem value="oldest">Terlama</SelectItem>
                  <SelectItem value="name_asc">Nama A–Z</SelectItem>
                  <SelectItem value="name_desc">Nama Z–A</SelectItem>
                  <SelectItem value="progress_desc">Progress Tertinggi</SelectItem>
                  <SelectItem value="progress_asc">Progress Terendah</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Seleksi</label>
              <Select value={selectionId} onValueChange={onSelectionChange}>
                <SelectTrigger><SelectValue placeholder="Pilih Seleksi" /></SelectTrigger>
                <SelectContent>
                  {selectionOptions.length === 0 && selection && (
                    <SelectItem value={selection.id}>{selection.name} — {selection.year_label}</SelectItem>
                  )}
                  {selectionOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} — {s.year_label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Cari Nama / NRP</label>
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input placeholder="Ketik untuk mencari…" value={q} onChange={(e) => updateQ(e.target.value)} className="pl-8" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Dari Tanggal</label>
              <Input type="date" value={dateFrom} onChange={(e) => updateDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Sampai Tanggal</label>
              <Input type="date" value={dateTo} onChange={(e) => updateDateTo(e.target.value)} />
            </div>
            <div className="lg:col-span-3 flex justify-end">
              <Button variant="outline" size="sm" onClick={resetFilters} disabled={loading}>
                <RotateCcw className="h-4 w-4 mr-2" /> Reset Filter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1,2,3,4,5,6].map((i) => (
            <Card key={i}><CardContent className="p-4 h-64 bg-slate-50 animate-pulse rounded" /></Card>
          ))}
        </div>
      ) : status === "error" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center space-y-3">
          <AlertCircle className="h-6 w-6 mx-auto text-red-600" />
          <div className="text-sm text-red-700">{err ?? "Terjadi kesalahan saat memuat data."}</div>
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Coba Lagi
          </Button>
        </div>
      ) : status === "empty" ? (
        <div className="text-sm text-muted-foreground py-8 text-center bg-white border rounded-lg">
          {stats.total === 0
            ? "Belum ada peserta pada seleksi ini."
            : "Tidak ada peserta yang cocok dengan filter."}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {rows.map((r) => (
              <ParticipantCard key={r.id} row={r} selectionName={selection?.name ?? ""} />
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 pt-2 text-sm text-muted-foreground">
            <span>Halaman {page} dari {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Sebelumnya</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>Berikutnya</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}