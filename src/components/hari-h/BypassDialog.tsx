import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

export function BypassDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reasons: string[];
  onConfirm: (reason: string) => Promise<void> | void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (reason.trim().length < 10) return;
    setBusy(true);
    try {
      await props.onConfirm(reason.trim());
      setReason("");
      props.onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={(v) => { if (!busy) props.onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-700">
            <AlertTriangle className="h-5 w-5" /> Bypass Gating Hari-H
          </DialogTitle>
          <DialogDescription>
            Penunjang awal belum lengkap. Lanjutkan submit dengan alasan resmi (audit log akan tercatat).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
            <div className="font-medium mb-1">Yang belum lengkap:</div>
            <ul className="list-disc list-inside">
              {props.reasons.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </div>
          <div>
            <Label htmlFor="bypass-reason">Alasan bypass (min. 10 karakter)</Label>
            <Textarea
              id="bypass-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: alat EKG sedang kalibrasi, peserta akan kembali sore hari…"
              rows={4}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={busy}>Batal</Button>
          <Button
            onClick={confirm}
            disabled={reason.trim().length < 10 || busy}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {busy ? "Memproses…" : "Konfirmasi Bypass & Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}