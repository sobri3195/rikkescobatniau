import { useEffect, useState } from "react";
import { localDataApi } from "@/lib/localDataApi";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SubteamFormShell, QualificationSelect } from "./SubteamFormShell";
import { logAudit } from "@/lib/audit";
import { syncRikkesGroupStatus } from "@/lib/sync-rikkes-section";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export function EyeVisionForm({ examId, candidateId, readOnly, canEditAfterSubmit }: { examId: string; candidateId: string; readOnly?: boolean; canEditAfterSubmit?: boolean }) {
  const [row, setRow] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await localDataApi.from("exam_eye_vision").select("*").eq("exam_id", examId).maybeSingle();
    setRow(data ?? { status: "Draft" });
  }
  useEffect(() => { if (examId) load(); }, [examId]);

  function set(p: any) { setRow((r: any) => ({ ...r, ...p })); }

  async function persist(status: string, revisionReason?: string) {
    setBusy(true);
    try {
      const { data: u } = await localDataApi.auth.getUser();
      const payload = {
        exam_id: examId, candidate_id: candidateId,
        visus_od: row.visus_od ?? null, visus_os: row.visus_os ?? null,
        visus_corrected_od: row.visus_corrected_od ?? null, visus_corrected_os: row.visus_corrected_os ?? null,
        refraction_od: row.refraction_od ?? null, refraction_os: row.refraction_os ?? null,
        color_perception: row.color_perception ?? null,
        stereopsis: row.stereopsis ?? null,
        field_of_vision: row.field_of_vision ?? null,
        conclusion: row.conclusion ?? null,
        qualification_l: row.qualification_l || null,
        examiner_id: u.user?.id,
        examined_at: new Date().toISOString(),
        status,
      };
      const q = row?.id
        ? localDataApi.from("exam_eye_vision").update(payload).eq("id", row.id)
        : localDataApi.from("exam_eye_vision").insert(payload);
      const { error } = await q;
      if (error) throw error;
      await syncRikkesGroupStatus({
        examId, candidateId, groupKey: "mata_visus_subtim",
        status, uid: u.user?.id, revisionReason,
      });
      await logAudit({
        action: revisionReason
          ? "revise_eye_vision_after_submit"
          : status === "Submitted" ? "submit_eye_vision" : "save_eye_vision",
        module: "rikkes",
        record_id: examId,
        candidate_id: candidateId,
        after: revisionReason ? { reason: revisionReason } : undefined,
      });
      toast.success(
        revisionReason
          ? "Revisi tersimpan, status tetap Submitted"
          : status === "Submitted" ? "Mata Visus disubmit" : "Draft tersimpan"
      );
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  if (!row) return <div className="text-sm text-slate-500">Memuat…</div>;

  function quickNormal() {
    set({
      visus_od: "6/6", visus_os: "6/6",
      visus_corrected_od: "6/6", visus_corrected_os: "6/6",
      refraction_od: "Emetrop", refraction_os: "Emetrop",
      color_perception: "Normal (Ishihara 14/14)",
      stereopsis: "Normal",
      field_of_vision: "Dalam batas normal",
      conclusion: "Visus dan fungsi mata dalam batas normal",
      qualification_l: "L-1",
    });
  }

  return (
    <SubteamFormShell title="Mata Lihat / Visus" status={row.status ?? "Draft"} readOnly={readOnly} busy={busy}
      onSaveDraft={() => persist("Draft")} onSubmit={() => persist("Submitted")}
      canEditAfterSubmit={canEditAfterSubmit}
      onSaveRevision={(reason) => persist("Submitted", reason)}
      extraActions={<Button variant="secondary" size="sm" onClick={quickNormal}><Sparkles className="h-4 w-4 mr-1.5" />Isi Normal</Button>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><Label>Visus OD (tanpa koreksi)</Label><Input value={row.visus_od ?? ""} onChange={(e) => set({ visus_od: e.target.value })} placeholder="6/6" /></div>
        <div><Label>Visus OS (tanpa koreksi)</Label><Input value={row.visus_os ?? ""} onChange={(e) => set({ visus_os: e.target.value })} placeholder="6/6" /></div>
        <div><Label>Visus OD (koreksi)</Label><Input value={row.visus_corrected_od ?? ""} onChange={(e) => set({ visus_corrected_od: e.target.value })} /></div>
        <div><Label>Visus OS (koreksi)</Label><Input value={row.visus_corrected_os ?? ""} onChange={(e) => set({ visus_corrected_os: e.target.value })} /></div>
        <div><Label>Refraksi OD</Label><Input value={row.refraction_od ?? ""} onChange={(e) => set({ refraction_od: e.target.value })} placeholder="S-1.00 C-0.50 x 90" /></div>
        <div><Label>Refraksi OS</Label><Input value={row.refraction_os ?? ""} onChange={(e) => set({ refraction_os: e.target.value })} /></div>
        <div><Label>Persepsi Warna</Label><Input value={row.color_perception ?? ""} onChange={(e) => set({ color_perception: e.target.value })} placeholder="Normal/CVD ringan…" /></div>
        <div><Label>Stereopsis</Label><Input value={row.stereopsis ?? ""} onChange={(e) => set({ stereopsis: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Lapang Pandang</Label><Input value={row.field_of_vision ?? ""} onChange={(e) => set({ field_of_vision: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Kesimpulan</Label><Textarea rows={3} value={row.conclusion ?? ""} onChange={(e) => set({ conclusion: e.target.value })} /></div>
        <div><Label>Kualifikasi (L)</Label><div className="mt-1"><QualificationSelect type="L" value={row.qualification_l} onChange={(v) => set({ qualification_l: v })} /></div></div>
      </div>
    </SubteamFormShell>
  );
}