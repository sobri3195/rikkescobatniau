import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/local-supabase-shim";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Send, Undo2, FileDown, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { generatePemeriksaanUmumPDF } from "@/lib/evaluasi-pdf";

type Props = { cand: any; examId?: string };

const STATUS_STYLE: Record<string, string> = {
  Draft: "bg-amber-100 text-amber-800 border-amber-200",
  Submitted: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Revision: "bg-orange-100 text-orange-700 border-orange-200",
  Locked: "bg-slate-100 text-slate-700 border-slate-200",
};

export function PemeriksaanUmumForm({ cand, examId }: Props) {
  const { roles } = useAuth();
  const canEdit = ["super_admin", "admin", "dokter", "kepala_sub_tim", "registrasi"].some((r) => roles.includes(r));

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rowId, setRowId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Draft");
  const [data, setData] = useState<any>({
    height_cm: "", weight_kg: "", leg_length_cm: "",
    chest_inspiration_cm: "", chest_expiration_cm: "",
    anamnesis: "", conclusion: "", qualification_u: "",
  });

  const load = useCallback(async () => {
    if (!examId) { setLoading(false); return; }
    setLoading(true);
    const { data: row } = await supabase.from("exam_general").select("*").eq("exam_id", examId).maybeSingle();
    if (row) {
      setRowId(row.id);
      setStatus(row.status ?? "Draft");
      setData({
        height_cm: row.height_cm ?? "",
        weight_kg: row.weight_kg ?? "",
        leg_length_cm: row.leg_length_cm ?? "",
        chest_inspiration_cm: row.chest_inspiration_cm ?? "",
        chest_expiration_cm: row.chest_expiration_cm ?? "",
        anamnesis: row.anamnesis ?? "",
        conclusion: row.conclusion ?? "",
        qualification_u: row.qualification_u ?? "",
      });
    }
    setLoading(false);
  }, [examId]);

  useEffect(() => { load(); }, [load]);

  function set(patch: any) { setData((d: any) => ({ ...d, ...patch })); }

  function numOrNull(v: any) {
    if (v === "" || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  async function persist(nextStatus: string) {
    if (!examId) { toast.error("Exam belum tersedia"); return; }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = {
        candidate_id: cand.id,
        exam_id: examId,
        height_cm: numOrNull(data.height_cm),
        weight_kg: numOrNull(data.weight_kg),
        leg_length_cm: numOrNull(data.leg_length_cm),
        chest_inspiration_cm: numOrNull(data.chest_inspiration_cm),
        chest_expiration_cm: numOrNull(data.chest_expiration_cm),
        anamnesis: data.anamnesis || null,
        conclusion: data.conclusion || null,
        qualification_u: data.qualification_u || null,
        examiner_id: u.user?.id ?? null,
        examined_at: new Date().toISOString(),
        status: nextStatus,
      };

      if (nextStatus === "Submitted") {
        if (!payload.anamnesis) { toast.error("Anamnesa wajib diisi sebelum Submit"); setBusy(false); return; }
        if (!payload.conclusion) { toast.error("Kesimpulan wajib diisi sebelum Submit"); setBusy(false); return; }
      }

      let result;
      if (rowId) {
        const { data: row, error } = await supabase.from("exam_general").update(payload).eq("id", rowId).select().single();
        if (error) throw error;
        result = row;
      } else {
        const { data: row, error } = await supabase.from("exam_general").insert(payload).select().single();
        if (error) throw error;
        result = row;
        setRowId(row.id);
      }

      // sync to medical_measurements height/weight
      if (payload.height_cm != null || payload.weight_kg != null) {
        const { data: mm } = await supabase.from("medical_measurements").select("id").eq("exam_id", examId).maybeSingle();
        const mmPatch: any = {};
        if (payload.height_cm != null) mmPatch.height_cm = payload.height_cm;
        if (payload.weight_kg != null) mmPatch.weight_kg = payload.weight_kg;
        if (mm) await supabase.from("medical_measurements").update(mmPatch).eq("id", mm.id);
        else await supabase.from("medical_measurements").insert({ ...mmPatch, exam_id: examId, candidate_id: cand.id });
      }

      setStatus(result.status);
      await logAudit({
        action: nextStatus === "Submitted" ? "submit_general_exam" : "save_general_exam",
        module: "evaluasi", exam_id: examId, candidate_id: cand.id, after: payload,
      });
      // Recompute summary so Rekap APLIKASI & Laporan Tahap reflect the change
      // immediately, even if other sections are still incomplete.
      try {
        const { recalculateExamSummary } = await import("@/lib/rikkes-calculations");
        await recalculateExamSummary(examId);
      } catch { /* non-fatal */ }
      toast.success(nextStatus === "Submitted" ? "Pemeriksaan Umum disubmit" : "Draft tersimpan");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  }

  async function returnToDraft() {
    if (!rowId) return;
    await supabase.from("exam_general").update({ status: "Draft" }).eq("id", rowId);
    setStatus("Draft");
    await logAudit({ action: "return_general_to_draft", module: "evaluasi", exam_id: examId, candidate_id: cand.id });
    toast.success("Dikembalikan ke Draft");
  }

  async function exportPDF() {
    try {
      await generatePemeriksaanUmumPDF({
        cand,
        data: {
          height_cm: numOrNull(data.height_cm),
          weight_kg: numOrNull(data.weight_kg),
          leg_length_cm: numOrNull(data.leg_length_cm),
          chest_inspiration_cm: numOrNull(data.chest_inspiration_cm),
          chest_expiration_cm: numOrNull(data.chest_expiration_cm),
          anamnesis: data.anamnesis,
          conclusion: data.conclusion,
          qualification_u: data.qualification_u,
        },
        examinedAt: new Date().toISOString(),
        isDraft: status === "Draft" || status === "Revision",
      });
      await logAudit({ action: "export_evaluation_pdf", module: "evaluasi", exam_id: examId, candidate_id: cand.id, after: { section: "pemeriksaan_umum" } });
    } catch (e: any) { toast.error(e.message); }
  }

  if (loading) return <div className="p-6 text-slate-500"><Loader2 className="h-4 w-4 inline animate-spin mr-2" />Memuat…</div>;

  const locked = status === "Locked";
  const submitted = status === "Submitted" || status === "Approved";
  const readOnly = locked || (submitted && !canEdit);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-slate-900">Lembar Evaluasi — Pemeriksaan Umum</h3>
          <Badge className={`${STATUS_STYLE[status] ?? STATUS_STYLE.Draft} border rounded-full text-[11px]`}>Status: {status}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportPDF}><FileDown className="h-4 w-4 mr-1.5" /> Export PDF</Button>
          {submitted && canEdit && <Button variant="destructive" size="sm" onClick={returnToDraft}><Undo2 className="h-4 w-4 mr-1.5" /> Ke Draft</Button>}
          {!readOnly && (
            <>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => persist("Draft")}><Save className="h-4 w-4 mr-1.5" /> Simpan Draft</Button>
              <Button size="sm" disabled={busy} onClick={() => persist("Submitted")}><Send className="h-4 w-4 mr-1.5" /> Submit</Button>
            </>
          )}
        </div>
      </div>

      {locked && (
        <div className="p-3 bg-slate-100 border border-slate-200 rounded-md text-sm text-slate-700 flex items-center gap-2">
          <Lock className="h-4 w-4" /> Section ini dikunci karena pemeriksaan telah difinalisasi.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Tinggi Badan (cm)"><Input type="number" inputMode="decimal" value={data.height_cm} onChange={(e) => set({ height_cm: e.target.value })} disabled={readOnly} /></Field>
        <Field label="Berat Badan (kg)"><Input type="number" inputMode="decimal" value={data.weight_kg} onChange={(e) => set({ weight_kg: e.target.value })} disabled={readOnly} /></Field>
        <Field label="Panjang Kaki (cm)"><Input type="number" inputMode="decimal" value={data.leg_length_cm} onChange={(e) => set({ leg_length_cm: e.target.value })} disabled={readOnly} /></Field>
        <Field label="Lingkar Dada Inspirasi (cm)"><Input type="number" inputMode="decimal" value={data.chest_inspiration_cm} onChange={(e) => set({ chest_inspiration_cm: e.target.value })} disabled={readOnly} /></Field>
        <Field label="Lingkar Dada Ekspirasi (cm)"><Input type="number" inputMode="decimal" value={data.chest_expiration_cm} onChange={(e) => set({ chest_expiration_cm: e.target.value })} disabled={readOnly} /></Field>
        <Field label="Kualifikasi U">
          <Select value={data.qualification_u || ""} onValueChange={(v) => set({ qualification_u: v })} disabled={readOnly}>
            <SelectTrigger><SelectValue placeholder="Pilih kualifikasi" /></SelectTrigger>
            <SelectContent>
              {["B", "C", "K1", "K2"].map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Anamnesa (wajib saat Submit)">
        <Textarea rows={4} value={data.anamnesis} onChange={(e) => set({ anamnesis: e.target.value })} disabled={readOnly} placeholder="Riwayat keluhan, penyakit, kondisi pasien…" />
      </Field>
      <Field label="Kesimpulan (wajib saat Submit)">
        <Textarea rows={4} value={data.conclusion} onChange={(e) => set({ conclusion: e.target.value })} disabled={readOnly} placeholder="Kesimpulan pemeriksaan umum…" />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-700">{label}</Label>
      {children}
    </div>
  );
}