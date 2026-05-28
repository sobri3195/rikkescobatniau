import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Radio, FileWarning, ExternalLink, RefreshCw } from "lucide-react";
import { HARI_H_STAGES, STAGE_BADGE, INIT_STATUS_BADGE, type HariHStage, recomputeHariHStage } from "@/lib/hari-h-stage";
import { QuickSupportingModal } from "@/components/hari-h/QuickSupportingModal";
import { NoTestBadge } from "@/components/app/NoTestBadge";
import { CandidateProgressPopover } from "@/components/candidate/CandidateProgressPopover";

export const Route = createFileRoute("/_authenticated/hari-h")({
  component: HariHQueuePage,
});

type Row = {
  exam_id: string;
  candidate_id: string;
  full_name: string;
  rank: string | null;
  nrp_nip: string | null;
  unit_position: string | null;
  test_number: string | null;
  temporary_id: string | null;
  hari_h_stage: HariHStage;
  ekg_initial_status: string;
  radiology_initial_status: string;
};

function HariHQueuePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ mode: "ekg" | "radiology"; examId: string; candidateId: string } | null>(null);
  const [mobileStage, setMobileStage] = useState<HariHStage>("Menunggu EKG");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("exams")
      .select(`
        id, candidate_id, hari_h_stage, ekg_initial_status, radiology_initial_status,
        candidates!inner(full_name, rank, nrp_nip, unit_position, test_number, temporary_id)
      `)
      .neq("exam_status", "Finalized")
      .limit(500);
    setLoading(false);
    if (error) return;
    const mapped: Row[] = (data ?? []).map((r: any) => ({
      exam_id: r.id,
      candidate_id: r.candidate_id,
      hari_h_stage: (r.hari_h_stage ?? "Registrasi Awal") as HariHStage,
      ekg_initial_status: r.ekg_initial_status ?? "Belum Diisi",
      radiology_initial_status: r.radiology_initial_status ?? "Belum Diisi",
      full_name: r.candidates?.full_name ?? "-",
      rank: r.candidates?.rank ?? null,
      nrp_nip: r.candidates?.nrp_nip ?? null,
      unit_position: r.candidates?.unit_position ?? null,
      test_number: r.candidates?.test_number ?? null,
      temporary_id: r.candidates?.temporary_id ?? null,
    }));
    setRows(mapped);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.full_name, r.test_number, r.temporary_id, r.nrp_nip, r.unit_position]
        .some((v) => (v ?? "").toLowerCase().includes(s)),
    );
  }, [rows, q]);

  const byStage = useMemo(() => {
    const map: Record<string, Row[]> = {};
    HARI_H_STAGES.forEach((s) => (map[s] = []));
    filtered.forEach((r) => {
      (map[r.hari_h_stage] ?? map["Registrasi Awal"]).push(r);
    });
    return map;
  }, [filtered]);

  async function recomputeAll() {
    setLoading(true);
    await Promise.all(filtered.slice(0, 50).map((r) => recomputeHariHStage(r.exam_id)));
    await load();
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hari-H RIKKES — Antrian Pemeriksaan</h1>
          <p className="text-sm text-muted-foreground">Workflow lapangan: EKG &amp; Rontgen di awal, lalu screening dan subtim.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Cari nama / no test / temp ID" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
          <Button variant="outline" onClick={recomputeAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh Stage
          </Button>
          <Button asChild variant="outline">
            <Link to="/data-belum-lengkap"><FileWarning className="h-4 w-4 mr-2" /> Data Belum Lengkap</Link>
          </Button>
        </div>
      </div>

      {/* Mobile: single-stage view with selector */}
      <div className="lg:hidden space-y-3">
        <Select value={mobileStage} onValueChange={(v) => setMobileStage(v as HariHStage)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HARI_H_STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {s} ({byStage[s]?.length ?? 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className={`px-3 py-2 text-xs font-semibold border rounded ${STAGE_BADGE[mobileStage]}`}>
          {mobileStage} <span className="opacity-70">({byStage[mobileStage]?.length ?? 0})</span>
        </div>
        <div className="space-y-2">
          {(byStage[mobileStage] ?? []).map((r) => (
            <Card key={r.exam_id} className="shadow-sm">
              <CardContent className="p-3 space-y-2 text-xs">
                <div className="font-semibold text-sm leading-tight">{r.full_name}</div>
                <div><NoTestBadge testNumber={r.test_number} temporaryId={r.temporary_id} showLabel={false} /></div>
                {r.rank && <div className="text-muted-foreground">{r.rank}</div>}
                {r.unit_position && <div className="text-muted-foreground">{r.unit_position}</div>}
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className={INIT_STATUS_BADGE[r.ekg_initial_status as never] ?? ""}>EKG: {r.ekg_initial_status}</Badge>
                  <Badge variant="outline" className={INIT_STATUS_BADGE[r.radiology_initial_status as never] ?? ""}>RO: {r.radiology_initial_status}</Badge>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  <Button size="sm" variant="outline" className="h-8 text-xs flex-1" onClick={() => setModal({ mode: "ekg", examId: r.exam_id, candidateId: r.candidate_id })}>
                    <Activity className="h-3 w-3 mr-1" /> EKG
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs flex-1" onClick={() => setModal({ mode: "radiology", examId: r.exam_id, candidateId: r.candidate_id })}>
                    <Radio className="h-3 w-3 mr-1" /> Rontgen
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs" asChild>
                    <Link to="/rikkes/$id" params={{ id: r.exam_id }}>
                      <ExternalLink className="h-3 w-3 mr-1" /> Detail
                    </Link>
                  </Button>
                </div>
                <CandidateProgressPopover candidateId={r.candidate_id} candidateName={r.full_name} />
              </CardContent>
            </Card>
          ))}
          {(byStage[mobileStage] ?? []).length === 0 && (
            <div className="text-xs text-center text-muted-foreground py-8 border rounded">Kosong</div>
          )}
        </div>
      </div>

      {/* Desktop kanban */}
      <div className="hidden lg:grid lg:grid-cols-4 xl:grid-cols-8 gap-3">
        {HARI_H_STAGES.map((stage) => (
          <div key={stage} className="bg-white/60 rounded-lg border min-h-[200px] flex flex-col">
            <div className={`px-3 py-2 text-xs font-semibold border-b rounded-t-lg ${STAGE_BADGE[stage]}`}>
              {stage}
              <span className="ml-2 opacity-70">({byStage[stage].length})</span>
            </div>
            <div className="p-2 space-y-2 overflow-y-auto max-h-[70vh]">
              {byStage[stage].map((r) => (
                <Card key={r.exam_id} className="shadow-sm">
                  <CardContent className="p-3 space-y-2 text-xs">
                    <div className="font-semibold text-sm leading-tight">{r.full_name}</div>
                    <div>
                      <NoTestBadge testNumber={r.test_number} temporaryId={r.temporary_id} showLabel={false} />
                    </div>
                    {r.rank && <div className="text-muted-foreground">{r.rank}</div>}
                    {r.unit_position && <div className="text-muted-foreground truncate">{r.unit_position}</div>}
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className={INIT_STATUS_BADGE[r.ekg_initial_status as never] ?? ""}>EKG: {r.ekg_initial_status}</Badge>
                      <Badge variant="outline" className={INIT_STATUS_BADGE[r.radiology_initial_status as never] ?? ""}>RO: {r.radiology_initial_status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 pt-1">
                      <Button size="sm" variant="outline" className="h-7 text-[11px]"
                        onClick={() => setModal({ mode: "ekg", examId: r.exam_id, candidateId: r.candidate_id })}>
                        <Activity className="h-3 w-3 mr-1" /> EKG
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-[11px]"
                        onClick={() => setModal({ mode: "radiology", examId: r.exam_id, candidateId: r.candidate_id })}>
                        <Radio className="h-3 w-3 mr-1" /> Rontgen
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-[11px]" asChild>
                        <Link to="/rikkes/$id" params={{ id: r.exam_id }}>
                          <ExternalLink className="h-3 w-3 mr-1" /> Detail
                        </Link>
                      </Button>
                    </div>
                    <CandidateProgressPopover candidateId={r.candidate_id} candidateName={r.full_name} />
                  </CardContent>
                </Card>
              ))}
              {byStage[stage].length === 0 && (
                <div className="text-[11px] text-center text-muted-foreground py-6">Kosong</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <QuickSupportingModal
          open={true}
          onOpenChange={(v) => !v && setModal(null)}
          mode={modal.mode}
          examId={modal.examId}
          candidateId={modal.candidateId}
          onSaved={load}
        />
      )}
    </div>
  );
}