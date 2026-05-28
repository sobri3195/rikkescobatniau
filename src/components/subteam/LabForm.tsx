import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Eraser } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SubteamFormShell, QualificationSelect } from "./SubteamFormShell";
import { logAudit } from "@/lib/audit";
import { LAB_NORMAL_PRESET, LAB_PRESET_KEYS } from "@/lib/lab-normal-preset";

const HEMA = [
  ["hb", "Hb (g/dL)"], ["leukosit", "Leukosit (/µL)"], ["trombosit", "Trombosit (/µL)"],
  ["hematokrit", "Hematokrit (%)"], ["eritrosit", "Eritrosit (juta/µL)"], ["led", "LED (mm/jam)"],
  ["diff_basofil", "Basofil (%)"], ["diff_eosinofil", "Eosinofil (%)"], ["diff_neutrofil", "Neutrofil (%)"],
  ["diff_limfosit", "Limfosit (%)"], ["diff_monosit", "Monosit (%)"],
];
const URIN = [
  ["urin_warna", "Warna"], ["urin_kejernihan", "Kejernihan"], ["urin_bj", "BJ"], ["urin_ph", "pH"],
  ["urin_protein", "Protein"], ["urin_glukosa", "Glukosa"], ["urin_keton", "Keton"], ["urin_bilirubin", "Bilirubin"],
  ["urin_darah", "Darah"], ["urin_nitrit", "Nitrit"], ["urin_leukosit", "Leukosit"], ["urin_sedimen", "Sedimen"],
];
const KIMIA = [
  ["gula_darah_puasa", "GDP (mg/dL)"], ["gula_darah_2jpp", "GD 2jpp (mg/dL)"], ["hba1c", "HbA1c (%)"],
  ["kolesterol_total", "Kolesterol Total"], ["ldl", "LDL"], ["hdl", "HDL"], ["trigliserida", "Trigliserida"],
  ["ureum", "Ureum"], ["kreatinin", "Kreatinin"], ["asam_urat", "Asam Urat"], ["sgot", "SGOT"], ["sgpt", "SGPT"],
];
const NARKOBA = [
  ["narkoba_amfetamin", "Amfetamin (AMP)"], ["narkoba_metamfetamin", "Metamfetamin (MET)"],
  ["narkoba_thc", "THC / Ganja"], ["narkoba_opiat", "Opiat (MOP)"],
  ["narkoba_kokain", "Kokain (COC)"], ["narkoba_benzo", "Benzodiazepin (BZO)"],
];

export function LabForm({ examId, candidateId, readOnly, canEditAfterSubmit }: { examId: string; candidateId: string; readOnly?: boolean; canEditAfterSubmit?: boolean }) {
  const [row, setRow] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [confirmFill, setConfirmFill] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());

  async function load() {
    const { data } = await supabase.from("exam_lab").select("*").eq("exam_id", examId).maybeSingle();
    setRow(data ?? { status: "Draft" });
  }
  useEffect(() => { if (examId) load(); }, [examId]);
  function set(p: any) { setRow((r: any) => ({ ...r, ...p })); }

  function hasAnyFilled() {
    if (!row) return false;
    return LAB_PRESET_KEYS.some((k) => {
      const v = row[k];
      return v !== null && v !== undefined && String(v).trim() !== "";
    });
  }

  async function applyNormalPreset() {
    const wasSubmitted = row?.status === "Submitted" || row?.status === "Approved" || row?.status === "Locked";
    const before: Record<string, any> = {};
    const after: Record<string, any> = {};
    const changedKeys: string[] = [];
    const next: Record<string, any> = {};
    LAB_PRESET_KEYS.forEach((k) => {
      const old = row?.[k] ?? null;
      const nw = LAB_NORMAL_PRESET[k];
      next[k] = nw;
      if (String(old ?? "") !== String(nw ?? "")) {
        before[k] = old;
        after[k] = nw;
        changedKeys.push(k);
      }
    });
    setRow((r: any) => ({ ...r, ...next }));
    setHighlighted(new Set(changedKeys));
    window.setTimeout(() => setHighlighted(new Set()), 2500);
    if (wasSubmitted && changedKeys.length > 0) {
      await logAudit({
        action: "quick_fill_normal",
        module: "rikkes",
        record_id: examId,
        candidate_id: candidateId,
        before,
        after,
      });
    }
    toast.success("Hasil laboratorium normal berhasil diisi.");
  }

  function clearAll() {
    const next: Record<string, any> = {};
    LAB_PRESET_KEYS.forEach((k) => { next[k] = ""; });
    setRow((r: any) => ({ ...r, ...next }));
    toast.success("Form laboratorium dikosongkan.");
  }

  async function persist(status: string, revisionReason?: string) {
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const fields: Record<string, any> = { exam_id: examId, candidate_id: candidateId, examiner_id: u.user?.id, examined_at: new Date().toISOString(), status };
      [...HEMA, ...URIN, ...KIMIA, ...NARKOBA].forEach(([k]) => { fields[k] = row[k] ?? null; });
      fields.narkoba_kesimpulan = row.narkoba_kesimpulan ?? null;
      fields.conclusion = row.conclusion ?? null;
      fields.qualification_u = row.qualification_u || null;
      const q = row?.id
        ? supabase.from("exam_lab").update(fields as any).eq("id", row.id)
        : supabase.from("exam_lab").insert(fields as any);
      const { error } = await q;
      if (error) throw error;
      await logAudit({
        action: revisionReason
          ? "revise_lab_after_submit"
          : status === "Submitted" ? "submit_lab" : "save_lab",
        module: "rikkes",
        record_id: examId,
        candidate_id: candidateId,
        after: revisionReason ? { reason: revisionReason } : undefined,
      });
      toast.success(
        revisionReason
          ? "Revisi tersimpan, status tetap Submitted"
          : status === "Submitted" ? "Lab disubmit" : "Draft tersimpan"
      );
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  if (!row) return <div className="text-sm text-slate-500">Memuat…</div>;

  return (
    <SubteamFormShell title="Laboratorium" status={row.status ?? "Draft"} readOnly={readOnly} busy={busy}
      onSaveDraft={() => persist("Draft")} onSubmit={() => persist("Submitted")}
      canEditAfterSubmit={canEditAfterSubmit}
      onSaveRevision={(reason) => persist("Submitted", reason)}>
      {!readOnly && (
        <div className="flex flex-wrap gap-2 -mt-1 mb-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => (hasAnyFilled() ? setConfirmFill(true) : applyNormalPreset())}
            disabled={busy}
          >
            <ClipboardCheck className="h-4 w-4 mr-1.5" /> Isi Normal
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setConfirmClear(true)}
            disabled={busy}
          >
            <Eraser className="h-4 w-4 mr-1.5" /> Kosongkan
          </Button>
        </div>
      )}
      <Section title="Hematologi" fields={HEMA} row={row} set={set} highlighted={highlighted} />
      <Section title="Urinalisa" fields={URIN} row={row} set={set} highlighted={highlighted} />
      <Section title="Kimia Darah" fields={KIMIA} row={row} set={set} highlighted={highlighted} />
      <Section title="Skrining Narkoba" fields={NARKOBA} row={row} set={set} kind="select" highlighted={highlighted} />
      <div className="mt-2">
        <Label>Kesimpulan Narkoba</Label>
        <Input
          className={highlighted.has("narkoba_kesimpulan") ? "ring-2 ring-emerald-300 transition" : undefined}
          value={row.narkoba_kesimpulan ?? ""}
          onChange={(e) => set({ narkoba_kesimpulan: e.target.value })}
          placeholder="Negatif / Positif (sebutkan)"
        />
      </div>
      <div className="grid md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-200">
        <div className="md:col-span-2"><Label>Kesimpulan Lab</Label><Textarea rows={3} value={row.conclusion ?? ""} onChange={(e) => set({ conclusion: e.target.value })} /></div>
        <div><Label>Kualifikasi (U)</Label><div className="mt-1"><QualificationSelect value={row.qualification_u} onChange={(v) => set({ qualification_u: v })} /></div></div>
      </div>

      <AlertDialog open={confirmFill} onOpenChange={setConfirmFill}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Timpa dengan Hasil Normal?</AlertDialogTitle>
            <AlertDialogDescription>
              Beberapa data laboratorium sudah terisi. Apakah ingin menimpa dengan hasil normal?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmFill(false); applyNormalPreset(); }}>
              Timpa dengan Hasil Normal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kosongkan Form Laboratorium?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua field hematologi, urinalisa, kimia darah, dan skrining narkoba akan dikosongkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmClear(false); clearAll(); }}>
              Kosongkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SubteamFormShell>
  );
}

function Section({ title, fields, row, set, kind, highlighted }: { title: string; fields: any[][]; row: any; set: (p: any) => void; kind?: "select"; highlighted?: Set<string> }) {
  return (
    <div className="mt-4 pt-4 border-t border-slate-200 first:border-t-0 first:pt-0 first:mt-0">
      <h4 className="text-sm font-semibold text-slate-800 mb-2">{title}</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {fields.map(([k, label]) => (
          <div key={k}>
            <Label className="text-xs">{label}</Label>
            {kind === "select" ? (
              <select className={`h-9 w-full px-2 rounded-md border border-input bg-background text-sm ${highlighted?.has(k) ? "ring-2 ring-emerald-300 transition" : ""}`} value={row[k] ?? ""} onChange={(e) => set({ [k]: e.target.value })}>
                <option value="">—</option><option>Negatif</option><option>Positif</option>
              </select>
            ) : (
              <Input className={highlighted?.has(k) ? "ring-2 ring-emerald-300 transition" : undefined} value={row[k] ?? ""} onChange={(e) => set({ [k]: e.target.value })} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}