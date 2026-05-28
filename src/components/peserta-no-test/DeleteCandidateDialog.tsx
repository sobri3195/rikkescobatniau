import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidate: { id: string; full_name: string; temporary_id: string | null } | null;
  onDone: () => void;
};

export function DeleteCandidateDialog({ open, onOpenChange, candidate, onDone }: Props) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function softDelete() {
    if (!candidate) return;
    if (!reason.trim()) return toast.error("Alasan wajib diisi");
    setBusy(true);
    try {
      const { error } = await supabase.rpc(
        "soft_delete_candidate_cascade" as never,
        { _candidate_id: candidate.id, _reason: reason.trim() } as never,
      );
      if (error) throw error;
      await logAudit({
        action: "soft_delete_candidate_without_test_number",
        module: "peserta_tanpa_no_test",
        record_id: candidate.id,
        candidate_id: candidate.id,
        after: { delete_reason: reason.trim() },
      });
      toast.success("Peserta dihapus; data Hari-H/RIKKES terkait juga dibersihkan");
      setReason("");
      onDone();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal menghapus";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="h-4 w-4" /> Hapus Peserta
          </DialogTitle>
        </DialogHeader>
        {candidate && (
          <div className="space-y-3">
            <div className="text-sm text-slate-700">
              <div className="font-medium">{candidate.full_name}</div>
              {candidate.temporary_id && (
                <div className="text-xs text-slate-500 font-mono">{candidate.temporary_id}</div>
              )}
            </div>
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              Peserta akan ditandai terhapus. Seluruh data Hari-H / RIKKES terkait (anamnesa, EKG, rontgen, lab, dll.) akan ikut dibersihkan. Identitas dasar &amp; audit log tetap disimpan.
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Alasan penghapusan *</Label>
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Mis. duplikat, salah input, dll." />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Batal</Button>
          <Button variant="destructive" onClick={softDelete} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Hapus
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}