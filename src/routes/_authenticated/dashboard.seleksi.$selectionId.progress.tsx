import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, RefreshCw, AlertCircle, Search, RotateCcw } from "lucide-react";
import { NoTestBadge } from "@/components/app/NoTestBadge";
import { getDb, LOCAL_SESSION_KEY, nowIso } from "@/lib/localDb";
import { toast } from "sonner";
import { buildParticipantRowLocal } from "@/lib/services/candidateService";

export const Route = createFileRoute("/_authenticated/dashboard/seleksi/$selectionId/progress")({ component: SelectionParticipantsProgress });

type Participant = {
  candidate_id: string; exam_id: string | null; selection_id: string; full_name: string; nrp: string | null;
  rank: string | null; unit: string | null; test_number: string | null; temporary_id: string | null; pok_korp: string | null;
  class_group: string | null; selection_name: string; hari_h_stage: string | null; exam_status: string; progress_percentage: number;
  progress_completed_count: number; progress_total_count: number; missing_issues: string[]; radiology_status: string; ekg_status: string;
  created_at: string;
};

function readSession() { try { const raw = localStorage.getItem(LOCAL_SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } }
function hasAccess(role?: string) { return ["super_admin", "admin", "kepala_sub_tim", "registrasi", "viewer", "tester"].includes(role ?? ""); }
function isCompleted(status?: string | null) { return ["submitted", "approved", "locked"].includes(String(status ?? "").toLowerCase()); }

function logAuditLocal(action: string, payload: Record<string, any>) {
  const db = getDb(); const s = readSession();
  db.audit_logs.push({ id: `audit_${Math.random().toString(36).slice(2, 10)}`, user_id: s?.user_id ?? db.auth.current_user_id, role: s?.role ?? db.auth.current_role, action, module: "Dashboard Progress Peserta", candidate_id: payload.candidate_id ?? null, exam_id: payload.exam_id ?? null, selection_id: payload.selection_id ?? null, before_data_json: payload.before_data_json ?? null, after_data_json: payload.after_data_json ?? null, created_at: nowIso() });
  localStorage.setItem("rikkes_tni_au_local_db_v1", JSON.stringify(db));
}

function getMissingIssuesLocal(candidate: any, exam: any, db: any) {
  const issues: string[] = [];
  if (!candidate?.test_number) issues.push("No Test belum ada");
  if (!candidate?.full_name || !candidate?.selection_id) issues.push("Identitas wajib belum lengkap");
  const sections = db.exam_sections.filter((s: any) => s.exam_id === exam?.id);
  const sec = (k: string) => sections.find((s: any) => String(s.section_key).toLowerCase() === k);
  if (!isCompleted(sec("anamnesis")?.section_status)) issues.push("Anamnesis belum Submitted");
  if (!isCompleted(sec("laboratorium")?.section_status)) issues.push("Laboratorium belum Submitted");
  if (!isCompleted(sec("jiwa_keswa")?.section_status)) issues.push("Keswa belum Submitted");
  if (db.settings?.neuro_required && !isCompleted(sec("neurologi")?.section_status)) issues.push("Neurologi belum Submitted");
  const ro = db.exam_radiology.find((x: any) => x.exam_id === exam?.id);
  const ekg = db.exam_cardiology.find((x: any) => x.exam_id === exam?.id);
  if (!isCompleted(ro?.status ?? ro?.section_status ?? exam?.radiology_initial_status)) issues.push("Rontgen belum Submitted");
  if (!isCompleted(ekg?.status ?? ekg?.section_status ?? exam?.ekg_initial_status)) issues.push("EKG belum Submitted");
  if ((exam?.exam_status ?? "") === "Pending Review" && (exam?.progress_percentage ?? 0) < 100) issues.push("Finalisasi tertahan");
  return issues;
}

function getParticipantsBySelectionLocal(selectionId: string): Participant[] {
  const db = getDb();
  const sel = db.selections.find((s: any) => s.id === selectionId);
  if (!sel) return [];
  const candidates = db.candidates.filter((c: any) => c.selection_id === selectionId);
  return candidates.map((c: any) => {
    const participant = buildParticipantRowLocal(c, db);
    const exam = participant.exam ?? null;
    const missing = getMissingIssuesLocal(c, exam, db);
    return {
      candidate_id: c.id, exam_id: participant.exam_id ?? null, selection_id: selectionId, full_name: c.full_name ?? "-", nrp: c.nrp_nip ?? null,
      rank: c.rank ?? null, unit: c.unit_position ?? null, test_number: c.test_number ?? null, temporary_id: c.temporary_id ?? null,
      pok_korp: c.pok_group ?? null, class_group: c.class_group ?? null, selection_name: sel.name ?? "-", hari_h_stage: participant.hari_h_stage ?? null,
      exam_status: exam?.exam_status ?? "Draft", progress_percentage: Number(exam?.progress_percentage ?? 0),
      progress_completed_count: Number(exam?.progress_completed_count ?? 0), progress_total_count: Number(exam?.progress_total_count ?? 0),
      missing_issues: missing, radiology_status: exam?.radiology_initial_status ?? "Draft", ekg_status: exam?.ekg_initial_status ?? "Draft", created_at: c.created_at ?? "",
    };
  });
}

function SelectionParticipantsProgress() {
  const { selectionId } = Route.useParams(); const navigate = useNavigate();
  const [q, setQ] = useState(""); const [statusF, setStatusF] = useState("all"); const [progressF, setProgressF] = useState("all");
  const [dateFrom, setDateFrom] = useState(""); const [dateTo, setDateTo] = useState(""); const [sortF, setSortF] = useState("newest"); const [tick, setTick] = useState(0);
  const filterKey = `rikkes_progress_filter_${selectionId}`;

  useEffect(() => { const s = readSession(); if (!s || !hasAccess(s.role)) navigate({ to: "/login" }); }, [navigate]);
  useEffect(() => { const raw = localStorage.getItem(filterKey); if (raw) { const f = JSON.parse(raw); setQ(f.q ?? ""); setStatusF(f.statusF ?? "all"); setProgressF(f.progressF ?? "all"); setDateFrom(f.dateFrom ?? ""); setDateTo(f.dateTo ?? ""); setSortF(f.sortF ?? "newest"); } }, [filterKey]);
  useEffect(() => { localStorage.setItem(filterKey, JSON.stringify({ q, statusF, progressF, dateFrom, dateTo, sortF })); }, [filterKey, q, statusF, progressF, dateFrom, dateTo, sortF]);

  const db = getDb(); const selection = db.selections.find((s: any) => s.id === selectionId);
  const base = useMemo(() => getParticipantsBySelectionLocal(selectionId), [selectionId, tick]);
  const rows = useMemo(() => {
    let data = [...base];
    if (q) data = data.filter((r) => `${r.full_name} ${r.nrp ?? ""} ${r.test_number ?? ""}`.toLowerCase().includes(q.toLowerCase()));
    if (statusF !== "all") data = statusF === "incomplete" ? data.filter((r) => r.missing_issues.length > 0) : data.filter((r) => r.exam_status === statusF);
    if (progressF !== "all") data = data.filter((r) => progressF === "0-25" ? r.progress_percentage <= 25 : progressF === "26-50" ? r.progress_percentage >= 26 && r.progress_percentage <= 50 : progressF === "51-75" ? r.progress_percentage >= 51 && r.progress_percentage <= 75 : progressF === "76-99" ? r.progress_percentage >= 76 && r.progress_percentage <= 99 : r.progress_percentage >= 100);
    if (dateFrom) data = data.filter((r) => (r.created_at || "") >= dateFrom); if (dateTo) data = data.filter((r) => (r.created_at || "") <= `${dateTo}z`);
    data.sort((a, b) => sortF === "name_asc" ? a.full_name.localeCompare(b.full_name) : sortF === "name_desc" ? b.full_name.localeCompare(a.full_name) : sortF === "progress_desc" ? b.progress_percentage - a.progress_percentage : sortF === "progress_asc" ? a.progress_percentage - b.progress_percentage : sortF === "oldest" ? String(a.created_at).localeCompare(String(b.created_at)) : String(b.created_at).localeCompare(String(a.created_at)));
    return data;
  }, [base, q, statusF, progressF, dateFrom, dateTo, sortF]);

  const stats = useMemo(() => {
    const total = base.length; const avg = total ? Math.round(base.reduce((a, b) => a + b.progress_percentage, 0) / total) : 0;
    return { total, avg, p0: base.filter((x) => x.progress_percentage === 0).length, p1to50: base.filter((x) => x.progress_percentage >= 1 && x.progress_percentage <= 50).length, over50: base.filter((x) => x.progress_percentage > 50).length, pending: base.filter((x) => x.exam_status === "Pending Review").length, finalized: base.filter((x) => x.exam_status === "Finalized").length, incomplete: base.filter((x) => x.missing_issues.length > 0).length, noTest: base.filter((x) => !x.test_number).length, ro: base.filter((x) => x.radiology_status !== "Submitted").length, ekg: base.filter((x) => x.ekg_status !== "Submitted").length };
  }, [base]);

  const recalc = () => { setTick((x) => x + 1); logAuditLocal("recalculate_selection_progress", { selection_id: selectionId }); toast.success("Progress peserta berhasil dihitung ulang."); };

  if (!selection) return <div className="p-8"><div className="text-sm mb-3">Seleksi tidak ditemukan atau sudah tidak aktif.</div><Button onClick={() => navigate({ to: "/dashboard" })}>Kembali ke Dashboard Seleksi</Button></div>;

  return <div className="p-6 lg:p-8 space-y-4">
    <div className="text-xs text-muted-foreground">Dashboard &gt; Progress Peserta &gt; {selection.name}</div>
    <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}><ArrowLeft className="h-4 w-4 mr-1" /> Kembali ke Dashboard Seleksi</Button>
    <div className="flex justify-between flex-wrap gap-2"><div><h1 className="text-2xl font-bold">Dashboard Pemeriksaan</h1><p className="text-sm text-muted-foreground">Menampilkan data pemeriksaan peserta untuk seleksi yang dipilih · {selection.name}</p></div><Button variant="outline" onClick={recalc}><RefreshCw className="h-4 w-4 mr-2"/>Recalculate Progress</Button></div>
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">{[["Total",stats.total],["Rata-rata",`${stats.avg}%`],["0%",stats.p0],["1-50%",stats.p1to50],[">50%",stats.over50],["Pending",stats.pending],["Finalized",stats.finalized],["Belum Lengkap",stats.incomplete]].map(([l,v])=> <Card key={String(l)}><CardContent className="p-2"><div className="text-[10px]">{l}</div><div className="font-bold">{v}</div></CardContent></Card>)}</div>
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm"><AlertCircle className="inline h-4 w-4 mr-1"/>Tanpa No Test: {stats.noTest} · Rontgen belum lengkap: {stats.ro} · EKG belum lengkap: {stats.ekg} · Data belum lengkap: {stats.incomplete}</div>
    <Card><CardContent className="p-3 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2"><Input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Cari Nama / NRP / No Test" /><Select value={statusF} onValueChange={setStatusF}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Semua Status</SelectItem><SelectItem value="Draft">Draft</SelectItem><SelectItem value="In Progress">In Progress</SelectItem><SelectItem value="Pending Review">Pending Review</SelectItem><SelectItem value="Finalized">Finalized</SelectItem><SelectItem value="incomplete">Belum Lengkap</SelectItem></SelectContent></Select><Select value={progressF} onValueChange={setProgressF}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Semua Progress</SelectItem><SelectItem value="0-25">0-25%</SelectItem><SelectItem value="26-50">26-50%</SelectItem><SelectItem value="51-75">51-75%</SelectItem><SelectItem value="76-99">76-99%</SelectItem><SelectItem value="100">100%</SelectItem></SelectContent></Select><Input type="date" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)} /><Input type="date" value={dateTo} onChange={(e)=>setDateTo(e.target.value)} /><Button variant="outline" onClick={()=>{setQ("");setStatusF("all");setProgressF("all");setDateFrom("");setDateTo("");setSortF("newest");logAuditLocal("filter_selection_progress",{selection_id:selectionId});}}><RotateCcw className="h-4 w-4 mr-2"/>Reset Filter</Button></CardContent></Card>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{rows.map((r)=><Card key={r.candidate_id}><CardContent className="p-4 space-y-2"><div className="flex justify-between"><div><div className="font-bold">{r.full_name}</div><div className="text-xs text-muted-foreground">{r.nrp ?? r.temporary_id ?? "-"}</div></div><Badge>{r.exam_status}</Badge></div><div className="text-xs">No.Tes: {r.test_number ?? "-"} {!r.test_number && <NoTestBadge testNumber={null} temporaryId={r.temporary_id} showLabel={false} />}</div><div className="text-xs">Progress {r.progress_percentage}% — {r.progress_completed_count}/{r.progress_total_count} selesai</div><div className="h-2 bg-slate-100 rounded"><div className="h-2 bg-sky-500 rounded" style={{width:`${Math.min(100,r.progress_percentage)}%`}}/></div><div className="text-xs">Tahap: {r.hari_h_stage ?? "-"}</div>{r.missing_issues.length>0 && <Badge variant="outline" className="text-orange-700 border-orange-200">Data Belum Lengkap</Badge>}<Button asChild className="w-full" onClick={()=>logAuditLocal("open_participant_detail_from_progress",{selection_id:selectionId,candidate_id:r.candidate_id,exam_id:r.exam_id})}><Link to="/rikkes/$id" params={{id:r.exam_id ?? r.candidate_id}} search={{from:"progress-peserta",selectionId,candidateId:r.candidate_id}}>Lihat Detail</Link></Button></CardContent></Card>)}</div>
    {rows.length===0 && <div className="text-sm text-muted-foreground py-6 text-center border rounded">Belum ada peserta untuk seleksi ini.</div>}
  </div>;
}
