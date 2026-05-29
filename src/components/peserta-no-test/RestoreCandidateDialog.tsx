import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { localDataApi } from "@/lib/localDataApi";
import { logAudit } from "@/lib/audit";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidate: { id: string; full_name: string; temporary_id: string | null; delete_reason: string | null } | null;
  onDone: () => void;
};

export function RestoreCandidateDialog({ open, onOpenChange, candidate, onDone }: Props) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setReason(""); }, [open]);

  async function submit() {
    if (!candidate) return;
    if (reason.trim().length < 3) { toast.error("Alasan restore wajib (min. 3 karakter)"); return; }
    setBusy(true);
    try {
      const beforeSnap = { deleted_at: "set", delete_reason: candidate.delete_reason };
      const { error } = await localDataApi
        .from("candidates")
        .update({ deleted_at: null, deleted_by: null, delete_reason: null } as never)
        .eq("id", candidate.id);
      if (error) throw error;
      await logAudit({
        action: "restore_candidate_without_test_number",
        module: "peserta_tanpa_no_test",
        record_id: candidate.id,
        candidate_id: candidate.id,
        before: beforeSnap,
        after: { restore_reason: reason.trim(), restored_at: new Date().toISOString() },
      });
      toast.success(`${candidate.full_name} dipulihkan`);
      onDone();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memulihkan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" /> Pulihkan Peserta
          </DialogTitle>
          <DialogDescription>
            {candidate?.full_name} {candidate?.temporary_id && <span className="font-mono">({candidate.temporary_id})</span>}
          </DialogDescription>
        </DialogHeader>

        {candidate?.delete_reason && (
          <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs">
            <span className="font-semibold text-amber-900">Alasan dihapus dulu:</span>{" "}
            <span className="text-amber-800">{candidate.delete_reason}</span>
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs">Alasan Restore <span className="text-rose-600">*</span></Label>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Contoh: Salah hapus, peserta hadir hari-H — perlu dipulihkan."
            maxLength={500}
          />
          <p className="text-[11px] text-slate-500">Alasan tersimpan di audit log.</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Batal</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Pulihkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}