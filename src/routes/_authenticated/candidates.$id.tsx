import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/local-supabase-shim";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, Save, CheckCircle, Plus, Trash2, ShieldCheck, XCircle, Unlock } from "lucide-react";
import { SECTIONS, ROLE_LABELS, STATUS_BADGES } from "@/lib/sections";
import {
  calculateBMI,
  classifyBMI,
  calculateKesum,
  calculateKeswa,
  calculateFinalResult,
  calculateFinalScore,
  countClassifications,
  generateK1Notes,
  generateK2Notes,
  checkReadiness,
  recalculateExamSummary,
  type Classification,
  type SectionLite,
  type FindingNote,
} from "@/lib/rikkes-calculations";
import { logAudit } from "@/lib/audit";
import { FinalizationDialog } from "@/components/app/FinalizationDialog";
import { UnlockExamDialog } from "@/components/app/UnlockExamDialog";
import { FinalizationBanner } from "@/components/app/FinalizationBanner";
import { ConfidentialityBanner } from "@/components/app/ConfidentialityBanner";
import { NoTestBanner } from "@/components/app/NoTestBanner";
import { NoTestBadge } from "@/components/app/NoTestBadge";
import { AssignTestNumberDialog } from "@/components/app/AssignTestNumberDialog";
import { LinkParticipantDialog } from "@/components/app/LinkParticipantDialog";
import { PDFExportMenu } from "@/components/export/PDFExportMenu";
import { useAuth } from "@/lib/use-auth";
import { can, isExamLocked } from "@/lib/permissions";

// Sections that don't strictly require findings text on submit
const FINDINGS_OPTIONAL = new Set([
  "identitas",
  "anamnesa",
  "surat_pernyataan",
  "rekap_paraf",
]);

function parseJson<T>(s: string | null | undefined): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/_authenticated/candidates/$id")({
  component: CandidateDetail,
  validateSearch: (search: Record<string, unknown>) => ({
    focus: typeof search.focus === "string" ? (search.focus as string) : undefined,
  }),
});

type Section = {
  id: string;
  section_key: string;
  section_name: string;
  section_status: string;
  classification: string | null;
  findings: string | null;
  notes: string | null;
  assigned_role: string | null;
  examined_at: string | null;
};

function CandidateDetail() {
  const { id } = Route.useParams();
  const { focus } = Route.useSearch();
  const [cand, setCand] = useState<any>(null);
  const [exam, setExam] = useState<any>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [mm, setMm] = useState<any>(null);
  const [ms, setMs] = useState<any>(null);
  const [active, setActive] = useState<string>("identitas");
  const [tab, setTab] = useState<"pemeriksaan" | "resume" | "readiness">("pemeriksaan");
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [assignTnOpen, setAssignTnOpen] = useState(false);
  const [linkAcctOpen, setLinkAcctOpen] = useState(false);
  const [focusBanner, setFocusBanner] = useState<string | null>(null);
  const { roles } = useAuth();
  const locked = isExamLocked(exam?.exam_status);
  const canAssignTn = ["super_admin", "admin", "registrasi"].some((r) => roles.includes(r));
  const canLinkAcct = ["super_admin", "admin", "registrasi"].some((r) => roles.includes(r));

  async function load() {
    const { data: c } = await supabase.from("candidates").select("*").eq("id", id).maybeSingle();
    setCand(c ?? null);
    const { data: e } = await supabase.from("exams").select("*").eq("candidate_id", id).maybeSingle();
    setExam(e);
    if (e) {
      const { data: s } = await supabase.from("exam_sections").select("*").eq("exam_id", e.id);
      setSections((s ?? []) as Section[]);
      const { data: m } = await supabase.from("medical_measurements").select("*").eq("exam_id", e.id).maybeSingle();
      setMm(m);
      const { data: sm } = await supabase.from("medical_summary").select("*").eq("exam_id", e.id).maybeSingle();
      setMs(sm);
    }
  }
  useEffect(() => {
    load();
  }, [id]);

  // Handle ?focus= query param: open right section, scroll, show banner.
  useEffect(() => {
    if (!focus || !cand) return;
    const FOCUS_MAP: Record<string, { key?: string; tab?: "pemeriksaan" | "resume" | "readiness"; label: string }> = {
      ekg: { key: "ekg_ergo", tab: "pemeriksaan", label: "EKG/Ergo" },
      rontgen: { key: "radiologi_ro", tab: "pemeriksaan", label: "Radiologi/RO" },
      anamnesis: { key: "anamnesa", tab: "pemeriksaan", label: "Anamnesa" },
      screening: { key: "pemeriksaan_umum", tab: "pemeriksaan", label: "Screening Hari-H" },
      bedah: { key: "bedah", tab: "pemeriksaan", label: "Bedah" },
      mata: { key: "mata", tab: "pemeriksaan", label: "Mata" },
      tht: { key: "tht", tab: "pemeriksaan", label: "THT" },
      neuro: { key: "neurologi", tab: "pemeriksaan", label: "Neurologi" },
      no_test: { tab: "pemeriksaan", label: "Identitas Peserta (No Test)" },
    };
    const target = FOCUS_MAP[focus];
    if (!target) return;
    if (target.tab) setTab(target.tab);
    if (target.key) setActive(target.key);
    setFocusBanner(target.label);
    // Scroll to section editor area after render
    const t = setTimeout(() => {
      const el = document.getElementById("focus-target");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 250);
    const clear = setTimeout(() => setFocusBanner(null), 4000);
    return () => { clearTimeout(t); clearTimeout(clear); };
  }, [focus, cand]);

  const current = sections.find((s) => s.section_key === active);

  const summary = useMemo(() => {
    const lite: SectionLite[] = sections.map((s) => ({
      section_key: s.section_key,
      section_name: s.section_name,
      classification: s.classification,
      findings: s.findings,
      notes: s.notes,
      section_status: s.section_status,
    }));
    const bmi = calculateBMI(mm?.height_cm, mm?.weight_kg);
    const bmiClass = classifyBMI(bmi);
    const { kesum, missing } = calculateKesum(lite, bmiClass);
    const keswa = calculateKeswa(lite);
    const finalRes = calculateFinalResult(kesum, keswa);
    const counts = countClassifications(lite, bmiClass);
    const score = calculateFinalScore(kesum, finalRes, counts);
    const k1 = generateK1Notes(lite, bmiClass, bmi);
    const k2 = generateK2Notes(lite, keswa, bmiClass, bmi);
    const readiness = checkReadiness(lite, kesum, keswa, finalRes);
    return { kesum, keswa, finalRes, score, counts, bmi, bmiClass, k1, k2, missing, readiness };
  }, [sections, mm]);

  async function recompute() {
    if (!exam) return;
    await recalculateExamSummary(exam.id);
    await load();
    toast.success("Rekap diperbarui");
  }

  async function afterSectionSave() {
    if (exam) await recalculateExamSummary(exam.id);
    await load();
  }

  async function finalize() {
    if (!exam) return;
    if (!summary.readiness.ok) return toast.error("Belum siap finalisasi. Periksa tab Readiness.");
    if (summary.finalRes === "Belum Lengkap") return toast.error("Data belum lengkap");
    const { data: u } = await supabase.auth.getUser();
    await supabase
      .from("exams")
      .update({
        exam_status: "Finalized",
        finalized_by: u.user?.id,
        finalized_at: new Date().toISOString(),
      })
      .eq("id", exam.id);
    await supabase.from("exam_sections").update({ section_status: "Locked", locked_at: new Date().toISOString() }).eq("exam_id", exam.id);
    await logAudit({ action: "finalize", module: "exams", record_id: exam.id, candidate_id: id });
    toast.success("Pemeriksaan difinalisasi");
    await load();
  }

  if (!cand) return <div className="p-8">Memuat...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/candidates" className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Kembali
          </Link>
          <h1 className="text-2xl font-bold mt-1">{cand.full_name}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>{cand.rank} · {cand.nrp_nip}</span>
            <NoTestBadge
              testNumber={cand.test_number}
              temporaryId={cand.temporary_id}
              status={cand.test_number_status}
            />
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={STATUS_BADGES[(summary.kesum as keyof typeof STATUS_BADGES) ?? "Belum Lengkap"]}>KESUM: {summary.kesum}</Badge>
          <Badge className={STATUS_BADGES[(summary.keswa as keyof typeof STATUS_BADGES) ?? "Belum Lengkap"]}>KESWA: {summary.keswa}</Badge>
          <Badge className={STATUS_BADGES[(summary.finalRes as keyof typeof STATUS_BADGES) ?? "Belum Lengkap"]}>{summary.finalRes}</Badge>
          {summary.score != null && <Badge variant="outline">Nilai: {summary.score}</Badge>}
          {summary.bmi != null && <Badge variant="outline">IMT: {summary.bmi}{summary.bmiClass ? ` (${summary.bmiClass})` : ""}</Badge>}
          <Button size="sm" variant="outline" onClick={recompute} disabled={locked}>
            Hitung Ulang
          </Button>
          {can.exportDocs(roles) && <PDFExportMenu candidateId={id} />}
          {canLinkAcct && (
            <Button size="sm" variant={cand?.linked_user_id ? "outline" : "secondary"} onClick={() => setLinkAcctOpen(true)}>
              <ShieldCheck className="h-4 w-4 mr-1" />
              {cand?.linked_user_id ? "Akun Tertaut" : "Tautkan Akun"}
            </Button>
          )}
          {can.finalizeExam(roles) && !locked && (
            <Button size="sm" onClick={() => setFinalizeOpen(true)}>
              <CheckCircle className="h-4 w-4 mr-1" /> Finalisasi
            </Button>
          )}
          {can.unlockExam(roles) && locked && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setUnlockOpen(true)}
            >
              <Unlock className="h-4 w-4 mr-1" /> Unlock
            </Button>
          )}
        </div>
      </div>

      <ConfidentialityBanner compact />
      <FinalizationBanner exam={exam} />
      <NoTestBanner
        testNumber={cand.test_number}
        temporaryId={cand.temporary_id}
        canAssign={canAssignTn && !locked}
        onAssign={() => setAssignTnOpen(true)}
      />
      {focusBanner && (
        <div className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm text-blue-900 animate-in fade-in slide-in-from-top-1">
          Anda diarahkan ke bagian yang perlu dilengkapi: <strong>{focusBanner}</strong>.
        </div>
      )}
      <AssignTestNumberDialog
        open={assignTnOpen}
        onOpenChange={setAssignTnOpen}
        candidate={cand ? {
          id: cand.id,
          full_name: cand.full_name,
          temporary_id: cand.temporary_id,
          test_number: cand.test_number,
          selection_id: cand.selection_id,
        } : null}
        onSaved={load}
      />
      <LinkParticipantDialog
        open={linkAcctOpen}
        onOpenChange={setLinkAcctOpen}
        candidateId={id}
        candidateName={cand?.full_name ?? ""}
        candidateNrpNip={cand?.nrp_nip}
        currentLinkedUserId={cand?.linked_user_id}
        onChanged={load}
      />

      <SummaryPanel summary={summary} progress={Number(exam?.progress_percentage ?? 0)} />

      <div className="flex gap-2 border-b border-border">
        {(["pemeriksaan", "resume", "readiness"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px ${tab === t ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground"}`}
          >
            {t === "pemeriksaan" ? "Pemeriksaan" : t === "resume" ? "Resume Hasil" : "Readiness"}
          </button>
        ))}
      </div>

      {tab === "readiness" && <ReadinessPanel readiness={summary.readiness} missing={summary.missing} />}
      {tab === "resume" && exam && (
        <ResumePanel summary={summary} ms={ms} examId={exam.id} candidateId={id} onSaved={load} />
      )}

      {tab === "pemeriksaan" && (
      <div id="focus-target" className="grid grid-cols-12 gap-4 scroll-mt-20">
        <Card className="col-span-3">
          <CardContent className="p-2">
            <div className="space-y-0.5 max-h-[600px] overflow-auto">
              {SECTIONS.map((s) => {
                const found = sections.find((x) => x.section_key === s.key);
                return (
                  <button
                    key={s.key}
                    onClick={() => setActive(s.key)}
                    className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between ${active === s.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >
                    <span>{s.name}</span>
                    {found?.classification && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_BADGES[found.classification as keyof typeof STATUS_BADGES] ?? ""}`}>
                        {found.classification}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="col-span-9 space-y-4">
          {current && active === "pemeriksaan_umum" && mm && (
            <>
              <MeasurementsCard mm={mm} examId={exam?.id} onSaved={afterSectionSave} />
              <SectionEditor section={current} onSaved={afterSectionSave} variant="generic" />
            </>
          )}
          {current && active === "laboratorium" && (
            <SectionEditor section={current} onSaved={afterSectionSave} variant="lab" />
          )}
          {current && active === "gigi" && (
            <SectionEditor section={current} onSaved={afterSectionSave} variant="gigi" />
          )}
          {current && !["pemeriksaan_umum", "laboratorium", "gigi"].includes(active) && (
            <SectionEditor section={current} onSaved={afterSectionSave} variant="generic" />
          )}
        </div>
      </div>
      )}
      <FinalizationDialog
        open={finalizeOpen}
        onOpenChange={setFinalizeOpen}
        exam={exam}
        candidate={cand}
        sections={sections}
        summary={{
          kesum_classification: summary.kesum,
          keswa_status: summary.keswa,
          final_result: summary.finalRes,
          final_score: summary.score,
        }}
        onJumpSection={(k) => {
          setTab("pemeriksaan");
          setActive(k);
        }}
        onFinalized={load}
      />
      <UnlockExamDialog
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        exam={exam}
        candidate={cand}
        onUnlocked={load}
      />
    </div>
  );
}

function MeasurementsCard({ mm, examId, onSaved }: { mm: any; examId?: string; onSaved: () => void }) {
  const [h, setH] = useState(mm.height_cm ?? "");
  const [w, setW] = useState(mm.weight_kg ?? "");
  const [lp, setLp] = useState(mm.chest_or_waist_lp ?? "");
  const bmi = calculateBMI(Number(h) || null, Number(w) || null);
  const bmiClass = classifyBMI(bmi);

  async function save() {
    await supabase
      .from("medical_measurements")
      .update({
        height_cm: Number(h) || null,
        weight_kg: Number(w) || null,
        chest_or_waist_lp: Number(lp) || null,
        bmi,
        bmi_classification: bmiClass,
      })
      .eq("id", mm.id);
    if (examId) await recalculateExamSummary(examId);
    await logAudit({ action: "update_measurements", module: "medical_measurements", record_id: mm.id, after: { height_cm: h, weight_kg: w, bmi, bmi_classification: bmiClass } });
    toast.success("Pengukuran tersimpan");
    onSaved();
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Pengukuran Tubuh</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-4 gap-3">
        <div><Label className="text-xs">TB (cm)</Label><Input value={h} onChange={(e) => setH(e.target.value)} /></div>
        <div><Label className="text-xs">BB (kg)</Label><Input value={w} onChange={(e) => setW(e.target.value)} /></div>
        <div><Label className="text-xs">LP (cm)</Label><Input value={lp} onChange={(e) => setLp(e.target.value)} /></div>
        <div>
          <Label className="text-xs">IMT</Label>
          <div className="h-9 flex items-center gap-2">
            <span className="font-mono font-bold">{bmi ?? "-"}</span>
            {bmiClass && <Badge className={STATUS_BADGES[bmiClass as keyof typeof STATUS_BADGES]}>{bmiClass}</Badge>}
          </div>
        </div>
        <div className="col-span-4 flex justify-end">
          <Button onClick={save}><Save className="h-4 w-4 mr-1" /> Simpan</Button>
        </div>
      </CardContent>
    </Card>
  );
}

type LabItem = {
  parameter: string;
  hasil: string;
  satuan: string;
  rujukan: string;
  flag: "normal" | "abnormal";
  classification: "" | Classification;
  catatan: string;
};

type GigiPayload = {
  dmf?: string;
  gigi_vital?: string;
  gigi_kontak?: string;
  kelainan_gigi?: string;
  kelainan_mulut?: string;
  kelainan_rahang?: string;
  kebersihan?: string;
};

function SectionEditor({
  section,
  onSaved,
  variant,
}: {
  section: Section;
  onSaved: () => void;
  variant: "generic" | "lab" | "gigi";
}) {
  const [findings, setFindings] = useState(section.findings ?? "");
  const [cls, setCls] = useState<string>(section.classification ?? "");
  const [status, setStatus] = useState(section.section_status);
  const [examinedAt, setExaminedAt] = useState<string>(
    section.examined_at ? section.examined_at.slice(0, 16) : ""
  );
  const [saving, setSaving] = useState(false);

  // Generic notes (plain text)
  const initialPayload = useMemo(() => parseJson<any>(section.notes), [section.id]);
  const [plainNotes, setPlainNotes] = useState<string>(
    initialPayload && typeof initialPayload === "object" ? "" : (section.notes ?? "")
  );

  // Lab state
  const [labItems, setLabItems] = useState<LabItem[]>(
    (initialPayload?.lab_items as LabItem[]) ?? []
  );
  const [labNote, setLabNote] = useState<string>(initialPayload?.note ?? "");

  // Gigi state
  const [gigi, setGigi] = useState<GigiPayload>(
    (initialPayload?.gigi as GigiPayload) ?? {}
  );
  const [gigiNote, setGigiNote] = useState<string>(initialPayload?.note ?? "");

  useEffect(() => {
    setFindings(section.findings ?? "");
    setCls(section.classification ?? "");
    setStatus(section.section_status);
    setExaminedAt(section.examined_at ? section.examined_at.slice(0, 16) : "");
    const p = parseJson<any>(section.notes);
    if (p && typeof p === "object") {
      setPlainNotes("");
      setLabItems((p.lab_items as LabItem[]) ?? []);
      setLabNote(p.note ?? "");
      setGigi((p.gigi as GigiPayload) ?? {});
      setGigiNote(p.note ?? "");
    } else {
      setPlainNotes(section.notes ?? "");
      setLabItems([]);
      setLabNote("");
      setGigi({});
      setGigiNote("");
    }
  }, [section.id]);

  function buildNotes(): string {
    if (variant === "lab") {
      return JSON.stringify({ lab_items: labItems, note: labNote });
    }
    if (variant === "gigi") {
      return JSON.stringify({ gigi, note: gigiNote });
    }
    return plainNotes;
  }

  function validateSubmit(): string | null {
    if (!cls) return "Klasifikasi wajib diisi";
    if (!examinedAt) return "Tanggal pemeriksaan wajib diisi";
    if (!FINDINGS_OPTIONAL.has(section.section_key) && variant === "generic" && !findings.trim()) {
      return "Temuan pemeriksaan wajib diisi";
    }
    if (variant === "lab" && labItems.length === 0) {
      return "Minimal satu parameter laboratorium";
    }
    return null;
  }

  async function save(newStatus?: string) {
    if (newStatus === "Submitted") {
      const err = validateSubmit();
      if (err) {
        toast.error(err);
        return;
      }
    }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const patch: any = {
        findings,
        notes: buildNotes(),
        classification: cls || null,
        section_status: newStatus ?? status,
        examined_at: examinedAt ? new Date(examinedAt).toISOString() : new Date().toISOString(),
        examiner_id: u.user?.id,
      };
      if (newStatus === "Submitted") {
        patch.submitted_by = u.user?.id;
        patch.submitted_at = new Date().toISOString();
      }
      if (newStatus === "Approved") {
        patch.approved_by = u.user?.id;
        patch.approved_at = new Date().toISOString();
      }
      const { error } = await supabase.from("exam_sections").update(patch).eq("id", section.id);
      if (error) throw error;
      await logAudit({
        action: newStatus ? `section_${newStatus.toLowerCase()}` : "section_save",
        module: "exam_sections",
        record_id: section.id,
      });
      toast.success(newStatus === "Submitted" ? "Section disubmit" : "Tersimpan");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  function addLabItem() {
    setLabItems((prev) => [
      ...prev,
      { parameter: "", hasil: "", satuan: "", rujukan: "", flag: "normal", classification: "", catatan: "" },
    ]);
  }
  function updateLabItem(i: number, patch: Partial<LabItem>) {
    setLabItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function removeLabItem(i: number) {
    setLabItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">{section.section_name}</CardTitle>
          {section.assigned_role && (
            <p className="text-xs text-muted-foreground mt-1">
              Petugas: {ROLE_LABELS[section.assigned_role as keyof typeof ROLE_LABELS] ?? section.assigned_role}
            </p>
          )}
        </div>
        <Badge className={STATUS_BADGES[status as keyof typeof STATUS_BADGES] ?? ""}>{status}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Temuan Pemeriksaan</Label>
          <Textarea rows={3} value={findings} onChange={(e) => setFindings(e.target.value)} />
        </div>

        {variant === "lab" && (
          <div className="space-y-2 border rounded-md p-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Parameter Laboratorium</Label>
              <Button size="sm" variant="outline" onClick={addLabItem}>
                <Plus className="h-3 w-3 mr-1" /> Tambah
              </Button>
            </div>
            {labItems.length === 0 && <p className="text-xs text-muted-foreground">Belum ada parameter.</p>}
            {labItems.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start">
                <Input className="col-span-3" placeholder="Parameter" value={it.parameter} onChange={(e) => updateLabItem(i, { parameter: e.target.value })} />
                <Input className="col-span-2" placeholder="Hasil" value={it.hasil} onChange={(e) => updateLabItem(i, { hasil: e.target.value })} />
                <Input className="col-span-1" placeholder="Sat" value={it.satuan} onChange={(e) => updateLabItem(i, { satuan: e.target.value })} />
                <Input className="col-span-2" placeholder="Rujukan" value={it.rujukan} onChange={(e) => updateLabItem(i, { rujukan: e.target.value })} />
                <select className="col-span-1 h-9 rounded-md border border-input bg-background px-2 text-xs" value={it.flag} onChange={(e) => updateLabItem(i, { flag: e.target.value as any })}>
                  <option value="normal">N</option>
                  <option value="abnormal">Ab</option>
                </select>
                <select className="col-span-1 h-9 rounded-md border border-input bg-background px-2 text-xs" value={it.classification} onChange={(e) => updateLabItem(i, { classification: e.target.value as any })}>
                  <option value="">-</option>
                  {["B", "C", "K1", "K2", "TH"].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <Input className="col-span-1" placeholder="Catatan" value={it.catatan} onChange={(e) => updateLabItem(i, { catatan: e.target.value })} />
                <Button size="icon" variant="ghost" className="col-span-1" onClick={() => removeLabItem(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div>
              <Label className="text-xs">Catatan Lab</Label>
              <Input value={labNote} onChange={(e) => setLabNote(e.target.value)} />
            </div>
          </div>
        )}

        {variant === "gigi" && (
          <div className="grid grid-cols-2 gap-3 border rounded-md p-3 bg-muted/30">
            <div><Label className="text-xs">DMF</Label><Input value={gigi.dmf ?? ""} onChange={(e) => setGigi({ ...gigi, dmf: e.target.value })} /></div>
            <div><Label className="text-xs">Gigi Vital</Label><Input value={gigi.gigi_vital ?? ""} onChange={(e) => setGigi({ ...gigi, gigi_vital: e.target.value })} /></div>
            <div><Label className="text-xs">Kontak Oklusi/Sentris</Label><Input value={gigi.gigi_kontak ?? ""} onChange={(e) => setGigi({ ...gigi, gigi_kontak: e.target.value })} /></div>
            <div><Label className="text-xs">Kebersihan Mulut</Label><Input value={gigi.kebersihan ?? ""} onChange={(e) => setGigi({ ...gigi, kebersihan: e.target.value })} /></div>
            <div className="col-span-2"><Label className="text-xs">Kelainan Gigi</Label><Input value={gigi.kelainan_gigi ?? ""} onChange={(e) => setGigi({ ...gigi, kelainan_gigi: e.target.value })} /></div>
            <div className="col-span-2"><Label className="text-xs">Kelainan Dalam Mulut</Label><Input value={gigi.kelainan_mulut ?? ""} onChange={(e) => setGigi({ ...gigi, kelainan_mulut: e.target.value })} /></div>
            <div className="col-span-2"><Label className="text-xs">Kelainan Rahang</Label><Input value={gigi.kelainan_rahang ?? ""} onChange={(e) => setGigi({ ...gigi, kelainan_rahang: e.target.value })} /></div>
            <div className="col-span-2"><Label className="text-xs">Catatan</Label><Input value={gigiNote} onChange={(e) => setGigiNote(e.target.value)} /></div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Klasifikasi *</Label>
            <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={cls} onChange={(e) => setCls(e.target.value)}>
              <option value="">— Pilih —</option>
              {["B", "C", "K1", "K2", "TH"].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Tanggal Pemeriksaan *</Label>
            <Input type="datetime-local" value={examinedAt} onChange={(e) => setExaminedAt(e.target.value)} />
          </div>
          {variant === "generic" && (
            <div>
              <Label className="text-xs">Catatan</Label>
              <Input value={plainNotes} onChange={(e) => setPlainNotes(e.target.value)} />
            </div>
          )}
        </div>

        {section.examined_at && (
          <p className="text-[11px] text-muted-foreground">
            Terakhir diperbarui: {new Date(section.examined_at).toLocaleString("id-ID")}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" disabled={saving} onClick={() => save("Draft")}>Save Draft</Button>
          <Button disabled={saving} onClick={() => save("Submitted")}>Submit Section</Button>
          <Button variant="secondary" disabled={saving} onClick={() => save("Approved")}>Approve</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============= Summary / Resume / Readiness Panels =============

function StatTile({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className={`text-lg font-bold mt-1 ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function SummaryPanel({ summary, progress }: { summary: any; progress: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Ringkasan Otomatis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <StatTile label="KESUM" value={<Badge className={STATUS_BADGES[summary.kesum as keyof typeof STATUS_BADGES] ?? ""}>{summary.kesum}</Badge>} />
          <StatTile label="KESWA" value={<Badge className={STATUS_BADGES[summary.keswa as keyof typeof STATUS_BADGES] ?? ""}>{summary.keswa}</Badge>} />
          <StatTile label="Hasil Akhir" value={<Badge className={STATUS_BADGES[summary.finalRes as keyof typeof STATUS_BADGES] ?? ""}>{summary.finalRes}</Badge>} />
          <StatTile label="Nilai" value={summary.score ?? "—"} />
          <StatTile label="IMT" value={summary.bmi ?? "—"} />
          <StatTile label="Klasifikasi IMT" value={summary.bmiClass ? <Badge className={STATUS_BADGES[summary.bmiClass as keyof typeof STATUS_BADGES] ?? ""}>{summary.bmiClass}</Badge> : "—"} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <StatTile label="B" value={summary.counts.B} tone="text-emerald-600" />
          <StatTile label="C" value={summary.counts.C} tone="text-yellow-600" />
          <StatTile label="K1" value={summary.counts.K1} tone="text-orange-600" />
          <StatTile label="K2" value={summary.counts.K2} tone="text-rose-600" />
          <StatTile label="TH" value={summary.counts.TH} tone="text-slate-500" />
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span>Progress Pemeriksaan</span>
            <span className="font-mono">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <NotesList title="Keterangan K1" items={summary.k1} emptyText="Tidak ada temuan K1" />
          <NotesList title="Keterangan K2 / TMS" items={summary.k2} emptyText="Tidak ada temuan K2/TMS" />
        </div>
      </CardContent>
    </Card>
  );
}

function NotesList({ title, items, emptyText }: { title: string; items: FindingNote[]; emptyText: string }) {
  return (
    <div className="rounded-md border border-border p-3 bg-muted/20">
      <div className="text-xs font-semibold mb-2">{title}</div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {items.map((n, i) => (
            <li key={i} className="flex gap-2">
              <Badge className={STATUS_BADGES[n.classification as keyof typeof STATUS_BADGES] ?? ""}>{n.classification}</Badge>
              <span>
                <span className="font-medium">{n.section}:</span>{" "}
                {[n.finding, n.notes].filter(Boolean).join(" — ") || <em className="text-muted-foreground">tanpa catatan</em>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReadinessPanel({ readiness, missing }: { readiness: any; missing: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {readiness.ok ? <ShieldCheck className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-rose-600" />}
          Check Readiness for Finalization
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <ul className="space-y-1.5">
          {readiness.items.map((it: any, i: number) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              {it.ok ? (
                <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 text-rose-600 mt-0.5" />
              )}
              <div>
                <div>{it.label}</div>
                {it.detail && <div className="text-xs text-muted-foreground">{it.detail}</div>}
              </div>
            </li>
          ))}
        </ul>
        {missing.length > 0 && (
          <div className="text-xs text-muted-foreground border-t border-border pt-2">
            Section wajib belum berklasifikasi: {missing.join(", ")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResumePanel({
  summary,
  ms,
  examId,
  candidateId,
  onSaved,
}: {
  summary: any;
  ms: any;
  examId: string;
  candidateId: string;
  onSaved: () => void;
}) {
  const [attention, setAttention] = useState(ms?.attention_notes ?? "");
  const [parade, setParade] = useState(ms?.parade_notes ?? "");
  const [initial, setInitial] = useState(ms?.initial_result ?? "");
  const [afterParade, setAfterParade] = useState(ms?.after_parade_result ?? "");
  const [rakor, setRakor] = useState(ms?.rakor_result ?? "");
  const [pra, setPra] = useState(ms?.pra_pantukhir_result ?? "");
  const [sugg, setSugg] = useState(ms?.suggestions ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAttention(ms?.attention_notes ?? "");
    setParade(ms?.parade_notes ?? "");
    setInitial(ms?.initial_result ?? "");
    setAfterParade(ms?.after_parade_result ?? "");
    setRakor(ms?.rakor_result ?? "");
    setPra(ms?.pra_pantukhir_result ?? "");
    setSugg(ms?.suggestions ?? "");
  }, [ms?.id]);

  async function save() {
    if (!ms) return;
    setSaving(true);
    try {
      const before = {
        attention_notes: ms.attention_notes,
        parade_notes: ms.parade_notes,
        initial_result: ms.initial_result,
        after_parade_result: ms.after_parade_result,
        rakor_result: ms.rakor_result,
        pra_pantukhir_result: ms.pra_pantukhir_result,
        suggestions: ms.suggestions,
      };
      const after = {
        attention_notes: attention,
        parade_notes: parade,
        initial_result: initial,
        after_parade_result: afterParade,
        rakor_result: rakor,
        pra_pantukhir_result: pra,
        suggestions: sugg,
      };
      const { error } = await supabase.from("medical_summary").update(after).eq("id", ms.id);
      if (error) throw error;
      await logAudit({
        action: "update_resume",
        module: "medical_summary",
        record_id: ms.id,
        candidate_id: candidateId,
        before,
        after,
      });
      toast.success("Resume tersimpan");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Resume Hasil Pemeriksaan</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <KV label="KESUM" value={summary.kesum} />
          <KV label="KESWA" value={summary.keswa} />
          <KV label="Hasil Akhir" value={summary.finalRes} />
          <KV label="Nilai" value={summary.score ?? "—"} />
          <KV label="IMT" value={summary.bmi ?? "—"} />
          <KV label="Klasifikasi IMT" value={summary.bmiClass ?? "—"} />
          <KV label="Jumlah B" value={summary.counts.B} />
          <KV label="Jumlah C" value={summary.counts.C} />
          <KV label="Jumlah K1" value={summary.counts.K1} />
          <KV label="Jumlah K2" value={summary.counts.K2} />
          <KV label="Jumlah TH" value={summary.counts.TH} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <NotesList title="Keterangan K1" items={summary.k1} emptyText="Tidak ada temuan K1" />
        <NotesList title="Keterangan K2 / TMS" items={summary.k2} emptyText="Tidak ada temuan K2/TMS" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Catatan Administratif</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label className="text-xs">Hasil Awal</Label><Input value={initial} onChange={(e) => setInitial(e.target.value)} /></div>
          <div><Label className="text-xs">Hasil Setelah Parade</Label><Input value={afterParade} onChange={(e) => setAfterParade(e.target.value)} /></div>
          <div><Label className="text-xs">Hasil Rakor</Label><Input value={rakor} onChange={(e) => setRakor(e.target.value)} /></div>
          <div><Label className="text-xs">Hasil Pra Pantukhir</Label><Input value={pra} onChange={(e) => setPra(e.target.value)} /></div>
          <div className="md:col-span-2"><Label className="text-xs">Catatan Atensi</Label><Textarea rows={2} value={attention} onChange={(e) => setAttention(e.target.value)} /></div>
          <div className="md:col-span-2"><Label className="text-xs">Catatan Parade</Label><Textarea rows={2} value={parade} onChange={(e) => setParade(e.target.value)} /></div>
          <div className="md:col-span-2"><Label className="text-xs">Saran</Label><Textarea rows={2} value={sugg} onChange={(e) => setSugg(e.target.value)} /></div>
          <div className="md:col-span-2 flex justify-end">
            <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" /> Simpan Resume</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}