import { useCallback, useEffect, useMemo, useState } from "react";
import { localDataApi } from "@/lib/localDataApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, Send, Loader2, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { calcBMI, loadJuknisRules, validateJuknis, type JuknisRule, type JuknisCheck } from "@/lib/juknis";
import { recomputeHariHStage } from "@/lib/hari-h-stage";
import { useAuth } from "@/lib/use-auth";

// Sanity ranges (independent of juknis_parameter_rules) — catch typos early
const SANITY = {
  height_cm: { min: 100, max: 220, label: "Tinggi Badan" },
  weight_kg: { min: 30, max: 200, label: "Berat Badan" },
  waist_cm: { min: 40, max: 200, label: "Lingkar Perut" },
} as const;
const SCREENING_CLASS_OPTIONS = ["B", "C", "K1", "K2"] as const;
function sanityError(key: keyof typeof SANITY, v: number | null): string | null {
  if (v == null) return null;
  const s = SANITY[key];
  if (v < s.min || v > s.max) return `${s.label} di luar rentang wajar (${s.min}–${s.max})`;
  return null;
}

type Props = { cand: any; examId?: string };

export function ScreeningHariHForm({ cand, examId }: Props) {
  const { roles } = useAuth();
  const canEdit = ["super_admin", "admin", "dokter", "kepala_sub_tim", "registrasi"].some((r) => roles.includes(r));

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rowId, setRowId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Draft");
  const [data, setData] = useState<any>({
    height_cm: "", weight_kg: "",
    waist_cm: "",
    anamnesis: "",
    clear_note: "",
    screening_classification: "",
  });
  const [prevClassification, setPrevClassification] = useState<string | null>(null);
  const [anamSection, setAnamSection] = useState<any>(null);
  const [rules, setRules] = useState<JuknisRule[]>([]);

  const load = useCallback(async () => {
    if (!examId) { setLoading(false); return; }
    setLoading(true);
    const { data: gen } = await localDataApi.from("exam_general").select("*").eq("exam_id", examId).maybeSingle();
    if (gen) {
      setRowId(gen.id);
      setStatus(gen.status ?? "Draft");
      setData((d: any) => ({
        ...d,
        height_cm: gen.height_cm ?? "",
        weight_kg: gen.weight_kg ?? "",
        anamnesis: gen.anamnesis ?? "",
        screening_classification: gen.screening_classification ?? "",
      }));
      setPrevClassification(gen.screening_classification ?? null);
    }
    const { data: mm } = await localDataApi.from("medical_measurements").select("chest_or_waist_lp").eq("exam_id", examId).maybeSingle();
    if (mm?.chest_or_waist_lp != null) setData((d: any) => ({ ...d, waist_cm: mm.chest_or_waist_lp }));

    const { data: sec } = await localDataApi
      .from("exam_sections")
      .select("*")
      .eq("exam_id", examId)
      .eq("section_key", "anamnesa")
      .maybeSingle();
    setAnamSection(sec);

    // Selection info for juknis filter
    let selectionType: string | null = null;
    if (cand?.selection_id) {
      const { data: sel } = await localDataApi.from("selections").select("name, participant_label").eq("id", cand.selection_id).maybeSingle();
      selectionType = sel?.participant_label || sel?.name || null;
    }
    const r = await loadJuknisRules({ selectionType, gender: cand?.gender });
    setRules(r);

    setLoading(false);
  }, [examId, cand]);

  useEffect(() => { load(); }, [load]);

  const numH = data.height_cm === "" ? null : Number(data.height_cm);
  const numW = data.weight_kg === "" ? null : Number(data.weight_kg);
  const numL = data.waist_cm === "" ? null : Number(data.waist_cm);
  const bmi = calcBMI(numH, numW);

  const sanityErrs = [
    sanityError("height_cm", numH),
    sanityError("weight_kg", numW),
    sanityError("waist_cm", numL),
  ].filter(Boolean) as string[];

  const checks: JuknisCheck[] = useMemo(
    () => validateJuknis({ tb: numH, bb: numW, lp: numL, imt: bmi }, rules),
    [numH, numW, numL, bmi, rules],
  );
  const blockingFail = checks.some((c) => !c.ok && c.is_blocking);
  const warnFail = checks.some((c) => !c.ok && !c.is_blocking);

  function set(patch: any) { setData((d: any) => ({ ...d, ...patch })); }

  async function persist(nextStatus: string) {
    if (!examId) { toast.error("Exam belum tersedia"); return; }
    if (nextStatus === "Submitted" && !SCREENING_CLASS_OPTIONS.includes(data.screening_classification)) {
      toast.error("Klasifikasi Screening wajib dipilih.");
      return;
    }
    if (nextStatus === "Submitted" && blockingFail) {
      toast.error("Ada parameter Juknis BLOCKING yang gagal. Tidak dapat submit.");
      return;
    }
    if (nextStatus === "Submitted" && sanityErrs.length > 0) {
      toast.error(`Nilai tidak wajar: ${sanityErrs[0]}. Periksa kembali sebelum submit.`);
      return;
    }
    setBusy(true);
    try {
      const { data: u } = await localDataApi.auth.getUser();
      const payload: any = {
        candidate_id: cand.id,
        exam_id: examId,
        height_cm: numH,
        weight_kg: numW,
        anamnesis: data.anamnesis || null,
        screening_classification: data.screening_classification || null,
        examiner_id: u.user?.id ?? null,
        examined_at: new Date().toISOString(),
        status: nextStatus,
      };
      if (rowId) {
        const { error } = await localDataApi.from("exam_general").update(payload).eq("id", rowId);
        if (error) throw error;
      } else {
        const { data: row, error } = await localDataApi.from("exam_general").insert(payload).select().single();
        if (error) throw error;
        setRowId(row.id);
      }
      // sync measurements (height/weight/waist)
      const { data: mm } = await localDataApi.from("medical_measurements").select("id").eq("exam_id", examId).maybeSingle();
      const mmPatch: any = { height_cm: numH, weight_kg: numW, chest_or_waist_lp: numL, bmi };
      if (mm) await localDataApi.from("medical_measurements").update(mmPatch).eq("id", mm.id);
      else await localDataApi.from("medical_measurements").insert({ ...mmPatch, exam_id: examId, candidate_id: cand.id });

      setStatus(nextStatus);
      const wasSubmitted = status === "Submitted" || status === "Approved" || status === "Locked";
      if (wasSubmitted && prevClassification !== (data.screening_classification || null)) {
        await logAudit({
          action: "change_screening_classification_after_submit",
          module: "screening_hari_h",
          exam_id: examId,
          candidate_id: cand.id,
          before: { screening_classification: prevClassification },
          after: { screening_classification: data.screening_classification || null },
        });
      }
      setPrevClassification(data.screening_classification || null);
      await logAudit({
        action: nextStatus === "Submitted" ? "submit_screening_hari_h" : "save_screening_hari_h",
        module: "screening_hari_h", exam_id: examId, candidate_id: cand.id,
        after: { ...payload, waist_cm: numL, bmi, juknis_pass: !blockingFail && !warnFail },
      });
      await recomputeHariHStage(examId);
      // Refresh summary so screening (TB/BB/IMT/LP) flows into Rekap & Laporan.
      try {
        const { recalculateExamSummary } = await import("@/lib/rikkes-calculations");
        await recalculateExamSummary(examId);
      } catch { /* non-fatal */ }
      toast.success(nextStatus === "Submitted" ? "Screening disubmit" : "Draft tersimpan");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function setAnamnesaClear() {
    if (!examId) return;
    setBusy(true);
    try {
      const { data: u } = await localDataApi.auth.getUser();
      const note = prompt("Catatan (opsional):", data.clear_note || "") || null;
      const payload: any = {
        anamnesis_status: "Clear",
        clear_by: u.user?.id ?? null,
        clear_at: new Date().toISOString(),
        clear_note: note,
        section_status: "Submitted",
        submitted_by: u.user?.id ?? null,
        submitted_at: new Date().toISOString(),
      };
      if (anamSection) {
        const { error } = await localDataApi.from("exam_sections").update(payload).eq("id", anamSection.id);
        if (error) throw error;
      } else {
        const { error } = await localDataApi.from("exam_sections").insert({
          exam_id: examId, candidate_id: cand.id,
          section_key: "anamnesa", section_name: "Anamnesa",
          assigned_role: "peserta",
          ...payload,
        });
        if (error) throw error;
      }
      await logAudit({
        action: "set_anamnesis_clear",
        module: "screening_hari_h", exam_id: examId, candidate_id: cand.id,
        after: { note },
      });
      await recomputeHariHStage(examId);
      toast.success("Anamnesa di-set Clear");
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="p-6 text-slate-500"><Loader2 className="h-4 w-4 inline animate-spin mr-2" />Memuat…</div>;

  const anamStatus = (anamSection as any)?.anamnesis_status ?? null;
  const anamSectionStatus = (anamSection as any)?.section_status ?? "Draft";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base sm:text-lg font-bold text-slate-900">Screening Hari-H</h3>
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 border rounded-full text-[11px]">Status: {status}</Badge>
          {anamStatus === "Clear" && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 border rounded-full text-[11px]"><CheckCircle2 className="h-3 w-3 mr-1 inline" />Anamnesa Clear</Badge>}
        </div>
        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
          {anamSectionStatus !== "Submitted" && anamSectionStatus !== "Approved" && (
            <Button variant="outline" size="sm" onClick={setAnamnesaClear} disabled={busy || !canEdit} className="flex-1 sm:flex-none">
              <CheckCircle2 className="h-4 w-4 mr-1.5" /> Set Anamnesa Clear
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => persist("Draft")} disabled={busy || !canEdit} className="flex-1 sm:flex-none">
            <Save className="h-4 w-4 mr-1.5" /> Simpan Draft
          </Button>
          <Button size="sm" onClick={() => persist("Submitted")} disabled={busy || !canEdit || blockingFail || sanityErrs.length > 0} className="flex-1 sm:flex-none">
            <Send className="h-4 w-4 mr-1.5" /> Submit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Tinggi Badan (cm)" hint={sanityError("height_cm", numH)}>
          <Input type="number" inputMode="decimal" min={SANITY.height_cm.min} max={SANITY.height_cm.max} className="h-11 sm:h-9 text-base sm:text-sm" value={data.height_cm} onChange={(e) => set({ height_cm: e.target.value })} disabled={!canEdit} />
        </Field>
        <Field label="Berat Badan (kg)" hint={sanityError("weight_kg", numW)}>
          <Input type="number" inputMode="decimal" min={SANITY.weight_kg.min} max={SANITY.weight_kg.max} className="h-11 sm:h-9 text-base sm:text-sm" value={data.weight_kg} onChange={(e) => set({ weight_kg: e.target.value })} disabled={!canEdit} />
        </Field>
        <Field label="Lingkar Perut (cm)" hint={sanityError("waist_cm", numL)}>
          <Input type="number" inputMode="decimal" min={SANITY.waist_cm.min} max={SANITY.waist_cm.max} className="h-11 sm:h-9 text-base sm:text-sm" value={data.waist_cm} onChange={(e) => set({ waist_cm: e.target.value })} disabled={!canEdit} />
        </Field>
        <Field label="IMT (otomatis)">
          <div className="h-11 sm:h-9 flex items-center px-3 rounded-md border border-slate-200 bg-slate-50 font-mono text-slate-800">
            {bmi ?? "—"}
          </div>
        </Field>
        <Field label="Klasifikasi Screening">
          <select
            className="h-11 sm:h-9 w-full px-2 rounded-md border border-input bg-background text-base sm:text-sm"
            value={data.screening_classification ?? ""}
            disabled={!canEdit}
            onChange={(e) => set({ screening_classification: e.target.value })}
          >
            <option value="">— Pilih —</option>
            {SCREENING_CLASS_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Anamnesa Hari-H">
        <Textarea rows={4} className="text-base sm:text-sm" value={data.anamnesis} onChange={(e) => set({ anamnesis: e.target.value })} disabled={!canEdit} placeholder="Keluhan saat ini, riwayat singkat…" />
      </Field>

      {sanityErrs.length > 0 && (
        <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
          <strong>Periksa kembali:</strong> {sanityErrs.join(" • ")}
        </div>
      )}

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 text-xs font-semibold uppercase text-slate-600 flex items-center justify-between">
          <span>Validasi Juknis ({rules.length} aturan dimuat)</span>
          {blockingFail && <span className="text-red-700 inline-flex items-center gap-1"><XCircle className="h-3.5 w-3.5" /> Ada parameter BLOCKING gagal</span>}
          {!blockingFail && warnFail && <span className="text-orange-700 inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Ada peringatan</span>}
          {!blockingFail && !warnFail && checks.length > 0 && <span className="text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Semua OK</span>}
        </div>
        {checks.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">Belum ada nilai untuk divalidasi, atau belum ada aturan Juknis untuk seleksi/gender ini.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white">
              <tr className="text-left text-xs text-slate-500">
                <th className="p-2 px-4">Parameter</th>
                <th className="p-2">Nilai</th>
                <th className="p-2">Hasil</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c, i) => (
                <tr key={i} className={`border-t border-slate-100 ${!c.ok ? (c.is_blocking ? "bg-red-50" : "bg-orange-50") : ""}`}>
                  <td className="p-2 px-4 font-medium text-slate-700">{c.parameter_label}</td>
                  <td className="p-2 font-mono">{c.value ?? "—"}</td>
                  <td className="p-2">
                    {c.ok
                      ? <span className="text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> {c.message}</span>
                      : c.is_blocking
                        ? <span className="text-red-700 inline-flex items-center gap-1"><XCircle className="h-3.5 w-3.5" /> {c.message}</span>
                        : <span className="text-orange-700 inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> {c.message}</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string | null }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-700">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-orange-700">{hint}</p>}
    </div>
  );
}