import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { localDataApi } from "@/lib/localDataApi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Activity, Users, Info, CheckCircle2, Clock, AlertCircle, FileText } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { isPimpinanViewer } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { CandidateProgressPopover } from "@/components/candidate/CandidateProgressPopover";

type TabKey = "info" | "progress" | "peserta";

export const Route = createFileRoute("/_authenticated/selections/$selectionId")({
  validateSearch: (s: Record<string, unknown>): { tab?: TabKey } => ({
    tab: (s.tab as TabKey) ?? "progress",
  }),
  component: SelectionDetail,
});

type Selection = {
  id: string; name: string; year_label: string; participant_label: string;
  location: string | null; status: string; is_default: boolean;
  institution_header_line_1: string; institution_header_line_2: string;
  start_date: string | null; end_date: string | null;
};

type Exam = {
  id: string; candidate_id: string; exam_status: string | null;
  hari_h_stage: string | null; progress_percentage: number | null;
  ekg_initial_status: string | null; radiology_initial_status: string | null;
};

type Cand = {
  id: string; full_name: string; test_number: string | null; temporary_id: string | null;
  rank: string | null; nrp_nip: string | null; unit_position: string | null;
};

function StatPill({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number | string; tone: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${tone}`}>
      <Icon className="h-4 w-4" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
        <div className="font-bold tabular-nums leading-tight">{value}</div>
      </div>
    </div>
  );
}

function ProgressBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold tabular-nums">{Math.round(value)}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-sky-500 to-emerald-500" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function SelectionDetail() {
  const { selectionId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const { roles } = useAuth();
  const viewerOnly = isPimpinanViewer(roles);

  const [selection, setSelection] = useState<Selection | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [candidates, setCandidates] = useState<Cand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [s, ex, c] = await Promise.all([
        localDataApi.from("selections").select("*").eq("id", selectionId).maybeSingle(),
        localDataApi
          .from("exams")
          .select("id,candidate_id,exam_status,hari_h_stage,progress_percentage,ekg_initial_status,radiology_initial_status")
          .eq("selection_id", selectionId),
        localDataApi
          .from("candidates")
          .select("id,full_name,test_number,temporary_id,rank,nrp_nip,unit_position")
          .eq("selection_id", selectionId)
          .is("deleted_at", null)
          .order("full_name"),
      ]);
      if (cancelled) return;
      setSelection((s.data as Selection) ?? null);
      setExams((ex.data ?? []) as Exam[]);
      setCandidates((c.data ?? []) as Cand[]);
      setLoading(false);
      void logAudit({ action: "view_selection_progress", module: "dashboard", record_id: selectionId });
    }
    void load();
    return () => { cancelled = true; };
  }, [selectionId]);

  const examByCand = useMemo(() => {
    const m = new Map<string, Exam>();
    for (const e of exams) m.set(e.candidate_id, e);
    return m;
  }, [exams]);

  const stats = useMemo(() => {
    const total = exams.length;
    const progAvg = total > 0 ? exams.reduce((a, b) => a + (b.progress_percentage ?? 0), 0) / total : 0;
    const stage = (st: string) => exams.filter((x) => (x.hari_h_stage ?? "") === st).length;
    const ekgDone = exams.filter((e) => ["Cleared", "Submitted", "Approved", "Locked"].includes(e.ekg_initial_status ?? "")).length;
    const roDone = exams.filter((e) => ["Cleared", "Submitted", "Approved", "Locked"].includes(e.radiology_initial_status ?? "")).length;
    const screening = stage("Screening Hari-H");
    const subteam = stage("Pemeriksaan Subtim");
    const review = stage("Review");
    const finalized = exams.filter((x) => x.exam_status === "Finalized").length;
    const incomplete = exams.filter((x) => (x.progress_percentage ?? 0) < 50 && x.exam_status !== "Finalized").length;
    return {
      total, progAvg, finalized, incomplete,
      inProgress: exams.filter((x) => x.exam_status === "In Progress" || x.exam_status === "Pending Review").length,
      waitingEkg: stage("Menunggu EKG") + stage("Menunggu Rontgen & EKG"),
      waitingRo: stage("Menunggu Rontgen") + stage("Menunggu Rontgen & EKG"),
      screening, subteam, review,
      ekgPct: total > 0 ? (ekgDone / total) * 100 : 0,
      roPct: total > 0 ? (roDone / total) * 100 : 0,
      screeningPct: total > 0 ? ((screening + subteam + review + finalized) / total) * 100 : 0,
      subteamPct: total > 0 ? ((subteam + review + finalized) / total) * 100 : 0,
      finalPct: total > 0 ? (finalized / total) * 100 : 0,
    };
  }, [exams]);

  function setTab(next: TabKey) {
    navigate({ to: "/selections/$selectionId", params: { selectionId }, search: { tab: next } });
  }

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Memuat detail seleksi…</div>;
  }
  if (!selection) {
    return <div className="p-8 text-sm text-muted-foreground">Seleksi tidak ditemukan.</div>;
  }

  const isActive = (selection.status ?? "").toLowerCase() === "aktif";

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Kembali ke Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            {selection.name}
            <Badge
              variant="outline"
              className={isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"}
            >
              {selection.status}
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            {selection.year_label} · {selection.participant_label}
            {selection.location ? ` · ${selection.location}` : ""} · {stats.total} peserta
          </p>
        </div>
      </div>

      <Tabs value={tab ?? "progress"} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="progress"><Activity className="h-3.5 w-3.5 mr-1.5" /> Progress Monitoring</TabsTrigger>
          <TabsTrigger value="peserta"><Users className="h-3.5 w-3.5 mr-1.5" /> Daftar Peserta</TabsTrigger>
          <TabsTrigger value="info"><Info className="h-3.5 w-3.5 mr-1.5" /> Info Seleksi</TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="space-y-6 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
            <StatPill icon={Users} label="Total" value={stats.total} tone="bg-primary/10 text-primary border-primary/20" />
            <StatPill icon={CheckCircle2} label="Finalized" value={stats.finalized} tone="bg-emerald-50 text-emerald-700 border-emerald-200" />
            <StatPill icon={Clock} label="Proses" value={stats.inProgress} tone="bg-sky-50 text-sky-700 border-sky-200" />
            <StatPill icon={AlertCircle} label="Blm Lengkap" value={stats.incomplete} tone="bg-orange-50 text-orange-700 border-orange-200" />
            <StatPill icon={Activity} label="Menunggu EKG" value={stats.waitingEkg} tone="bg-amber-50 text-amber-700 border-amber-200" />
            <StatPill icon={Activity} label="Menunggu RO" value={stats.waitingRo} tone="bg-amber-50 text-amber-700 border-amber-200" />
            <StatPill icon={Users} label="Screening" value={stats.screening} tone="bg-violet-50 text-violet-700 border-violet-200" />
            <StatPill icon={Users} label="Subtim" value={stats.subteam} tone="bg-indigo-50 text-indigo-700 border-indigo-200" />
            <StatPill icon={FileText} label="Review" value={stats.review} tone="bg-cyan-50 text-cyan-700 border-cyan-200" />
            <StatPill icon={CheckCircle2} label="Progress" value={`${Math.round(stats.progAvg)}%`} tone="bg-slate-50 text-slate-700 border-slate-200" />
          </div>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold text-slate-900">Progress per Tahap</h3>
              <ProgressBar label="Progress total seleksi" value={stats.progAvg} />
              <ProgressBar label="EKG selesai" value={stats.ekgPct} />
              <ProgressBar label="Rontgen selesai" value={stats.roPct} />
              <ProgressBar label="Screening Hari-H lewat" value={stats.screeningPct} />
              <ProgressBar label="Subtim lewat" value={stats.subteamPct} />
              <ProgressBar label="Finalisasi" value={stats.finalPct} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="peserta" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-semibold">No Tes</th>
                      <th className="px-3 py-2 font-semibold">Nama</th>
                      <th className="px-3 py-2 font-semibold">Pangkat / NRP</th>
                      <th className="px-3 py-2 font-semibold">Stage</th>
                      <th className="px-3 py-2 font-semibold">EKG</th>
                      <th className="px-3 py-2 font-semibold">RO</th>
                      <th className="px-3 py-2 font-semibold text-right">Progress</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      {!viewerOnly && <th className="px-3 py-2"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c) => {
                      const e = examByCand.get(c.id);
                      return (
                        <tr key={c.id} className="border-b hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono text-xs">{c.test_number ?? c.temporary_id ?? "-"}</td>
                          <td className="px-3 py-2 font-medium">{c.full_name}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{c.rank ?? "-"} {c.nrp_nip ? `/ ${c.nrp_nip}` : ""}</td>
                          <td className="px-3 py-2 text-xs">{e?.hari_h_stage ?? "—"}</td>
                          <td className="px-3 py-2 text-xs">{e?.ekg_initial_status ?? "—"}</td>
                          <td className="px-3 py-2 text-xs">{e?.radiology_initial_status ?? "—"}</td>
                          <td className="px-3 py-2 text-xs text-right tabular-nums">{Math.round(e?.progress_percentage ?? 0)}%</td>
                          <td className="px-3 py-2 text-xs">{e?.exam_status ?? "—"}</td>
                          {!viewerOnly && (
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <CandidateProgressPopover candidateId={c.id} candidateName={c.full_name} />
                                <Button asChild size="sm" variant="outline">
                                  <Link to="/rikkes/$id" params={{ id: c.id }}>Buka</Link>
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {candidates.length === 0 && (
                      <tr><td colSpan={viewerOnly ? 8 : 9} className="px-3 py-6 text-center text-muted-foreground">Belum ada peserta.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-2 text-sm">
              <div><span className="font-semibold">Header Instansi:</span> {selection.institution_header_line_1} — {selection.institution_header_line_2}</div>
              <div><span className="font-semibold">Tahun:</span> {selection.year_label}</div>
              <div><span className="font-semibold">Jenis Peserta:</span> {selection.participant_label}</div>
              <div><span className="font-semibold">Lokasi:</span> {selection.location ?? "-"}</div>
              <div><span className="font-semibold">Periode:</span> {selection.start_date ?? "-"} s.d. {selection.end_date ?? "-"}</div>
              <div><span className="font-semibold">Status:</span> {selection.status}</div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}