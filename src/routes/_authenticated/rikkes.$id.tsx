import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback, lazy, Suspense } from "react";
import { supabase } from "@/lib/local-supabase-shim";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Save, Send, Undo2, FileText, Edit2, Check, Lock, AlertTriangle, Pencil, X } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";
import { RIKKES_GROUPS, CLINICAL_ITEMS, TEETH_TOP, TEETH_BOTTOM, TOOTH_CODES, TOOTH_COLOR, SELF_MANAGED_GROUPS, type RikkesGroupKey } from "@/lib/rikkes-form-groups";
import { allowedRikkesGroups, isRestrictedDokterUmum, isReadOnlyViewer } from "@/lib/rikkes-role-access";
import { EkgRoBanner } from "@/components/hari-h/EkgRoBanner";
import { AttachmentsSheet } from "@/components/hari-h/AttachmentsSheet";
import { BypassDialog } from "@/components/hari-h/BypassDialog";
import { evaluateGate, loadHariHSettings, type HariHSettings } from "@/lib/hari-h-gating";
import { syncGroupToRekap } from "@/lib/rekap-sync";
import { getDb, getDisplayStatusLocal, normalizeSectionStatus, isSectionCompleted, syncNeurologiLabKeswaStatusLocal, resolveRikkesDetailLocal, logAuditLocal } from "@/lib/localDb";
import { ensureExamForCandidateLocal } from "@/lib/services/examService";
import { AppErrorBoundary } from "@/components/app/AppErrorBoundary";

// Lazy-load heavy form components so initial detail render only ships the active section.
const IdentitasAnamnesisForm = lazy(() => import("@/components/rikkes/IdentitasAnamnesisForm").then(m => ({ default: m.IdentitasAnamnesisForm })));
const PemeriksaanUmumForm = lazy(() => import("@/components/rikkes/PemeriksaanUmumForm").then(m => ({ default: m.PemeriksaanUmumForm })));
const ScreeningHariHForm = lazy(() => import("@/components/hari-h/ScreeningHariHForm").then(m => ({ default: m.ScreeningHariHForm })));
const ThtForm = lazy(() => import("@/components/subteam/ThtForm").then(m => ({ default: m.ThtForm })));
const NeurologyForm = lazy(() => import("@/components/subteam/NeurologyForm").then(m => ({ default: m.NeurologyForm })));
const EyeVisionForm = lazy(() => import("@/components/subteam/EyeVisionForm").then(m => ({ default: m.EyeVisionForm })));
const SurgeryForm = lazy(() => import("@/components/subteam/SurgeryForm").then(m => ({ default: m.SurgeryForm })));
const DentalOdontogramForm = lazy(() => import("@/components/subteam/DentalOdontogramForm").then(m => ({ default: m.DentalOdontogramForm })));
const LabSubteamForm = lazy(() => import("@/components/subteam/LabForm").then(m => ({ default: m.LabForm })));
const PsychologyForm = lazy(() => import("@/components/subteam/PsychologyForm").then(m => ({ default: m.PsychologyForm })));

export const Route = createFileRoute("/_authenticated/rikkes/$id")({
  component: RikkesDetailRoute,
});

function RikkesDetailRoute() {
  return <AppErrorBoundary scope="Detail RIKKES"><RikkesDetail /></AppErrorBoundary>;
}

type Group = {
  id: string;
  group_key: string;
  status: string;
  form_data_json: any;
  submitted_at: string | null;
  return_reason: string | null;
};

function RikkesDetail() {
  const { id } = Route.useParams();
  const search = Route.useSearch() as any;

  const navigate = useNavigate();
  const { roles } = useAuth();
  const [cand, setCand] = useState<any>(null);
  const [currentExam, setCurrentExam] = useState<any>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [active, setActive] = useState<RikkesGroupKey>("identitas_anamnesis");
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [settings, setSettings] = useState<HariHSettings | null>(null);
  const [bypassPrompt, setBypassPrompt] = useState<{ key: RikkesGroupKey; data: any; reasons: string[] } | null>(null);

  const viewerOnly = isReadOnlyViewer(roles);
  const canReturn = !viewerOnly && can.approveSection(roles); // super_admin, admin, kepala_sub_tim

  const allowedGroups = useMemo(() => allowedRikkesGroups(roles), [roles]);
  const visibleGroups = useMemo(
    () => RIKKES_GROUPS.filter((g) => allowedGroups === "all" || allowedGroups.has(g.key)),
    [allowedGroups],
  );
  const restrictedBadge = isRestrictedDokterUmum(roles);

  // If current active group is not allowed for this role, snap to first visible
  useEffect(() => {
    if (allowedGroups !== "all" && !allowedGroups.has(active) && visibleGroups[0]) {
      setActive(visibleGroups[0].key);
    }
  }, [allowedGroups, active, visibleGroups]);
  const canEdit = !viewerOnly && (can.editMedical(roles) || can.editCandidate(roles));

  const load = useCallback(async () => {
    let resolved = resolveRikkesDetailLocal(id, {
      candidateId: search?.candidateId,
      selectionId: search?.selectionId,
      temporaryId: search?.temporaryId,
      testNumber: search?.testNumber,
    });
    let nextExam = resolved.exam ?? null;
    const nextCandidate = resolved.candidate ?? null;
    if (!nextExam && nextCandidate?.id) {
      nextExam = ensureExamForCandidateLocal(nextCandidate.id);
      resolved = resolveRikkesDetailLocal(nextExam.id, {
        candidateId: nextCandidate.id,
        selectionId: nextCandidate.selection_id ?? search?.selectionId ?? null,
        temporaryId: search?.temporaryId ?? null,
        testNumber: search?.testNumber ?? null,
      });
      nextExam = resolved.exam ?? nextExam;
    }
    setCand(nextCandidate);
    setCurrentExam(nextExam);
    setGroups((resolved.sections ?? []).map((g: any) => ({
      id: g.id,
      group_key: g.section_key,
      status: g.section_status,
      form_data_json: g.form_data_json ?? {},
      submitted_at: g.submitted_at ?? null,
      return_reason: g.return_reason ?? null,
    })));
    setSettings(await loadHariHSettings(resolved.exam?.selection_id ?? search?.selectionId ?? null));
    setLoading(false);
    logAuditLocal(`detail_lookup_by_${resolved.source}`, {
      candidate_id: resolved.candidate?.id ?? search?.candidateId ?? null,
      exam_id: resolved.exam?.id ?? id ?? null,
      selection_id: search?.selectionId ?? resolved.candidate?.selection_id ?? null,
      route_params_json: { id, search },
      lookup_result_json: { source: resolved.source, error: resolved.error },
    });
  }, [id, search]);


  useEffect(() => {
    load();
    logAudit({ action: "open_detail_exam", module: "rikkes", record_id: id, candidate_id: id });
  }, [id, load]);

  useEffect(() => {
    if (!currentExam?.id) return;
    syncNeurologiLabKeswaStatusLocal(currentExam.id);
    void load();
  }, [currentExam?.id]);

  function getGroup(key: string): Group | undefined {
    return groups.find((g) => g.group_key === key);
  }

  async function persistGroup(key: RikkesGroupKey, patch: Record<string, any>) {
    if (!currentExam) return null;
    const { data: u } = await supabase.auth.getUser();
    const existing = getGroup(key);
    if (existing) {
      const { data, error } = await supabase
        .from("rikkes_form_sections")
        .update({ ...patch, updated_by: u.user?.id })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from("rikkes_form_sections")
        .insert({
          exam_id: currentExam.id,
          candidate_id: id,
          group_key: key,
          created_by: u.user?.id,
          updated_by: u.user?.id,
          status: "Draft",
          form_data_json: {},
          ...patch,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  }

  async function saveDraft(key: RikkesGroupKey, data: any) {
    try {
      await persistGroup(key, { form_data_json: data, status: getGroup(key)?.status === "Submitted" ? "Submitted" : "Draft" });
      await logAudit({ action: "save_draft_section", module: "rikkes", record_id: currentExam?.id, candidate_id: id, after: { group_key: key } });
      if (currentExam) {
        const nextStatus = getGroup(key)?.status === "Submitted" ? "Submitted" : "Draft";
        await syncGroupToRekap({ examId: currentExam.id, candidateId: id, groupKey: key, status: nextStatus, payload: data });
      }
      toast.success("Draft tersimpan");
      await load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function submit(key: RikkesGroupKey, data: any) {
    if (!currentExam || !settings) return;
    const gate = await evaluateGate({
      examId: currentExam.id,
      groupKey: key,
      settings,
      bypassed: !!currentExam.bypass_initial_at,
    });
    if (!gate.allowed) {
      if (gate.canBypass) {
        setBypassPrompt({ key, data, reasons: gate.reasons });
      } else {
        toast.error(`Tidak dapat submit: ${gate.reasons.join(", ")}`);
      }
      return;
    }
    await doSubmit(key, data);
  }

  async function doSubmit(key: RikkesGroupKey, data: any) {
    try {
      const { data: u } = await supabase.auth.getUser();
      await persistGroup(key, {
        form_data_json: data,
        status: "Submitted",
        submitted_by: u.user?.id,
        submitted_at: new Date().toISOString(),
      } as any);
      await logAudit({ action: "submit_form_section", module: "rikkes", record_id: currentExam?.id, candidate_id: id, after: { group_key: key } });
      if (currentExam) {
        await syncGroupToRekap({ examId: currentExam.id, candidateId: id, groupKey: key, status: "Submitted", payload: data });
      }
      toast.success("Formulir disubmit");
      await load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function confirmBypass(reason: string) {
    if (!bypassPrompt || !currentExam) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("exams")
      .update({
        bypass_initial_reason: reason,
        bypass_initial_by: u.user?.id,
        bypass_initial_at: new Date().toISOString(),
      })
      .eq("id", currentExam.id);
    if (error) { toast.error(error.message); return; }
    // Persist to dedicated audit table
    if (u.user?.id) {
      await supabase.from("bypass_audit").insert({
        exam_id: currentExam.id,
        candidate_id: id,
        section_key: bypassPrompt.key as string,
        bypass_type: "screening",
        reason,
        status: "pending",
        requested_by: u.user.id,
        metadata: { reasons: bypassPrompt.reasons } as any,
      });
    }
    await logAudit({
      action: "bypass_hari_h_gating",
      module: "rikkes",
      record_id: currentExam.id,
      candidate_id: id,
      after: { group_key: bypassPrompt.key, reason, reasons: bypassPrompt.reasons },
    });
    const { key, data } = bypassPrompt;
    setBypassPrompt(null);
    await doSubmit(key, data);
  }

  async function returnToDraft(key: RikkesGroupKey, reason: string) {
    try {
      const { data: u } = await supabase.auth.getUser();
      await persistGroup(key, {
        status: "Draft",
        returned_to_draft_by: u.user?.id,
        returned_to_draft_at: new Date().toISOString(),
        return_reason: reason,
      } as any);
      await logAudit({ action: "return_section_to_draft", module: "rikkes", record_id: currentExam?.id, candidate_id: id, after: { group_key: key, reason } });
      toast.success("Dikembalikan ke Draft");
      await load();
    } catch (e: any) { toast.error(e.message); }
  }

  const selectionLabel = useMemo(() => {
    const db = getDb() as any;
    const selectionId = cand?.selection_id;
    if (!selectionId) return "";
    const selection = (db.selections ?? []).find((s: any) => s.id === selectionId);
    return selection?.selection_name ?? selection?.name ?? "";
  }, [cand?.selection_id]);

  if (loading) {
    return <RikkesDetailSkeleton />;
  }
  if (!cand) {
    return <div className="p-8 space-y-3"><div className="text-slate-700 font-semibold">Peserta tidak ditemukan</div><div className="text-slate-500 text-sm">Data peserta tidak dapat ditemukan berdasarkan ID yang dikirim dari halaman sebelumnya.</div><div className="text-xs text-slate-500">id={id} candidateId={String(search?.candidateId ?? "-")} selectionId={String(search?.selectionId ?? "-")}</div></div>;
  }
  const activeGroup = getGroup(active);
  const activeStatusRaw = activeGroup?.status ?? "Draft";
  const activeMap: Record<string, string> = { neurologi_subtim: "neurologi", laboratorium: "laboratorium", psikologi_subtim: "jiwa_keswa" };
  const activeStatus = currentExam?.id && activeMap[active] ? getDisplayStatusLocal(currentExam.id, activeMap[active], (getDb() as any)?.settings?.neuro_required ?? true) : activeStatusRaw;
  const locked = activeStatus === "Locked";
  const submitted = activeStatus === "Submitted" || activeStatus === "Approved";
  const readOnly = viewerOnly || locked || (submitted && !canEdit);

  return (
    <div className="p-6 lg:p-8 space-y-6 min-h-screen">
      {/* Header personel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{cand.full_name}</h1>
          <p className="text-sm text-slate-600 mt-1">
            NRP: <span className="font-mono">{cand.nrp_nip ?? "-"}</span> | Pangkat: {cand.rank ?? "-"} | Satuan: {cand.unit_position ?? "-"}
          </p>
          {viewerOnly && (
            <Badge className="mt-2 bg-sky-100 text-sky-800 border-sky-200 border rounded-full text-[11px]">
              Mode Lihat Saja (Read-Only)
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Kembali ke Dashboard
          </Button>
          {currentExam?.id && (
            <AttachmentsSheet examId={currentExam.id} candidateId={cand?.id} candidateName={cand?.full_name} />
          )}
        </div>
      </div>

      {currentExam?.id && <EkgRoBanner examId={currentExam.id} candidateId={cand?.id} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Panel Bagian Formulir */}
        <aside className="lg:col-span-4 xl:col-span-3">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="font-bold text-slate-900">Bagian Formulir</h2>
              {restrictedBadge && (
                <p className="mt-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
                  Akses Terbatas: Dokter Umum
                </p>
              )}
            </div>
            <div className="p-2 space-y-1">
              {visibleGroups.map((g) => {
                const grp = getGroup(g.key);
                const stRaw = grp?.status ?? "Draft";
                const mapKey: Record<string, string> = { neurologi_subtim: "neurologi", laboratorium: "laboratorium", psikologi_subtim: "jiwa_keswa" };
                const st = currentExam?.id && mapKey[g.key] ? getDisplayStatusLocal(currentExam.id, mapKey[g.key], (getDb() as any)?.settings?.neuro_required ?? true) : stRaw;
                const isActive = active === g.key;
                const accent =
                  st === "Submitted" || st === "Approved" ? "border-l-emerald-500"
                  : st === "Revision" ? "border-l-orange-500"
                  : st === "Locked" ? "border-l-slate-500"
                  : "border-l-amber-400";
                return (
                  <button
                    key={g.key}
                    onClick={() => { setActive(g.key); logAudit({ action: "open_form_section", module: "rikkes", record_id: currentExam?.id, candidate_id: id, after: { group_key: g.key } }); }}
                    className={`w-full text-left rounded-md border-l-4 ${accent} px-3 py-2.5 text-sm font-medium flex items-center justify-between gap-2 transition ${
                      isActive ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-slate-50 text-slate-800"
                    }`}
                  >
                    <span className="flex-1 truncate">{g.label}</span>
                    {st === "Locked" ? <Lock className="h-3.5 w-3.5 shrink-0" />
                      : st === "Submitted" || st === "Approved" ? <Check className="h-3.5 w-3.5 shrink-0" />
                      : <Edit2 className="h-3.5 w-3.5 shrink-0 opacity-60" />}
                  </button>
                );
              })}
              {visibleGroups.length === 0 && (
                <p className="text-xs text-slate-500 px-3 py-2">
                  Anda tidak memiliki akses ke section formulir RIKKES.
                </p>
              )}
            </div>
            <div className="p-3 border-t border-slate-200 space-y-2">
              <Button className="w-full bg-slate-700 hover:bg-slate-800 text-white" onClick={() => { if (currentExam?.id) { syncNeurologiLabKeswaStatusLocal(currentExam.id); } setPreviewOpen(true); logAudit({ action: "preview_pdf", module: "rikkes", record_id: currentExam?.id, candidate_id: id }); }}>
                <FileText className="h-4 w-4 mr-2" /> Preview & Finalisasi PDF
              </Button>
              {(roles.includes("super_admin") || roles.includes("admin")) && currentExam?.id && (
                <Button variant="outline" className="w-full" onClick={() => { if (currentExam?.id) { syncNeurologiLabKeswaStatusLocal(currentExam.id); } void load(); toast.success("Status Neurologi, Laboratorium, dan Keswa berhasil disinkronkan."); }}>Sinkronkan Status Formulir</Button>
              )}
            </div>
          </div>
        </aside>

        {/* Form aktif */}
        <section className="lg:col-span-8 xl:col-span-9">
          {allowedGroups !== "all" && !allowedGroups.has(active) ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
              <Lock className="h-10 w-10 mx-auto text-slate-400 mb-3" />
              <h3 className="text-lg font-semibold text-slate-900">403 — Akses Ditolak</h3>
              <p className="text-sm text-slate-600 mt-1">
                Anda tidak memiliki akses ke section ini.
              </p>
            </div>
          ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <FormHeader
              groupLabel={RIKKES_GROUPS.find((g) => g.key === active)?.label ?? ""}
              status={activeStatus}
              canReturn={canReturn}
              onReturn={(reason) => returnToDraft(active, reason)}
              renderActions={(formData) => (
                <FormActions
                  status={activeStatus}
                  canEdit={canEdit}
                  onSaveDraft={() => saveDraft(active, formData)}
                  onSubmit={() => submit(active, formData)}
                />
              )}
              data={activeGroup?.form_data_json ?? {}}
              readOnly={readOnly}
              active={active}
              cand={cand}
              examId={currentExam?.id}
              onSaveDraft={(d) => saveDraft(active, d)}
              onSubmit={(d) => submit(active, d)}
              canEditAfterSubmit={canEdit}
              onPersisted={load}
              onSaveRevision={async (d, reason) => {
                try {
                  await persistGroup(active, { form_data_json: d, status: "Submitted" });
                  await logAudit({
                    action: "revise_section_after_submit",
                    module: "rikkes",
                    record_id: currentExam?.id,
                    candidate_id: id,
                    after: { group_key: active, reason },
                  });
                  if (currentExam) {
                    await syncGroupToRekap({ examId: currentExam.id, candidateId: id, groupKey: active, status: "Submitted", payload: d });
                  }
                  toast.success("Revisi tersimpan, status tetap Submitted");
                  await load();
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
            />
          </div>
          )}
        </section>
      </div>

      <PreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} cand={cand} groups={groups} currentExam={currentExam} />

      {bypassPrompt && (
        <BypassDialog
          open={!!bypassPrompt}
          onOpenChange={(v) => { if (!v) setBypassPrompt(null); }}
          reasons={bypassPrompt.reasons}
          onConfirm={confirmBypass}
        />
      )}
    </div>
  );
}

/* -------------------- Form header & active form router -------------------- */

function FormHeader(props: {
  groupLabel: string;
  status: string;
  canReturn: boolean;
  onReturn: (reason: string) => void;
  renderActions?: (formData: any) => React.ReactNode;
  data: any;
  readOnly: boolean;
  active: RikkesGroupKey;
  cand: any;
  examId: string | undefined;
  onSaveDraft: (data: any) => void;
  onSubmit: (data: any) => void;
  canEditAfterSubmit?: boolean;
  onPersisted?: () => void;
  onSaveRevision?: (data: any, reason: string) => void | Promise<void>;
}) {
  const { groupLabel, status, canReturn, onReturn, data, readOnly, active, cand, examId, onSaveDraft, onSubmit, canEditAfterSubmit, onPersisted, onSaveRevision } = props;
  const [formData, setFormData] = useState<any>(data ?? {});
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [reviseReason, setReviseReason] = useState("");

  useEffect(() => { setFormData(data ?? {}); setEditMode(false); }, [data, active]);

  const submittedState = status === "Submitted" || status === "Approved";
  const isSelfManaged = SELF_MANAGED_GROUPS.has(active);
  const showEditBtn = submittedState && !!canEditAfterSubmit && !readOnly && !isSelfManaged && !editMode && !!onSaveRevision;
  const inRevisionHost = editMode && submittedState && !isSelfManaged;
  const effectiveReadOnly = readOnly || (submittedState && !isSelfManaged && !inRevisionHost);
  const reviseValid = reviseReason.trim().length >= 3;

  const statusStyle: Record<string, string> = {
    Draft: "bg-amber-100 text-amber-800 border-amber-200",
    Submitted: "bg-emerald-100 text-emerald-700 border-emerald-200",
    Approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
    Revision: "bg-orange-100 text-orange-700 border-orange-200",
    Locked: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <>
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900">{groupLabel}</h2>
          <Badge className={`${statusStyle[status] ?? statusStyle.Draft} border rounded-full text-[11px]`}>Status: {status}</Badge>
        </div>
        <div className="flex gap-2">
          {(status === "Submitted" || status === "Approved") && canReturn && (
            <Button variant="destructive" size="sm" onClick={() => setReturnOpen(true)}>
              <Undo2 className="h-4 w-4 mr-1.5" /> Kembalikan ke Draft
            </Button>
          )}
          {(status === "Draft" || status === "Revision") && !readOnly && !isSelfManaged && (
            <>
              <Button variant="outline" size="sm" onClick={() => onSaveDraft(formData)}>
                <Save className="h-4 w-4 mr-1.5" /> Simpan Draft
              </Button>
              <Button size="sm" onClick={() => onSubmit(formData)}>
                <Send className="h-4 w-4 mr-1.5" /> Submit
              </Button>
            </>
          )}
          {showEditBtn && (
            <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
              <Pencil className="h-4 w-4 mr-1.5" /> Edit Data
            </Button>
          )}
          {inRevisionHost && (
            <>
              <Button size="sm" variant="ghost" onClick={() => { setEditMode(false); setFormData(data ?? {}); }}>
                <X className="h-4 w-4 mr-1.5" /> Batal
              </Button>
              <Button size="sm" onClick={() => { setReviseReason(""); setReviseOpen(true); }}>
                <Save className="h-4 w-4 mr-1.5" /> Simpan Revisi
              </Button>
            </>
          )}
        </div>
      </div>

      {inRevisionHost && (
        <div className="mx-5 mt-3 p-2 bg-sky-50 border border-sky-200 rounded-md text-xs text-sky-800">
          Mode Edit Setelah Submit aktif. Perubahan akan disimpan dengan status tetap <strong>Submitted</strong> dan dicatat di audit log.
        </div>
      )}

      {status === "Locked" && (
        <div className="m-5 p-3 bg-slate-100 border border-slate-200 rounded-md text-sm text-slate-700 flex items-center gap-2">
          <Lock className="h-4 w-4" /> Formulir ini sudah dikunci karena pemeriksaan telah difinalisasi.
        </div>
      )}

      <div className="p-5">
        <Suspense fallback={<SectionSkeleton />}>
          <ActiveForm key={active} active={active} cand={cand} examId={examId} selectionLabel={selectionLabel} data={formData} onChange={setFormData} readOnly={effectiveReadOnly} canEditAfterSubmit={canEditAfterSubmit} onPersisted={onPersisted} />
        </Suspense>
      </div>

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Kembalikan ke Draft</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Alasan (opsional)</Label>
            <Textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="Misal: ada data perlu dilengkapi" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>Batal</Button>
            <Button variant="destructive" onClick={() => { onReturn(returnReason); setReturnReason(""); setReturnOpen(false); }}>
              Kembalikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reviseOpen} onOpenChange={setReviseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Konfirmasi Revisi Data Submitted</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Alasan revisi (wajib, minimal 3 karakter)</Label>
            <Textarea rows={3} value={reviseReason} onChange={(e) => setReviseReason(e.target.value)} placeholder="Misal: koreksi data tensi" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviseOpen(false)}>Batal</Button>
            <Button
              disabled={!reviseValid}
              onClick={async () => {
                if (!reviseValid || !onSaveRevision) return;
                await onSaveRevision(formData, reviseReason.trim());
                setReviseOpen(false);
                setEditMode(false);
              }}
            >
              Simpan Revisi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FormActions(_: any) { return null; }

/* -------------------- Loading skeletons -------------------- */

function SectionSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 w-1/3 bg-slate-200 rounded" />
      <div className="h-10 w-full bg-slate-100 rounded" />
      <div className="h-10 w-full bg-slate-100 rounded" />
      <div className="h-24 w-full bg-slate-100 rounded" />
    </div>
  );
}

function RikkesDetailSkeleton() {
  return (
    <div className="p-6 lg:p-8 space-y-6 min-h-screen">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 animate-pulse">
        <div className="h-6 w-1/3 bg-slate-200 rounded mb-3" />
        <div className="h-4 w-2/3 bg-slate-100 rounded" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-4 xl:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-2 animate-pulse">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 w-full bg-slate-100 rounded" />
          ))}
        </aside>
        <section className="lg:col-span-8 xl:col-span-9 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <SectionSkeleton />
        </section>
      </div>
    </div>
  );
}

/* -------------------- Active form router -------------------- */

function ActiveForm({ active, cand, examId, selectionLabel, data, onChange, readOnly, canEditAfterSubmit, onPersisted }: { active: RikkesGroupKey; cand: any; examId?: string; selectionLabel?: string; data: any; onChange: (d: any) => void; readOnly: boolean; canEditAfterSubmit?: boolean; onPersisted?: () => void }) {
  const set = (patch: any) => onChange({ ...data, ...patch });
  switch (active) {
    case "identitas_anamnesis": return <IdentitasAnamnesisForm cand={cand} exam={{ id: examId }} selectionLabel={selectionLabel} />;
    case "screening_hari_h": return <ScreeningHariHForm cand={cand} examId={examId} />;
    case "lembar_evaluasi_umum": return <PemeriksaanUmumForm cand={cand} examId={examId} />;
    case "evaluasi_klinis": return <ClinicalForm data={data} set={set} readOnly={readOnly} />;
    case "gigi_odontogram": return examId ? <DentalOdontogramForm examId={examId} candidateId={cand.id} readOnly={readOnly} canEditAfterSubmit={canEditAfterSubmit} onPersisted={onPersisted} /> : null;
    case "penunjang": return <PenunjangForm data={data} set={set} readOnly={readOnly} />;
    case "ukuran_lain": return <UkuranForm data={data} set={set} readOnly={readOnly} examId={examId} />;
    case "mata_tht": return <MataThtForm data={data} set={set} readOnly={readOnly} />;
    case "tht_subtim": return examId ? <ThtForm examId={examId} candidateId={cand.id} readOnly={readOnly} canEditAfterSubmit={canEditAfterSubmit} /> : null;
    case "mata_visus_subtim": return examId ? <EyeVisionForm examId={examId} candidateId={cand.id} readOnly={readOnly} canEditAfterSubmit={canEditAfterSubmit} /> : null;
    case "bedah_subtim": return examId ? <SurgeryForm examId={examId} candidateId={cand.id} readOnly={readOnly} canEditAfterSubmit={canEditAfterSubmit} /> : null;
    case "neurologi_subtim": return examId ? <NeurologyForm examId={examId} candidateId={cand.id} readOnly={readOnly} canEditAfterSubmit={canEditAfterSubmit} /> : null;
    case "laboratorium": return examId ? <LabSubteamForm examId={examId} candidateId={cand.id} readOnly={readOnly} canEditAfterSubmit={canEditAfterSubmit} /> : null;
    case "psikologi_subtim": return examId ? <PsychologyForm examId={examId} candidateId={cand.id} readOnly={readOnly} canEditAfterSubmit={canEditAfterSubmit} /> : null;
    case "resume_rekomendasi": return <ResumeForm data={data} set={set} readOnly={readOnly} />;
  }
}

/* -------------------- 1. Identitas & Anamnesis -------------------- */
function IdentitasForm({ cand, data, set, readOnly }: any) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <F label="3. Maksud Pemeriksaan"><Input value={data.exam_purpose ?? ""} onChange={(e) => set({ exam_purpose: e.target.value })} disabled={readOnly} placeholder="Contoh: Pemeriksaan Berkala Tahunan" /></F>
        <F label="6. Tanggal Pemeriksaan"><Input type="date" value={data.exam_date ?? ""} onChange={(e) => set({ exam_date: e.target.value })} disabled={readOnly} /></F>
        <F label="11. Masa Kerja Militer"><Input value={data.military_years ?? ""} onChange={(e) => set({ military_years: e.target.value })} disabled={readOnly} placeholder="Contoh: 15 Tahun" /></F>
        <F label="11. Masa Kerja Sipil"><Input value={data.civilian_years ?? ""} onChange={(e) => set({ civilian_years: e.target.value })} disabled={readOnly} placeholder="Contoh: 0 Tahun" /></F>
      </div>
      <F label="12. Anamnesis (Penyakit/Operasi/Kelainan akibat pengaruh lingkungan pekerjaan/Kecelakaan yang pernah/sedang dialami sejak uji kesehatan terakhir)">
        <Textarea rows={5} value={data.anamnesis ?? ""} onChange={(e) => set({ anamnesis: e.target.value })} disabled={readOnly} placeholder="Contoh: Tidak ada keluhan berarti. Riwayat hipertensi terkontrol." />
      </F>
    </div>
  );
}

/* -------------------- 2. Evaluasi Klinis -------------------- */
function ClinicalForm({ data, set, readOnly }: any) {
  const items = data.clinical_evaluation ?? CLINICAL_ITEMS.map((i) => ({ number: i.number, label: i.label, status: "Normal", abnormal_note: "" }));
  function update(idx: number, patch: any) {
    const next = items.map((it: any, i: number) => i === idx ? { ...it, ...patch } : it);
    set({ clinical_evaluation: next });
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-slate-50">
          <tr className="text-left text-xs uppercase text-slate-600">
            <th className="p-2">Pemeriksaan</th>
            <th className="p-2 w-44">Status</th>
            <th className="p-2">Keterangan Abnormal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it: any, i: number) => (
            <tr key={it.number} className={`border-t border-slate-200 ${it.status === "Abnormal" ? "bg-orange-50/50" : ""}`}>
              <td className="p-2 font-medium text-slate-800">{it.number}. {it.label}</td>
              <td className="p-2">
                <div className="flex gap-3 text-xs">
                  <label className="inline-flex items-center gap-1.5"><input type="radio" disabled={readOnly} checked={it.status === "Normal"} onChange={() => update(i, { status: "Normal" })} /> Normal</label>
                  <label className="inline-flex items-center gap-1.5"><input type="radio" disabled={readOnly} checked={it.status === "Abnormal"} onChange={() => update(i, { status: "Abnormal" })} /> Abnormal</label>
                </div>
              </td>
              <td className="p-2">
                <Input value={it.abnormal_note ?? ""} onChange={(e) => update(i, { abnormal_note: e.target.value })} disabled={readOnly || it.status === "Normal"} placeholder={it.status === "Normal" ? "Isi jika abnormal" : "Wajib diisi"} className="h-8" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------- 3. Gigi & Odontogram -------------------- */
function GigiForm({ data, set, readOnly }: any) {
  const odo = data.odontogram ?? {};
  function setTooth(n: number, code: string, notes?: string) {
    set({ odontogram: { ...odo, [n]: { code, notes: notes ?? odo[n]?.notes ?? "" } } });
  }
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-3">Odontogram Interaktif</h3>
        <div className="space-y-2">
          {[...TEETH_TOP, ...TEETH_BOTTOM].map((row, ri) => (
            <div key={ri} className="flex gap-1.5 justify-center">
              {row.map((n) => {
                const code = odo[n]?.code ?? "S";
                return (
                  <Popover key={n}>
                    <PopoverTrigger asChild disabled={readOnly}>
                      <button type="button" className={`w-10 h-12 rounded border-2 ${TOOTH_COLOR[code]} flex flex-col items-center justify-center font-bold text-sm hover:scale-105 transition`}>
                        <span className="text-[10px] opacity-70">{n}</span>
                        <span>{code}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56">
                      <div className="text-xs font-semibold mb-2">Gigi {n}</div>
                      <div className="grid grid-cols-4 gap-1 mb-2">
                        {TOOTH_CODES.map((tc) => (
                          <button key={tc.code} type="button" onClick={() => setTooth(n, tc.code)} className={`text-xs px-1 py-1 rounded border ${TOOTH_COLOR[tc.code]} ${code === tc.code ? "ring-2 ring-primary" : ""}`} title={tc.label}>
                            {tc.code}
                          </button>
                        ))}
                      </div>
                      <Input className="h-8 text-xs" placeholder="Catatan" value={odo[n]?.notes ?? ""} onChange={(e) => setTooth(n, code, e.target.value)} />
                    </PopoverContent>
                  </Popover>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex gap-3 justify-center mt-3 text-xs flex-wrap">
          {TOOTH_CODES.map((tc) => (
            <div key={tc.code} className="inline-flex items-center gap-1">
              <span className={`inline-block w-4 h-4 rounded border ${TOOTH_COLOR[tc.code]}`} />
              {tc.code} = {tc.label}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-3">Kualifikasi & Catatan</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <F label="STAKES"><Input value={data.stakes ?? ""} onChange={(e) => set({ stakes: e.target.value })} disabled={readOnly} /></F>
          <F label="DMF-T"><Input type="number" value={data.dmft ?? ""} onChange={(e) => set({ dmft: e.target.value })} disabled={readOnly} /></F>
          <F label="Oklusi"><Input value={data.oklusi ?? ""} onChange={(e) => set({ oklusi: e.target.value })} disabled={readOnly} /></F>
          <F label="Kebersihan Mulut"><Input value={data.kebersihan_mulut ?? ""} onChange={(e) => set({ kebersihan_mulut: e.target.value })} disabled={readOnly} /></F>
          <F label="Frekuensi Sikat Gigi"><Input value={data.frekuensi_sikat ?? ""} onChange={(e) => set({ frekuensi_sikat: e.target.value })} disabled={readOnly} /></F>
          <F label="Jumlah Gigi Vital"><Input type="number" value={data.gigi_vital ?? ""} onChange={(e) => set({ gigi_vital: e.target.value })} disabled={readOnly} /></F>
          <F label="Jml Titik Kontak"><Input type="number" value={data.titik_kontak ?? ""} onChange={(e) => set({ titik_kontak: e.target.value })} disabled={readOnly} /></F>
          <F label="Karang Gigi">
            <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={data.karang_gigi ?? ""} onChange={(e) => set({ karang_gigi: e.target.value })} disabled={readOnly}>
              <option value="">Pilih</option>
              {["Tidak Ada", "Ringan", "Sedang", "Berat"].map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </F>
          <F label="Fissure Stain"><Input value={data.fissure_stain ?? ""} onChange={(e) => set({ fissure_stain: e.target.value })} disabled={readOnly} /></F>
          <F label="Kelainan Dalam Mulut"><Input value={data.kelainan_mulut ?? ""} onChange={(e) => set({ kelainan_mulut: e.target.value })} disabled={readOnly} /></F>
        </div>
        <F label="Diagnosa / Kelainan" className="mt-3">
          <Textarea rows={3} value={data.diagnosa ?? ""} onChange={(e) => set({ diagnosa: e.target.value })} disabled={readOnly} />
        </F>
      </div>
    </div>
  );
}

/* -------------------- 4. Penunjang -------------------- */
function PenunjangForm({ data, set, readOnly }: any) {
  return (
    <div className="space-y-4">
      <F label="36. Rontgen Thorax"><Textarea rows={3} value={data.thorax_xray ?? ""} onChange={(e) => set({ thorax_xray: e.target.value })} disabled={readOnly} placeholder="Contoh: Cor dan pulmo dalam batas normal." /></F>
      <F label="37. Elektrokardiogram (ECG)"><Textarea rows={3} value={data.ecg ?? ""} onChange={(e) => set({ ecg: e.target.value })} disabled={readOnly} placeholder="Contoh: Irama sinus, normal." /></F>
      <F label="38. Pemeriksaan Spesialis Lain"><Textarea rows={3} value={data.other_specialist ?? ""} onChange={(e) => set({ other_specialist: e.target.value })} disabled={readOnly} placeholder="Contoh: Konsul Jantung: Tidak ada kelainan." /></F>
      <F label="39. Pemeriksaan USG"><Textarea rows={3} maxLength={2000} value={data.usg_result ?? ""} onChange={(e) => set({ usg_result: e.target.value })} disabled={readOnly} placeholder="Contoh: USG abdomen dalam batas normal." /></F>
    </div>
  );
}

/* -------------------- 5. Ukuran & Pemeriksaan Lain -------------------- */
function UkuranForm({ data, set, readOnly, examId }: any) {
  const tinggi = Number(data.tinggi ?? 0);
  const berat = Number(data.berat ?? 0);
  const imt = useMemo(() => {
    if (!tinggi || !berat) return null;
    const m = tinggi / 100;
    return Number((berat / (m * m)).toFixed(2));
  }, [tinggi, berat]);

  // Sync to medical_measurements when changed
  useEffect(() => {
    if (!examId || (!tinggi && !berat)) return;
    const t = setTimeout(async () => {
      await supabase.from("medical_measurements").update({
        height_cm: tinggi || null, weight_kg: berat || null, bmi: imt,
      }).eq("exam_id", examId);
    }, 600);
    return () => clearTimeout(t);
  }, [tinggi, berat, imt, examId]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <F label="39. Berat Badan (kg)"><Input type="number" value={data.berat ?? ""} onChange={(e) => set({ berat: e.target.value })} disabled={readOnly} /></F>
        <F label="40. Tinggi Badan (cm)"><Input type="number" value={data.tinggi ?? ""} onChange={(e) => set({ tinggi: e.target.value })} disabled={readOnly} /></F>
        <F label="41. Bentuk Badan"><Input value={data.bentuk_badan ?? ""} onChange={(e) => set({ bentuk_badan: e.target.value })} disabled={readOnly} placeholder="Atletis" /></F>
        <F label="Indeks Massa Tubuh (IMT)"><Input value={imt ?? ""} readOnly className="bg-slate-100" /></F>
        <F label="42. Tensi (mmHg)"><Input value={data.tensi ?? ""} onChange={(e) => set({ tensi: e.target.value })} disabled={readOnly} placeholder="120/80" /></F>
        <F label="43. Nadi (x/menit)"><Input type="number" value={data.nadi ?? ""} onChange={(e) => set({ nadi: e.target.value })} disabled={readOnly} /></F>
        <F label="44. Temperatur (°C)"><Input type="number" step="0.1" value={data.temperatur ?? ""} onChange={(e) => set({ temperatur: e.target.value })} disabled={readOnly} /></F>
        <F label="46. Lingkar Dada Exp (cm)"><Input type="number" value={data.lingkar_dada_exp ?? ""} onChange={(e) => set({ lingkar_dada_exp: e.target.value })} disabled={readOnly} /></F>
        <F label="46. Inspirasi (cm)"><Input type="number" value={data.lingkar_dada_insp ?? ""} onChange={(e) => set({ lingkar_dada_insp: e.target.value })} disabled={readOnly} /></F>
        <F label="47. Lingkar Perut (cm)"><Input type="number" value={data.lingkar_perut ?? ""} onChange={(e) => set({ lingkar_perut: e.target.value })} disabled={readOnly} /></F>
        <F label="48. Warna Rambut"><Input value={data.warna_rambut ?? ""} onChange={(e) => set({ warna_rambut: e.target.value })} disabled={readOnly} /></F>
        <F label="49. Warna Mata"><Input value={data.warna_mata ?? ""} onChange={(e) => set({ warna_mata: e.target.value })} disabled={readOnly} /></F>
      </div>
      <F label="50. Tanda Identifikasi Lain"><Textarea rows={2} value={data.tanda_lain ?? ""} onChange={(e) => set({ tanda_lain: e.target.value })} disabled={readOnly} /></F>
    </div>
  );
}

/* -------------------- 6. Mata (45, 51-53) -------------------- */
function MataThtForm({ data, set, readOnly }: any) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Pemeriksaan Mata</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <F label="45. Visus OD"><Input value={data.visus_od ?? ""} onChange={(e) => set({ visus_od: e.target.value })} disabled={readOnly} placeholder="6/6" /></F>
          <F label="45. Visus OS"><Input value={data.visus_os ?? ""} onChange={(e) => set({ visus_os: e.target.value })} disabled={readOnly} placeholder="6/6" /></F>
          <F label="45. Koreksi Sampai OD"><Input value={data.koreksi_od ?? ""} onChange={(e) => set({ koreksi_od: e.target.value })} disabled={readOnly} placeholder="-" /></F>
          <F label="45. Koreksi Sampai OS"><Input value={data.koreksi_os ?? ""} onChange={(e) => set({ koreksi_os: e.target.value })} disabled={readOnly} placeholder="-" /></F>
          <F label="51. Membedakan Warna"><Input value={data.warna ?? ""} onChange={(e) => set({ warna: e.target.value })} disabled={readOnly} placeholder="Baik" /></F>
          <F label="52. Pemeriksaan Perimetris"><Input value={data.perimetris ?? ""} onChange={(e) => set({ perimetris: e.target.value })} disabled={readOnly} placeholder="Normal" /></F>
          <F label="53. IOP OD"><Input value={data.iop_od ?? ""} onChange={(e) => set({ iop_od: e.target.value })} disabled={readOnly} placeholder="Normal" /></F>
          <F label="53. IOP OS"><Input value={data.iop_os ?? ""} onChange={(e) => set({ iop_os: e.target.value })} disabled={readOnly} placeholder="Normal" /></F>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Catatan: pemeriksaan No. 54 (Suara Bisikan AD/AS) kini ditempatkan pada section <strong>THT (Subtim)</strong>.
        </p>
      </div>
    </div>
  );
}

/* -------------------- 7. Laboratorium -------------------- */
function LabForm({ data, set, readOnly }: any) {
  const blood = data.blood ?? {}; const urine = data.urine ?? {}; const sero = data.serology ?? {};
  const sB = (p: any) => set({ blood: { ...blood, ...p } });
  const sU = (p: any) => set({ urine: { ...urine, ...p } });
  const sS = (p: any) => set({ serology: { ...sero, ...p } });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Sub title="56. Darah">
        <F label="Hemoglobin (g/dL)"><Input value={blood.hb ?? ""} onChange={(e) => sB({ hb: e.target.value })} disabled={readOnly} /></F>
        <F label="Leukosit (/µL)"><Input value={blood.leukosit ?? ""} onChange={(e) => sB({ leukosit: e.target.value })} disabled={readOnly} /></F>
        <F label="B.S.E."><Input value={blood.bse ?? ""} onChange={(e) => sB({ bse: e.target.value })} disabled={readOnly} /></F>
        <F label="Dif"><Input value={blood.dif ?? ""} onChange={(e) => sB({ dif: e.target.value })} disabled={readOnly} /></F>
        </Sub>
        <Sub title="57. Serologi">
        <F label="HbsAg"><Input value={sero.hbsag ?? ""} onChange={(e) => sS({ hbsag: e.target.value })} disabled={readOnly} /></F>
        <F label="FDRL/VDRL"><Input value={sero.vdrl ?? ""} onChange={(e) => sS({ vdrl: e.target.value })} disabled={readOnly} /></F>
        <F label="HIV"><Input value={sero.hiv ?? ""} onChange={(e) => sS({ hiv: e.target.value })} disabled={readOnly} /></F>
        </Sub>
      </div>
      <Sub title="55. Urine">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <F label="BJ"><Input value={urine.bj ?? ""} onChange={(e) => sU({ bj: e.target.value })} disabled={readOnly} /></F>
          <F label="Warna"><Input value={urine.warna ?? ""} onChange={(e) => sU({ warna: e.target.value })} disabled={readOnly} /></F>
          <F label="Prot"><Input value={urine.prot ?? ""} onChange={(e) => sU({ prot: e.target.value })} disabled={readOnly} /></F>
          <F label="Red"><Input value={urine.red ?? ""} onChange={(e) => sU({ red: e.target.value })} disabled={readOnly} /></F>
          <F label="Bil"><Input value={urine.bil ?? ""} onChange={(e) => sU({ bil: e.target.value })} disabled={readOnly} /></F>
          <F label="Sed. Leuco"><Input value={urine.sed_leuco ?? ""} onChange={(e) => sU({ sed_leuco: e.target.value })} disabled={readOnly} /></F>
          <F label="Sed. Eri"><Input value={urine.sed_eri ?? ""} onChange={(e) => sU({ sed_eri: e.target.value })} disabled={readOnly} /></F>
          <F label="Sed. Kristal"><Input value={urine.sed_kristal ?? ""} onChange={(e) => sU({ sed_kristal: e.target.value })} disabled={readOnly} /></F>
          <F label="Sed. Lain-lain"><Input value={urine.sed_lain ?? ""} onChange={(e) => sU({ sed_lain: e.target.value })} disabled={readOnly} /></F>
        </div>
      </Sub>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Sub title="58. Golongan Darah">
          <F label="Golongan Darah"><Input value={data.blood_type ?? ""} onChange={(e) => set({ blood_type: e.target.value })} disabled={readOnly} placeholder="O+" /></F>
          <F label="Klasifikasi Laboratorium">
            <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={data.classification ?? "B"} onChange={(e) => set({ classification: e.target.value })} disabled={readOnly}>
              {["B", "C", "K1", "K2", "TH", "Belum Lengkap"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </F>
        </Sub>
        <Sub title="59. Pemeriksaan Lab Lainnya">
          <F label="Catatan"><Textarea rows={4} value={data.other_lab ?? ""} onChange={(e) => set({ other_lab: e.target.value })} disabled={readOnly} placeholder="Tidak ada" /></F>
        </Sub>
      </div>
    </div>
  );
}

/* -------------------- 8. Resume & Rekomendasi -------------------- */
function ResumeForm({ data, set, readOnly }: any) {
  const status = data.physical_status ?? {};
  const tugas = data.kode_tugas ?? {};
  const tk = (k: string, v: boolean, target: "physical_status" | "kode_tugas") => set({ [target]: { ...(target === "physical_status" ? status : tugas), [k]: v } });
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Sub title="60. Status Fisik">
          <div className="grid grid-cols-4 gap-2">
            {["U", "A", "B", "D", "L", "G", "J"].map((k) => (
              <label key={k} className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" disabled={readOnly} checked={!!status[k]} onChange={(e) => tk(k, e.target.checked, "physical_status")} /> {k}
              </label>
            ))}
          </div>
        </Sub>
        <Sub title="61. Kualifikasi">
          <div className="flex gap-3">
            {["I", "II", "III", "IV"].map((k) => (
              <label key={k} className="inline-flex items-center gap-1.5 text-sm">
                <input type="radio" disabled={readOnly} checked={data.kualifikasi === k} onChange={() => set({ kualifikasi: k })} /> {k}
              </label>
            ))}
          </div>
        </Sub>
        <Sub title="62. Kode Tugas">
          <div className="space-y-1">
            {["PINBANG AKTIF", "AP. LAIN", "PASUKAN KHUSUS", "MILITER BIASA", "SIPIL"].map((k) => (
              <label key={k} className="flex items-center gap-2 text-xs">
                <input type="checkbox" disabled={readOnly} checked={!!tugas[k]} onChange={(e) => tk(k, e.target.checked, "kode_tugas")} /> {k}
              </label>
            ))}
          </div>
        </Sub>
      </div>

      <F label="63. Resume (Tulis Kelainan / Diagnosis / Stakes sesuai nomor)">
        <Textarea rows={4} value={data.resume ?? ""} onChange={(e) => set({ resume: e.target.value })} disabled={readOnly} />
      </F>
      <F label="64. Kesimpulan">
        <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={data.kesimpulan ?? ""} onChange={(e) => set({ kesimpulan: e.target.value })} disabled={readOnly}>
          <option value="">Pilih</option>
          {["BAIK", "CUKUP", "KURANG", "TMS", "PERLU PEMERIKSAAN LANJUTAN"].map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </F>
      <F label="65. Rekomendasi (Tindak lanjut, Follow Up, Disposisi Aeromedis)">
        <Textarea rows={3} value={data.rekomendasi ?? ""} onChange={(e) => set({ rekomendasi: e.target.value })} disabled={readOnly} />
      </F>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
        <Sub title="66. Dokter Pemeriksa">
          <F label="Nama"><Input value={data.dokter_nama ?? ""} onChange={(e) => set({ dokter_nama: e.target.value })} disabled={readOnly} /></F>
          <F label="Jabatan"><Input value={data.dokter_jabatan ?? ""} onChange={(e) => set({ dokter_jabatan: e.target.value })} disabled={readOnly} /></F>
          <F label="Pangkat/NRP"><Input value={data.dokter_pangkat ?? ""} onChange={(e) => set({ dokter_pangkat: e.target.value })} disabled={readOnly} /></F>
        </Sub>
        <Sub title="67. Disyahkan / Diketahui Oleh">
          <F label="Nama"><Input value={data.ketua_nama ?? ""} onChange={(e) => set({ ketua_nama: e.target.value })} disabled={readOnly} /></F>
          <F label="Jabatan"><Input value={data.ketua_jabatan ?? ""} onChange={(e) => set({ ketua_jabatan: e.target.value })} disabled={readOnly} /></F>
          <F label="Pangkat/NRP"><Input value={data.ketua_pangkat ?? ""} onChange={(e) => set({ ketua_pangkat: e.target.value })} disabled={readOnly} /></F>
        </Sub>
      </div>
    </div>
  );
}

/* -------------------- Preview Dialog -------------------- */
function PreviewDialog({ open, onOpenChange, cand, groups, currentExam }: { open: boolean; onOpenChange: (b: boolean) => void; cand: any; groups: Group[]; currentExam: any }) {
  const allSubmitted = RIKKES_GROUPS.every((g) => {
    const grp = groups.find((x) => x.group_key === g.key);
    return grp?.status === "Submitted" || grp?.status === "Approved" || grp?.status === "Locked";
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Preview & Finalisasi PDF</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="bg-slate-50 rounded-md p-3 text-sm">
            <div className="font-semibold">{cand.full_name}</div>
            <div className="text-xs text-slate-600">{cand.rank} · {cand.nrp_nip}</div>
          </div>
          <div className="space-y-1.5">
            {RIKKES_GROUPS.map((g) => {
              const grp = groups.find((x) => x.group_key === g.key);
              const stRaw = grp?.status ?? "Draft";
                const mapKey: Record<string, string> = { neurologi_subtim: "neurologi", laboratorium: "laboratorium", psikologi_subtim: "jiwa_keswa" };
                const st = currentExam?.id && mapKey[g.key] ? getDisplayStatusLocal(currentExam.id, mapKey[g.key], (getDb() as any)?.settings?.neuro_required ?? true) : stRaw;
              const ok = st === "Submitted" || st === "Approved" || st === "Locked";
              return (
                <div key={g.key} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100">
                  <span>{g.label}</span>
                  <Badge className={`${ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"} border-0 text-[11px]`}>{st}</Badge>
                </div>
              );
            })}
          </div>
          {!allSubmitted && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Beberapa bagian formulir masih belum disubmit.</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => window.print()}>Generate Preview PDF</Button>
          <Button disabled={!allSubmitted} onClick={() => { toast.info("Gunakan Mode Lanjutan untuk finalisasi resmi."); onOpenChange(false); }}>Finalisasi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- helpers -------------------- */
function F({ label, children, className }: any) { return <div className={`space-y-1 ${className ?? ""}`}><Label className="text-xs text-slate-600">{label}</Label>{children}</div>; }
function Sub({ title, children }: any) { return <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2"><h4 className="text-sm font-semibold text-slate-800 mb-2">{title}</h4>{children}</div>; }
function Ro({ label, value, mono }: any) { return <div><div className="text-[11px] uppercase text-slate-500">{label}</div><div className={`text-sm font-medium text-slate-800 ${mono ? "font-mono" : ""}`}>{value || "-"}</div></div>; }
