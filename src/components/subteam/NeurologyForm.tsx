import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SubteamFormShell, QualificationSelect } from "./SubteamFormShell";
import { logAudit } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export function NeurologyForm({ examId, candidateId, readOnly, canEditAfterSubmit }: { examId: string; candidateId: string; readOnly?: boolean; canEditAfterSubmit?: boolean }) {
  const [row, setRow] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from("exam_neurology").select("*").eq("exam_id", examId).maybeSingle();
    setRow(data ?? { is_optional: true, status: "Draft" });
  }
  useEffect(() => { if (examId) load(); }, [examId]);

  function set(p: any) { setRow((r: any) => ({ ...r, ...p })); }

  async function persist(status: string, revisionReason?: string) {
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        exam_id: examId, candidate_id: candidateId,
        is_optional: !!row.is_optional,
        consciousness: row.consciousness ?? null,
        cranial_nerves: row.cranial_nerves ?? null,
        motoric: row.motoric ?? null,
        sensoric: row.sensoric ?? null,
        reflexes: row.reflexes ?? null,
        coordination: row.coordination ?? null,
        autonomic: row.autonomic ?? null,
        conclusion: row.conclusion ?? null,
        qualification_u: row.qualification_u || null,
        examiner_id: u.user?.id,
        examined_at: new Date().toISOString(),
        status,
      };
      const q = row?.id
        ? supabase.from("exam_neurology").update(payload).eq("id", row.id)
        : supabase.from("exam_neurology").insert(payload);
      const { error } = await q;
      if (error) throw error;
      await logAudit({
        action: revisionReason
          ? "revise_neuro_after_submit"
          : status === "Submitted" ? "submit_neuro" : "save_neuro",
        module: "rikkes",
        record_id: examId,
        candidate_id: candidateId,
        after: revisionReason ? { reason: revisionReason } : undefined,
      });
      toast.success(
        revisionReason
          ? "Revisi tersimpan, status tetap Submitted"
          : status === "Submitted" ? "Neurologi disubmit" : "Draft tersimpan"
      );
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  if (!row) return <div className="text-sm text-slate-500">Memuat…</div>;

  function quickNormal() {
    set({
      consciousness: "Compos mentis, GCS E4V5M6",
      cranial_nerves: "N. I–XII dalam batas normal",
      motoric: "Kekuatan 5/5 keempat ekstremitas, tonus normal",
      sensoric: "Sensibilitas baik, tidak ada defisit",
      reflexes: "Refleks fisiologis (+) normal, refleks patologis (-)",
      coordination: "Tes Romberg negatif, koordinasi baik",
      autonomic: "Dalam batas normal",
      conclusion: "Status neurologis dalam batas normal",
      qualification_u: "U-1",
    });
  }

  return (
    <SubteamFormShell title="Pemeriksaan Neurologi" status={row.status ?? "Draft"} readOnly={readOnly} busy={busy}
      onSaveDraft={() => persist("Draft")} onSubmit={() => persist("Submitted")}
      canEditAfterSubmit={canEditAfterSubmit}
      onSaveRevision={(reason) => persist("Submitted", reason)}
      extraActions={<Button variant="secondary" size="sm" onClick={quickNormal}><Sparkles className="h-4 w-4 mr-1.5" />Isi Normal</Button>}>
      <div className="space-y-4">
        <label className="inline-flex items-center gap-2 text-sm">
          <Checkbox checked={!!row.is_optional} onCheckedChange={(v) => set({ is_optional: !!v })} />
          Section opsional (tidak wajib untuk seleksi ini)
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Kesadaran</Label><Input value={row.consciousness ?? ""} onChange={(e) => set({ consciousness: e.target.value })} placeholder="Compos mentis…" /></div>
          <div><Label>Saraf Kranial</Label><Input value={row.cranial_nerves ?? ""} onChange={(e) => set({ cranial_nerves: e.target.value })} /></div>
          <div><Label>Motorik</Label><Textarea rows={2} value={row.motoric ?? ""} onChange={(e) => set({ motoric: e.target.value })} /></div>
          <div><Label>Sensorik</Label><Textarea rows={2} value={row.sensoric ?? ""} onChange={(e) => set({ sensoric: e.target.value })} /></div>
          <div><Label>Refleks</Label><Textarea rows={2} value={row.reflexes ?? ""} onChange={(e) => set({ reflexes: e.target.value })} /></div>
          <div><Label>Koordinasi</Label><Textarea rows={2} value={row.coordination ?? ""} onChange={(e) => set({ coordination: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Otonom</Label><Input value={row.autonomic ?? ""} onChange={(e) => set({ autonomic: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Kesimpulan</Label><Textarea rows={3} value={row.conclusion ?? ""} onChange={(e) => set({ conclusion: e.target.value })} /></div>
          <div><Label>Kualifikasi (U)</Label><div className="mt-1"><QualificationSelect value={row.qualification_u} onChange={(v) => set({ qualification_u: v })} /></div></div>
        </div>
      </div>
    </SubteamFormShell>
  );
}