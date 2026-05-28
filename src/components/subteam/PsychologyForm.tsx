import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Wand2 } from "lucide-react";
import { SubteamFormShell } from "./SubteamFormShell";
import { logAudit } from "@/lib/audit";
import { syncGroupToRekap } from "@/lib/rekap-sync";

type Stakes = "J1" | "J2" | "J4";
type Classification = "B" | "C" | "K2";
type ResultStatus = "MS" | "TMS";

const STAKES_OPTIONS: { value: Stakes; label: string }[] = [
  { value: "J1", label: "J1 - B" },
  { value: "J2", label: "J2 - C" },
  { value: "J4", label: "J4 - K2 (TMS)" },
];

const STAKES_MAP: Record<Stakes, { classification: Classification; result: ResultStatus; conclusion: string }> = {
  J1: { classification: "B", result: "MS", conclusion: "J1 - B. Memenuhi syarat Keswa." },
  J2: { classification: "C", result: "MS", conclusion: "J2 - C. Memenuhi syarat dengan catatan Keswa." },
  J4: { classification: "K2", result: "TMS", conclusion: "J4 - K2 TMS. Gangguan psikotik, gangguan cemas, gangguan depresi. (TMS)" },
};

const OTHER_SYMPTOMS = [
  "Anxietas", "Depresi", "Phobia", "Obsesi-kompulsi", "Histrionik", "Disosiasi",
  "Konversi", "Neurastenia", "Skizoid", "Paranoid", "Dependen", "Pasif-agresif",
  "Antisosial", "Gangguan mood", "Ketergantungan obat", "Minuman keras",
  "Deviasi seksual", "Gangguan psikofisiologik lain",
];

function Choice<T extends string>(props: {
  label: string;
  value: T | null | undefined;
  options: { value: T; label?: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{props.label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {props.options.map((o) => {
          const active = props.value === o.value;
          return (
            <button
              type="button"
              key={o.value}
              disabled={props.disabled}
              onClick={() => props.onChange(o.value)}
              className={`px-3 py-1 rounded-full text-xs border transition ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              {o.label ?? o.value}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const DEFAULT_NORMAL = {
  keswa_appearance_neatness: "Rapi",
  keswa_speech: "Tenang",
  keswa_attitude: "Kooperatif",
  keswa_behavior: "Normal",
  keswa_affect: "Eutim",
  keswa_emotion_stability: "Baik",
  keswa_emotion_control: "Baik",
  keswa_memory: "Baik",
  keswa_orientation: "Baik",
  keswa_opinion_ability: "Baik",
  keswa_perception_disorder: "Tidak ada",
  keswa_thought_process_quality: "Jelas",
  keswa_thought_process_content: "Normal",
  keswa_other_symptoms: [] as string[],
  keswa_diagnosis: "Dalam batas normal",
  keswa_stakes: "J1" as Stakes,
  keswa_classification: "B" as Classification,
  keswa_result_status: "MS" as ResultStatus,
  keswa_conclusion: STAKES_MAP.J1.conclusion,
};

export function PsychologyForm({ examId, candidateId, readOnly, canEditAfterSubmit }: { examId: string; candidateId: string; readOnly?: boolean; canEditAfterSubmit?: boolean }) {
  const [row, setRow] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from("exam_psychology").select("*").eq("exam_id", examId).maybeSingle();
    setRow(data ?? { status: "Draft" });
  }
  useEffect(() => { if (examId) load(); }, [examId]);

  function set(p: any) { setRow((r: any) => ({ ...r, ...p })); }

  function applyStakes(s: Stakes) {
    const m = STAKES_MAP[s];
    setRow((r: any) => ({
      ...r,
      keswa_stakes: s,
      keswa_classification: m.classification,
      keswa_result_status: m.result,
      // Auto-fill conclusion only if user hasn't customized it for current STAKES yet
      keswa_conclusion:
        !r?.keswa_conclusion || Object.values(STAKES_MAP).some((x) => x.conclusion === r.keswa_conclusion)
          ? m.conclusion
          : r.keswa_conclusion,
    }));
  }

  function toggleSymptom(name: string) {
    setRow((r: any) => {
      const cur: string[] = Array.isArray(r?.keswa_other_symptoms) ? r.keswa_other_symptoms : [];
      const next = cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name];
      return { ...r, keswa_other_symptoms: next };
    });
  }

  function fillNormal() {
    setRow((r: any) => ({ ...r, ...DEFAULT_NORMAL }));
  }

  async function persist(status: string, revisionReason?: string) {
    if (status === "Submitted" && !row.keswa_stakes) {
      toast.error("STAKES Keswa wajib dipilih sebelum submit.");
      return;
    }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = {
        exam_id: examId, candidate_id: candidateId,
        // New Keswa fields
        keswa_anamnesis_preschool: row.keswa_anamnesis_preschool ?? null,
        keswa_anamnesis_school: row.keswa_anamnesis_school ?? null,
        keswa_anamnesis_other: row.keswa_anamnesis_other ?? null,
        keswa_appearance_neatness: row.keswa_appearance_neatness ?? null,
        keswa_speech: row.keswa_speech ?? null,
        keswa_attitude: row.keswa_attitude ?? null,
        keswa_behavior: row.keswa_behavior ?? null,
        keswa_affect: row.keswa_affect ?? null,
        keswa_emotion_stability: row.keswa_emotion_stability ?? null,
        keswa_emotion_control: row.keswa_emotion_control ?? null,
        keswa_memory: row.keswa_memory ?? null,
        keswa_orientation: row.keswa_orientation ?? null,
        keswa_opinion_ability: row.keswa_opinion_ability ?? null,
        keswa_perception_disorder: row.keswa_perception_disorder ?? null,
        keswa_thought_process_quality: row.keswa_thought_process_quality ?? null,
        keswa_thought_process_content: row.keswa_thought_process_content ?? null,
        keswa_other_symptoms: Array.isArray(row.keswa_other_symptoms) ? row.keswa_other_symptoms : null,
        keswa_diagnosis: row.keswa_diagnosis ?? null,
        keswa_stakes: row.keswa_stakes ?? null,
        keswa_classification: row.keswa_classification ?? null,
        keswa_result_status: row.keswa_result_status ?? null,
        keswa_conclusion: row.keswa_conclusion ?? null,
        // Legacy mirror so existing reports keep working
        conclusion: row.keswa_conclusion ?? row.conclusion ?? null,
        classification: row.keswa_classification ?? row.classification ?? null,
        examiner_id: u.user?.id, examined_at: new Date().toISOString(), status,
      };
      const q = row?.id
        ? supabase.from("exam_psychology").update(payload).eq("id", row.id)
        : supabase.from("exam_psychology").insert(payload);
      const { error } = await q;
      if (error) throw error;

      // Mirror to exam_sections so KESUM/medical_summary/rekap stay in sync
      await syncGroupToRekap({
        examId, candidateId,
        groupKey: "psikologi_subtim",
        status,
        payload: {
          classification: row.keswa_classification ?? null,
          kesimpulan: row.keswa_conclusion ?? null,
          catatan: row.keswa_diagnosis ?? null,
        },
      });

      await logAudit({
        action: revisionReason
          ? "revise_keswa_after_submit"
          : status === "Submitted" ? "submit_keswa" : "save_keswa",
        module: "rikkes",
        record_id: examId,
        candidate_id: candidateId,
        after: {
          stakes: row.keswa_stakes,
          classification: row.keswa_classification,
          result: row.keswa_result_status,
          ...(revisionReason ? { reason: revisionReason } : {}),
        },
      });
      toast.success(
        revisionReason
          ? "Revisi Keswa tersimpan, status tetap Submitted"
          : status === "Submitted" ? "Keswa disubmit" : "Draft tersimpan"
      );
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Gagal menyimpan Keswa");
    } finally { setBusy(false); }
  }

  const isTMS = row?.keswa_stakes === "J4";
  const symptoms: string[] = useMemo(
    () => (Array.isArray(row?.keswa_other_symptoms) ? row.keswa_other_symptoms : []),
    [row?.keswa_other_symptoms],
  );

  if (!row) return <div className="text-sm text-slate-500">Memuat…</div>;

  // SubteamFormShell handles the post-submit lockdown via its fieldset.
  // Keep `disabled` aligned with readOnly only so Edit Data mode can re-enable inputs.
  const disabled = readOnly;

  return (
    <SubteamFormShell
      title="Keswa (Status Psikiatri)"
      status={row.status ?? "Draft"}
      readOnly={readOnly}
      busy={busy}
      onSaveDraft={() => persist("Draft")}
      onSubmit={() => persist("Submitted")}
      canEditAfterSubmit={canEditAfterSubmit}
      onSaveRevision={(reason) => persist("Submitted", reason)}
      extraActions={
        <Button variant="outline" size="sm" onClick={fillNormal} disabled={disabled || busy}>
          <Wand2 className="h-4 w-4 mr-1.5" /> Isi Normal
        </Button>
      }
    >
      <div className="space-y-6">
        <h4 className="font-semibold text-slate-800 text-sm">Pemeriksaan Keswa</h4>

        {/* 1. Anamnesis */}
        <fieldset className="space-y-3 border border-slate-200 rounded-md p-4">
          <legend className="px-1 text-xs font-semibold text-slate-700">1. Anamnesis Keswa</legend>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><Label className="text-xs">Masa kecil pra sekolah</Label>
              <Textarea rows={2} value={row.keswa_anamnesis_preschool ?? ""} onChange={(e) => set({ keswa_anamnesis_preschool: e.target.value })} /></div>
            <div><Label className="text-xs">Masa sekolah</Label>
              <Textarea rows={2} value={row.keswa_anamnesis_school ?? ""} onChange={(e) => set({ keswa_anamnesis_school: e.target.value })} /></div>
            <div><Label className="text-xs">Lain-lain</Label>
              <Textarea rows={2} value={row.keswa_anamnesis_other ?? ""} onChange={(e) => set({ keswa_anamnesis_other: e.target.value })} /></div>
          </div>
        </fieldset>

        {/* 2-5 status mental */}
        <fieldset className="space-y-4 border border-slate-200 rounded-md p-4">
          <legend className="px-1 text-xs font-semibold text-slate-700">2. Status Mental</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Choice label="Penampilan — Kerapihan" value={row.keswa_appearance_neatness} options={[{ value: "Rapi" }, { value: "Tidak rapi" }]} onChange={(v) => set({ keswa_appearance_neatness: v })} disabled={disabled} />
            <Choice label="Penampilan — Cara bicara" value={row.keswa_speech} options={[{ value: "Tenang" }, { value: "Lirih" }, { value: "Tegang" }, { value: "Gagap" }]} onChange={(v) => set({ keswa_speech: v })} disabled={disabled} />
            <Choice label="Sikap" value={row.keswa_attitude} options={[{ value: "Kooperatif" }, { value: "Apatis" }, { value: "Bermusuhan" }]} onChange={(v) => set({ keswa_attitude: v })} disabled={disabled} />
            <Choice label="Tingkah Laku" value={row.keswa_behavior} options={[{ value: "Normal" }, { value: "Hiperaktif" }, { value: "Hipoaktif" }, { value: "Gelisah" }]} onChange={(v) => set({ keswa_behavior: v })} disabled={disabled} />
            <Choice label="Keadaan Afek" value={row.keswa_affect} options={[{ value: "Hipertim" }, { value: "Hipotim" }, { value: "Eutim" }]} onChange={(v) => set({ keswa_affect: v })} disabled={disabled} />
          </div>
        </fieldset>

        {/* 6. Hidup Emosi */}
        <fieldset className="space-y-3 border border-slate-200 rounded-md p-4">
          <legend className="px-1 text-xs font-semibold text-slate-700">3. Hidup Emosi</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Choice label="Stabilitas" value={row.keswa_emotion_stability} options={[{ value: "Baik" }, { value: "Kurang" }]} onChange={(v) => set({ keswa_emotion_stability: v })} disabled={disabled} />
            <Choice label="Pengendalian" value={row.keswa_emotion_control} options={[{ value: "Baik" }, { value: "Kurang" }]} onChange={(v) => set({ keswa_emotion_control: v })} disabled={disabled} />
          </div>
        </fieldset>

        {/* 7. Fungsi Intelek */}
        <fieldset className="space-y-3 border border-slate-200 rounded-md p-4">
          <legend className="px-1 text-xs font-semibold text-slate-700">4. Fungsi Intelek</legend>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Choice label="Daya ingat" value={row.keswa_memory} options={[{ value: "Baik" }, { value: "Kurang" }]} onChange={(v) => set({ keswa_memory: v })} disabled={disabled} />
            <Choice label="Orientasi" value={row.keswa_orientation} options={[{ value: "Baik" }, { value: "Kurang" }]} onChange={(v) => set({ keswa_orientation: v })} disabled={disabled} />
            <Choice label="Kemampuan mengeluarkan pendapat" value={row.keswa_opinion_ability} options={[{ value: "Baik" }, { value: "Kurang" }]} onChange={(v) => set({ keswa_opinion_ability: v })} disabled={disabled} />
          </div>
        </fieldset>

        {/* 9-10 persepsi & proses pikir */}
        <fieldset className="space-y-3 border border-slate-200 rounded-md p-4">
          <legend className="px-1 text-xs font-semibold text-slate-700">5. Persepsi & Proses Pikir</legend>
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <Choice label="Kelainan Persepsi" value={row.keswa_perception_disorder} options={[{ value: "Tidak ada" }, { value: "Ilusi" }, { value: "Halusinasi" }]} onChange={(v) => set({ keswa_perception_disorder: v })} disabled={disabled} />
            <Choice label="Proses Pikir — Mutu" value={row.keswa_thought_process_quality} options={[{ value: "Jelas" }, { value: "Meloncat-loncat" }, { value: "Inkoheren" }, { value: "Terlambat" }]} onChange={(v) => set({ keswa_thought_process_quality: v })} disabled={disabled} />
            <Choice label="Proses Pikir — Isi" value={row.keswa_thought_process_content} options={[{ value: "Normal" }, { value: "Perasaan rendah diri" }, { value: "Perasaan bersalah berlebihan" }, { value: "Delusi" }]} onChange={(v) => set({ keswa_thought_process_content: v })} disabled={disabled} />
          </div>
        </fieldset>

        {/* 11. Gejala lain */}
        <fieldset className="space-y-2 border border-slate-200 rounded-md p-4">
          <legend className="px-1 text-xs font-semibold text-slate-700">6. Lain-lain / Gejala Psikiatri</legend>
          <div className="flex flex-wrap gap-1.5">
            {OTHER_SYMPTOMS.map((s) => {
              const active = symptoms.includes(s);
              return (
                <button
                  type="button"
                  key={s}
                  disabled={disabled}
                  onClick={() => toggleSymptom(s)}
                  className={`px-3 py-1 rounded-full text-xs border transition ${
                    active
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-background text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
          {symptoms.length > 0 && (
            <div className="text-xs text-slate-500">Dipilih: {symptoms.join(", ")}</div>
          )}
        </fieldset>

        {/* 12. Diagnosis */}
        <div className="space-y-1.5">
          <Label className="text-xs">Diagnosis Keswa</Label>
          <Textarea rows={2} value={row.keswa_diagnosis ?? ""} onChange={(e) => set({ keswa_diagnosis: e.target.value })} />
        </div>

        {/* 13-15 STAKES, klasifikasi, status */}
        <fieldset className="space-y-3 border border-slate-200 rounded-md p-4">
          <legend className="px-1 text-xs font-semibold text-slate-700">7. STAKES & Hasil Keswa</legend>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">STAKES Keswa <span className="text-red-600">*</span></Label>
              <select
                disabled={disabled}
                className="h-9 w-full px-2 rounded-md border border-input bg-background text-sm"
                value={row.keswa_stakes ?? ""}
                onChange={(e) => applyStakes(e.target.value as Stakes)}
              >
                <option value="">— Pilih STAKES —</option>
                {STAKES_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Klasifikasi Keswa</Label>
              <div className="h-9 px-2 rounded-md border border-slate-200 bg-slate-50 text-sm flex items-center">
                {row.keswa_classification ?? <span className="text-slate-400">—</span>}
              </div>
            </div>
            <div>
              <Label className="text-xs">Status Keswa</Label>
              <div className="h-9 px-2 rounded-md border border-slate-200 bg-slate-50 text-sm flex items-center">
                {row.keswa_result_status
                  ? <Badge className={row.keswa_result_status === "TMS" ? "bg-red-100 text-red-700 border-red-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"}>{row.keswa_result_status}</Badge>
                  : <span className="text-slate-400">—</span>}
              </div>
            </div>
          </div>
          {isTMS && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <span>Pilihan ini menghasilkan status <strong>TMS</strong>.</span>
            </div>
          )}
        </fieldset>

        {/* 16. Kesimpulan */}
        <div className="space-y-1.5">
          <Label className="text-xs">Kesimpulan Keswa</Label>
          <Textarea
            rows={3}
            value={row.keswa_conclusion ?? ""}
            onChange={(e) => set({ keswa_conclusion: e.target.value })}
            placeholder="Otomatis terisi sesuai STAKES; dapat diedit oleh yang berwenang."
          />
        </div>

        {/* Legacy data hint */}
        {(row.anamnesa || row.kepribadian || row.kecerdasan) && (
          <details className="text-xs text-slate-500 border-t pt-3">
            <summary className="cursor-pointer">Data lama (legacy psikologi)</summary>
            <div className="mt-2 space-y-1">
              {row.anamnesa && <div><strong>Anamnesa:</strong> {row.anamnesa}</div>}
              {row.kepribadian && <div><strong>Kepribadian:</strong> {row.kepribadian}</div>}
              {row.kecerdasan && <div><strong>Kecerdasan:</strong> {row.kecerdasan}</div>}
              {row.catatan_observasi && <div><strong>Catatan observasi:</strong> {row.catatan_observasi}</div>}
            </div>
          </details>
        )}
      </div>
    </SubteamFormShell>
  );
}