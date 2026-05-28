import { useEffect, useState } from "react";
import { supabase } from "@/lib/local-supabase-shim";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SubteamFormShell, QualificationSelect } from "./SubteamFormShell";
import { logAudit } from "@/lib/audit";
import { syncRikkesGroupStatus } from "@/lib/sync-rikkes-section";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export function ThtForm({ examId, candidateId, readOnly, canEditAfterSubmit }: { examId: string; candidateId: string; readOnly?: boolean; canEditAfterSubmit?: boolean }) {
  const [row, setRow] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from("exam_ent").select("*").eq("exam_id", examId).maybeSingle();
    let base: any = data ?? {
      ear_right: "", ear_left: "", nose: "", throat: "", larynx: "",
      hearing_notes: "", conclusion: "", qualification_u: "",
      whisper_ad: "", whisper_as: "", status: "Draft",
    };
    // Backward compatibility: pull whisper data previously saved under
    // mata_tht.form_data_json (bisikan_ad / bisikan_as) if THT row has none.
    if (!base.whisper_ad && !base.whisper_as) {
      const { data: legacy } = await supabase
        .from("rikkes_form_sections")
        .select("form_data_json")
        .eq("exam_id", examId)
        .eq("group_key", "mata_tht")
        .maybeSingle();
      const fd: any = legacy?.form_data_json ?? {};
      if (fd.bisikan_ad || fd.bisikan_as) {
        base = { ...base, whisper_ad: base.whisper_ad || fd.bisikan_ad || "", whisper_as: base.whisper_as || fd.bisikan_as || "" };
      }
    }
    setRow(base);
  }
  useEffect(() => { if (examId) load(); }, [examId]);

  function set(p: any) { setRow((r: any) => ({ ...r, ...p })); }

  async function persist(status: string, revisionReason?: string) {
    if (!examId) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        exam_id: examId,
        candidate_id: candidateId,
        ear_right: row.ear_right ?? null,
        ear_left: row.ear_left ?? null,
        nose: row.nose ?? null,
        throat: row.throat ?? null,
        larynx: row.larynx ?? null,
        hearing_notes: row.hearing_notes ?? null,
        whisper_ad: row.whisper_ad ?? null,
        whisper_as: row.whisper_as ?? null,
        conclusion: row.conclusion ?? null,
        qualification_u: row.qualification_u || null,
        examiner_id: u.user?.id,
        examined_at: new Date().toISOString(),
        status,
      };
      const q = row?.id
        ? supabase.from("exam_ent").update(payload).eq("id", row.id)
        : supabase.from("exam_ent").insert(payload);
      const { error } = await q;
      if (error) throw error;
      await syncRikkesGroupStatus({
        examId, candidateId, groupKey: "tht_subtim",
        status, uid: u.user?.id, revisionReason,
      });
      await logAudit({
        action: revisionReason
          ? "revise_tht_after_submit"
          : status === "Submitted" ? "submit_tht" : "save_tht",
        module: "rikkes",
        record_id: examId,
        candidate_id: candidateId,
        after: revisionReason ? { reason: revisionReason } : undefined,
      });
      toast.success(
        revisionReason
          ? "Revisi tersimpan, status tetap Submitted"
          : status === "Submitted" ? "THT disubmit" : "Draft tersimpan"
      );
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  if (!row) return <div className="text-sm text-slate-500">Memuat…</div>;

  function quickNormal() {
    set({
      ear_right: "Membran timpani intak, refleks cahaya (+), tidak ada sekret",
      ear_left: "Membran timpani intak, refleks cahaya (+), tidak ada sekret",
      nose: "Mukosa hidung normal, septum lurus, konka eutrofi",
      throat: "Tonsil T1/T1 tenang, faring tidak hiperemis",
      larynx: "Dalam batas normal",
      hearing_notes: "Pendengaran kesan normal kanan/kiri",
      conclusion: "THT dalam batas normal",
      qualification_u: "U-1",
    });
  }

  return (
    <SubteamFormShell title="Pemeriksaan THT" status={row.status ?? "Draft"} readOnly={readOnly} busy={busy}
      onSaveDraft={() => persist("Draft")} onSubmit={() => persist("Submitted")}
      canEditAfterSubmit={canEditAfterSubmit}
      onSaveRevision={(reason) => persist("Submitted", reason)}
      extraActions={<Button variant="secondary" size="sm" onClick={quickNormal}><Sparkles className="h-4 w-4 mr-1.5" />Isi Normal</Button>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><Label>Telinga Kanan</Label><Textarea rows={2} value={row.ear_right ?? ""} onChange={(e) => set({ ear_right: e.target.value })} /></div>
        <div><Label>Telinga Kiri</Label><Textarea rows={2} value={row.ear_left ?? ""} onChange={(e) => set({ ear_left: e.target.value })} /></div>
        <div><Label>Hidung</Label><Textarea rows={2} value={row.nose ?? ""} onChange={(e) => set({ nose: e.target.value })} /></div>
        <div><Label>Tenggorokan</Label><Textarea rows={2} value={row.throat ?? ""} onChange={(e) => set({ throat: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Laring</Label><Input value={row.larynx ?? ""} onChange={(e) => set({ larynx: e.target.value })} /></div>
        <div><Label>54. Suara Bisikan AD</Label><Input value={row.whisper_ad ?? ""} onChange={(e) => set({ whisper_ad: e.target.value })} placeholder="6m" /></div>
        <div><Label>54. Suara Bisikan AS</Label><Input value={row.whisper_as ?? ""} onChange={(e) => set({ whisper_as: e.target.value })} placeholder="6m" /></div>
        <div className="md:col-span-2"><Label>Catatan Pendengaran</Label><Textarea rows={2} value={row.hearing_notes ?? ""} onChange={(e) => set({ hearing_notes: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Kesimpulan</Label><Textarea rows={3} value={row.conclusion ?? ""} onChange={(e) => set({ conclusion: e.target.value })} /></div>
        <div><Label>Kualifikasi (U)</Label><div className="mt-1"><QualificationSelect value={row.qualification_u} onChange={(v) => set({ qualification_u: v })} /></div></div>
      </div>
    </SubteamFormShell>
  );
}