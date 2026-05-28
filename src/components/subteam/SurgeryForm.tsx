import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SubteamFormShell, QualificationSelect } from "./SubteamFormShell";
import { logAudit } from "@/lib/audit";
import { syncRikkesGroupStatus } from "@/lib/sync-rikkes-section";

const NORMAL_TEMPLATE = "Dalam batas normal, tidak ditemukan kelainan.";

export function SurgeryForm({ examId, candidateId, readOnly, canEditAfterSubmit }: { examId: string; candidateId: string; readOnly?: boolean; canEditAfterSubmit?: boolean }) {
  const [row, setRow] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from("exam_surgery").select("*").eq("exam_id", examId).maybeSingle();
    setRow(data ?? { status: "Draft" });
  }
  useEffect(() => { if (examId) load(); }, [examId]);

  function set(p: any) { setRow((r: any) => ({ ...r, ...p })); }

  function quickNormalAll() {
    set({
      general_condition: NORMAL_TEMPLATE,
      upper_extremity: NORMAL_TEMPLATE,
      lower_extremity: NORMAL_TEMPLATE,
      spine: NORMAL_TEMPLATE,
      inguinal: NORMAL_TEMPLATE,
    });
  }

  async function persist(status: string, revisionReason?: string) {
    // Validate: pemeriksaan wajib (general_condition + at least one detail) before submit
    if (status === "Submitted") {
      const required = [row.general_condition, row.upper_extremity, row.lower_extremity, row.spine].filter((x) => (x ?? "").trim().length > 0);
      if (required.length < 4) {
        toast.error("Lengkapi: keadaan umum, ekstremitas atas/bawah, dan tulang belakang sebelum submit.");
        return;
      }
    }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        exam_id: examId, candidate_id: candidateId,
        general_condition: row.general_condition ?? null,
        upper_extremity: row.upper_extremity ?? null,
        lower_extremity: row.lower_extremity ?? null,
        spine: row.spine ?? null,
        inguinal: row.inguinal ?? null,
        other_notes: row.other_notes ?? null,
        conclusion: row.conclusion ?? null,
        qualification_u: row.qualification_u || null,
        examiner_id: u.user?.id,
        examined_at: new Date().toISOString(),
        status,
      };
      const q = row?.id
        ? supabase.from("exam_surgery").update(payload).eq("id", row.id)
        : supabase.from("exam_surgery").insert(payload);
      const { error } = await q;
      if (error) throw error;
      await syncRikkesGroupStatus({
        examId, candidateId, groupKey: "bedah_subtim",
        status, uid: u.user?.id, revisionReason,
      });
      await logAudit({
        action: revisionReason
          ? "revise_surgery_after_submit"
          : status === "Submitted" ? "submit_surgery" : "save_surgery",
        module: "rikkes",
        record_id: examId,
        candidate_id: candidateId,
        after: revisionReason ? { reason: revisionReason } : undefined,
      });
      toast.success(
        revisionReason
          ? "Revisi tersimpan, status tetap Submitted"
          : status === "Submitted" ? "Bedah disubmit" : "Draft tersimpan"
      );
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  if (!row) return <div className="text-sm text-slate-500">Memuat…</div>;

  return (
    <SubteamFormShell title="Pemeriksaan Bedah" status={row.status ?? "Draft"} readOnly={readOnly} busy={busy}
      onSaveDraft={() => persist("Draft")} onSubmit={() => persist("Submitted")}
      canEditAfterSubmit={canEditAfterSubmit}
      onSaveRevision={(reason) => persist("Submitted", reason)}>
      <div className="flex items-center justify-end">
        <Button type="button" variant="outline" size="sm" onClick={quickNormalAll}>
          Isi cepat "Dalam batas normal"
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
        <div className="md:col-span-2"><Label>Keadaan Umum *</Label><Textarea rows={2} value={row.general_condition ?? ""} onChange={(e) => set({ general_condition: e.target.value })} /></div>
        <div><Label>Ekstremitas Atas *</Label><Textarea rows={2} value={row.upper_extremity ?? ""} onChange={(e) => set({ upper_extremity: e.target.value })} /></div>
        <div><Label>Ekstremitas Bawah *</Label><Textarea rows={2} value={row.lower_extremity ?? ""} onChange={(e) => set({ lower_extremity: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Tulang Belakang *</Label><Textarea rows={2} value={row.spine ?? ""} onChange={(e) => set({ spine: e.target.value })} /></div>
        <div><Label>Inguinal / Hernia</Label><Input value={row.inguinal ?? ""} onChange={(e) => set({ inguinal: e.target.value })} /></div>
        <div><Label>Kualifikasi (U)</Label><div className="mt-1"><QualificationSelect value={row.qualification_u} onChange={(v) => set({ qualification_u: v })} /></div></div>
        <div className="md:col-span-2"><Label>Catatan Lain</Label><Textarea rows={2} value={row.other_notes ?? ""} onChange={(e) => set({ other_notes: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Kesimpulan</Label><Textarea rows={3} value={row.conclusion ?? ""} onChange={(e) => set({ conclusion: e.target.value })} /></div>
      </div>
      <p className="text-xs text-slate-500 mt-2">Catatan: kolom "Postur" sengaja dihilangkan dari UI sesuai blangko terbaru.</p>
    </SubteamFormShell>
  );
}