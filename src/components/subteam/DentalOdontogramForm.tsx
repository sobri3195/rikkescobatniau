import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SubteamFormShell, QualificationSelect } from "./SubteamFormShell";
import { logAudit } from "@/lib/audit";
import { TEETH_TOP, TEETH_BOTTOM } from "@/lib/rikkes-form-groups";

const DENTAL_CLASS_OPTIONS = ["B", "C", "K1", "K2"] as const;

// Surface-level odontogram markers. Each tooth has up to 5 surfaces.
const SURFACES = ["O", "M", "D", "B", "L"] as const;
const SURFACE_LABEL: Record<string, string> = { O: "Oklusal", M: "Mesial", D: "Distal", B: "Bukal/Vestibular", L: "Lingual/Palatal" };
const MARKER_CODES = [
  { code: "K",  label: "Karies",        color: "fill-red-500" },
  { code: "T",  label: "Tambalan",      color: "fill-blue-500" },
  { code: "GP", label: "Gigi Palsu",    color: "fill-purple-500" },
  { code: "F",  label: "Fraktur",       color: "fill-orange-500" },
  { code: "FS", label: "Fissure Sealant", color: "fill-emerald-500" },
] as const;
const WHOLE_TOOTH_CODES = [
  { code: "S",  label: "Sehat",     color: "bg-white text-slate-700 border-slate-300" },
  { code: "H",  label: "Hilang",    color: "bg-slate-900 text-white border-slate-900" },
  { code: "G",  label: "Gangren",   color: "bg-orange-600 text-white border-orange-700" },
  { code: "A",  label: "Sisa Akar", color: "bg-amber-700 text-white border-amber-800" },
  { code: "RC", label: "Root Canal", color: "bg-cyan-600 text-white border-cyan-700" },
] as const;

type ToothRow = { tooth_number: number; markers_json: any[]; notes: string | null; id?: string };

export function DentalOdontogramForm({
  examId,
  candidateId,
  readOnly,
  canEditAfterSubmit,
  onPersisted,
}: {
  examId: string;
  candidateId: string;
  readOnly?: boolean;
  canEditAfterSubmit?: boolean;
  onPersisted?: () => void;
}) {
  const [exam, setExam] = useState<any>(null);
  const [teeth, setTeeth] = useState<Record<number, ToothRow>>({});
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data: e } = await supabase.from("exam_dental").select("*").eq("exam_id", examId).maybeSingle();
    setExam(e ?? { status: "Draft" });
    const { data: t } = await supabase.from("dental_tooth_records").select("*").eq("exam_dental_id", e?.id ?? "00000000-0000-0000-0000-000000000000");
    const map: Record<number, ToothRow> = {};
    (t ?? []).forEach((r: any) => { map[r.tooth_number] = { tooth_number: r.tooth_number, markers_json: r.markers_json ?? [], notes: r.notes, id: r.id }; });
    setTeeth(map);
  }
  useEffect(() => { if (examId) load(); }, [examId]);

  function setExamPatch(p: any) { setExam((r: any) => ({ ...r, ...p })); }
  function setTooth(n: number, patch: Partial<ToothRow>) {
    setTeeth((m) => ({ ...m, [n]: { ...(m[n] ?? { tooth_number: n, markers_json: [], notes: null }), ...patch } }));
  }
  function toggleMarker(n: number, kind: "whole" | "surface", code: string, surface?: string) {
    const cur = teeth[n]?.markers_json ?? [];
    const exists = cur.find((m: any) => m.kind === kind && m.code === code && (kind === "whole" || m.surface === surface));
    let next;
    if (exists) next = cur.filter((m: any) => m !== exists);
    else if (kind === "whole") next = [...cur.filter((m: any) => m.kind !== "whole"), { kind, code }]; // one whole per tooth
    else next = [...cur, { kind, code, surface }];
    setTooth(n, { markers_json: next });
  }

  async function syncParentSection(status: string, uid: string | undefined, reason?: string) {
    // Keep rikkes_form_sections row for 'gigi_odontogram' in sync so the
    // RIKKES sidebar / header reflect the actual dental submission status.
    try {
      const { data: existing } = await supabase
        .from("rikkes_form_sections")
        .select("id")
        .eq("exam_id", examId)
        .eq("group_key", "gigi_odontogram")
        .maybeSingle();
      const base: any = { status, updated_by: uid };
      if (status === "Submitted") {
        base.submitted_by = uid;
        base.submitted_at = new Date().toISOString();
      }
      if (reason) base.return_reason = reason; // reuse field to surface latest revision note
      if (existing?.id) {
        await supabase.from("rikkes_form_sections").update(base).eq("id", existing.id);
      } else {
        await supabase.from("rikkes_form_sections").insert({
          exam_id: examId,
          candidate_id: candidateId,
          group_key: "gigi_odontogram",
          form_data_json: {},
          created_by: uid,
          ...base,
        });
      }
    } catch {
      /* non-blocking */
    }
  }

  async function persist(status: string, revisionReason?: string) {
    // Wajib pilih klasifikasi sebelum submit
    if (status === "Submitted" && !DENTAL_CLASS_OPTIONS.includes(exam?.classification)) {
      toast.error("Klasifikasi Gigi & Odontogram wajib dipilih.");
      return;
    }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const prevClassification = exam?.classification ?? null;
      const payload = {
        exam_id: examId, candidate_id: candidateId,
        dental_abnormality: exam.dental_abnormality ?? null,
        oral_abnormality: exam.oral_abnormality ?? null,
        oral_hygiene: exam.oral_hygiene ?? null,
        jaw_abnormality: exam.jaw_abnormality ?? null,
        dmf: exam.dmf ?? null,
        vital_teeth_count: exam.vital_teeth_count ?? null,
        occlusion_contact_count: exam.occlusion_contact_count ?? null,
        conclusion: exam.conclusion ?? null,
        qualification_g: exam.qualification_g || null,
        classification: exam.classification || null,
        examiner_id: u.user?.id, examined_at: new Date().toISOString(), status,
      };
      const examRes = exam?.id
        ? await supabase.from("exam_dental").update(payload).eq("id", exam.id).select().single()
        : await supabase.from("exam_dental").insert(payload).select().single();
      if (examRes.error) throw examRes.error;
      const examDentalId = examRes.data!.id;

      // Upsert tooth records (delete then re-insert touched teeth)
      const touched = Object.values(teeth).filter((t) => (t.markers_json?.length ?? 0) > 0 || t.notes);
      if (touched.length) {
        await supabase.from("dental_tooth_records").delete().eq("exam_dental_id", examDentalId);
        const ins = touched.map((t) => ({
          exam_dental_id: examDentalId,
          tooth_number: t.tooth_number,
          markers_json: t.markers_json,
          notes: t.notes,
        }));
        const r = await supabase.from("dental_tooth_records").insert(ins);
        if (r.error) throw r.error;
      }
      await syncParentSection(status, u.user?.id, revisionReason);
      const wasSubmitted = exam?.status === "Submitted" || exam?.status === "Approved" || exam?.status === "Locked";
      if (wasSubmitted && prevClassification !== (exam.classification || null)) {
        await logAudit({
          action: "change_dental_classification_after_submit",
          module: "rikkes",
          record_id: examId,
          candidate_id: candidateId,
          before: { classification: prevClassification },
          after: { classification: exam.classification || null, reason: revisionReason ?? null },
        });
      }
      await logAudit({
        action: revisionReason
          ? "revise_dental_after_submit"
          : status === "Submitted" ? "submit_dental" : "save_dental",
        module: "rikkes",
        record_id: examId,
        candidate_id: candidateId,
        after: revisionReason ? { reason: revisionReason } : undefined,
      });
      toast.success(
        revisionReason
          ? "Revisi tersimpan, status tetap Submitted"
          : status === "Submitted" ? "Odontogram disubmit" : "Draft tersimpan"
      );
      await load();
      onPersisted?.();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  if (!exam) return <div className="text-sm text-slate-500">Memuat…</div>;

  return (
    <SubteamFormShell
      title="Gigi / Odontogram"
      status={exam.status ?? "Draft"}
      readOnly={readOnly}
      busy={busy}
      onSaveDraft={() => persist("Draft")}
      onSubmit={() => persist("Submitted")}
      canEditAfterSubmit={canEditAfterSubmit}
      onSaveRevision={(reason) => persist("Submitted", reason)}
    >
      <Legend />
      <div className="space-y-3 mt-3">
        <ToothRow row={TEETH_TOP[0]} teeth={teeth} onToggle={toggleMarker} onNote={(n, v) => setTooth(n, { notes: v })} readOnly={readOnly} />
        <ToothRow row={TEETH_TOP[1]} teeth={teeth} onToggle={toggleMarker} onNote={(n, v) => setTooth(n, { notes: v })} readOnly={readOnly} />
        <div className="h-px bg-slate-200 my-2" />
        <ToothRow row={TEETH_BOTTOM[0]} teeth={teeth} onToggle={toggleMarker} onNote={(n, v) => setTooth(n, { notes: v })} readOnly={readOnly} />
        <ToothRow row={TEETH_BOTTOM[1]} teeth={teeth} onToggle={toggleMarker} onNote={(n, v) => setTooth(n, { notes: v })} readOnly={readOnly} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        <div><Label>DMF-T</Label><Input type="number" step="0.1" value={exam.dmf ?? ""} onChange={(e) => setExamPatch({ dmf: e.target.value })} /></div>
        <div><Label>Jml Gigi Vital</Label><Input type="number" value={exam.vital_teeth_count ?? ""} onChange={(e) => setExamPatch({ vital_teeth_count: e.target.value })} /></div>
        <div><Label>Jml Titik Kontak Oklusi</Label><Input type="number" value={exam.occlusion_contact_count ?? ""} onChange={(e) => setExamPatch({ occlusion_contact_count: e.target.value })} /></div>
        <div><Label>Kebersihan Mulut</Label>
          <select className="h-9 w-full px-2 rounded-md border border-input bg-background text-sm" value={exam.oral_hygiene ?? ""} onChange={(e) => setExamPatch({ oral_hygiene: e.target.value })}>
            <option value="">— Pilih —</option><option>Baik</option><option>Cukup</option><option>Kurang</option>
          </select>
        </div>
        <div className="md:col-span-2"><Label>Kelainan Gigi</Label><Input value={exam.dental_abnormality ?? ""} onChange={(e) => setExamPatch({ dental_abnormality: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Kelainan Rongga Mulut</Label><Input value={exam.oral_abnormality ?? ""} onChange={(e) => setExamPatch({ oral_abnormality: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Kelainan Rahang</Label><Input value={exam.jaw_abnormality ?? ""} onChange={(e) => setExamPatch({ jaw_abnormality: e.target.value })} /></div>
        <div className="md:col-span-4"><Label>Kesimpulan</Label><Textarea rows={3} value={exam.conclusion ?? ""} onChange={(e) => setExamPatch({ conclusion: e.target.value })} /></div>
        <div><Label>Kualifikasi (G)</Label><div className="mt-1"><QualificationSelect type="U" value={exam.qualification_g} onChange={(v) => setExamPatch({ qualification_g: v })} /></div></div>
        <div>
          <Label>
            Klasifikasi Gigi & Odontogram <span className="text-red-600">*</span>
          </Label>
          <select
            className="h-9 w-full px-2 rounded-md border border-input bg-background text-sm mt-1"
            value={exam.classification ?? ""}
            disabled={readOnly}
            onChange={(e) => setExamPatch({ classification: e.target.value || null })}
          >
            <option value="">— Pilih —</option>
            {DENTAL_CLASS_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
    </SubteamFormShell>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="font-semibold text-slate-700 mr-1">Permukaan:</span>
      {MARKER_CODES.map((m) => (
        <Badge key={m.code} variant="outline" className="font-mono">
          <svg width="10" height="10" className="mr-1"><circle cx="5" cy="5" r="4" className={m.color} /></svg>
          {m.code} {m.label}
        </Badge>
      ))}
      <span className="font-semibold text-slate-700 ml-3 mr-1">Seluruh gigi:</span>
      {WHOLE_TOOTH_CODES.map((m) => (
        <Badge key={m.code} variant="outline" className={`${m.color} font-mono`}>{m.code} {m.label}</Badge>
      ))}
    </div>
  );
}

function ToothRow({ row, teeth, onToggle, onNote, readOnly }: { row: number[]; teeth: Record<number, ToothRow>; onToggle: (n: number, kind: "whole" | "surface", code: string, surface?: string) => void; onNote: (n: number, v: string) => void; readOnly?: boolean }) {
  return (
    <div className="flex gap-1.5 justify-center flex-wrap">
      {row.map((n) => <ToothCell key={n} n={n} state={teeth[n]} onToggle={onToggle} onNote={onNote} readOnly={readOnly} />)}
    </div>
  );
}

function ToothCell({ n, state, onToggle, onNote, readOnly }: { n: number; state?: ToothRow; onToggle: (n: number, kind: "whole" | "surface", code: string, surface?: string) => void; onNote: (n: number, v: string) => void; readOnly?: boolean }) {
  const markers = state?.markers_json ?? [];
  const whole = markers.find((m: any) => m.kind === "whole");
  const wholeStyle = whole ? WHOLE_TOOTH_CODES.find((w) => w.code === whole.code)?.color : "bg-white border-slate-300";
  function surfaceFill(s: string) {
    const m = markers.find((mm: any) => mm.kind === "surface" && mm.surface === s);
    if (!m) return "fill-transparent";
    return MARKER_CODES.find((mc) => mc.code === m.code)?.color ?? "fill-slate-400";
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" disabled={readOnly} className={`flex flex-col items-center p-1 rounded-md border-2 ${wholeStyle ?? "bg-white border-slate-300"} hover:border-primary transition`}>
          <span className="text-[10px] font-mono font-bold leading-none mb-1">{n}</span>
          <svg width="32" height="32" viewBox="0 0 32 32" className="border border-slate-400 rounded">
            {/* Oklusal center */}
            <rect x="10" y="10" width="12" height="12" className={surfaceFill("O")} stroke="#94a3b8" />
            {/* Bukal top */}
            <polygon points="0,0 32,0 22,10 10,10" className={surfaceFill("B")} stroke="#94a3b8" />
            {/* Lingual bottom */}
            <polygon points="0,32 32,32 22,22 10,22" className={surfaceFill("L")} stroke="#94a3b8" />
            {/* Mesial right */}
            <polygon points="32,0 32,32 22,22 22,10" className={surfaceFill("M")} stroke="#94a3b8" />
            {/* Distal left */}
            <polygon points="0,0 0,32 10,22 10,10" className={surfaceFill("D")} stroke="#94a3b8" />
          </svg>
          {whole && <span className="text-[9px] font-bold mt-0.5">{whole.code}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 space-y-3">
        <div className="text-xs font-semibold">Gigi #{n}</div>
        <div>
          <div className="text-[11px] font-medium text-slate-600 mb-1.5">Seluruh gigi (pilih 1)</div>
          <div className="flex flex-wrap gap-1">
            {WHOLE_TOOTH_CODES.map((m) => {
              const active = whole?.code === m.code;
              return <button key={m.code} type="button" onClick={() => onToggle(n, "whole", m.code)} className={`text-[11px] px-2 py-1 rounded border ${m.color} ${active ? "ring-2 ring-primary" : ""}`}>{m.code} {m.label}</button>;
            })}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-medium text-slate-600 mb-1.5">Permukaan</div>
          <div className="grid grid-cols-5 gap-1 text-[10px] text-center">
            {SURFACES.map((s) => <div key={s} className="font-mono font-bold text-slate-700">{s}</div>)}
            {SURFACES.map((s) => (
              <div key={`${s}-x`} className="flex flex-col gap-0.5">
                {MARKER_CODES.map((m) => {
                  const on = markers.find((mm: any) => mm.kind === "surface" && mm.surface === s && mm.code === m.code);
                  return <button key={m.code} type="button" title={`${m.label} – ${SURFACE_LABEL[s]}`} onClick={() => onToggle(n, "surface", m.code, s)} className={`h-4 rounded-sm border ${on ? "ring-1 ring-primary" : ""}`}>
                    <svg width="100%" height="100%" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" className={m.color} /></svg>
                  </button>;
                })}
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-[11px]">Catatan</Label>
          <Input className="h-7 text-xs" value={state?.notes ?? ""} onChange={(e) => onNote(n, e.target.value)} />
        </div>
      </PopoverContent>
    </Popover>
  );
}