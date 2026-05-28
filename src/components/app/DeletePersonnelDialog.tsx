import { useState } from "react";
import { useServerFn } from "@/shims/tanstack-react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { deletePersonnel } from "@/lib/personnel.functions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: {
    id: string;
    full_name: string;
    test_number: string | null;
    temporary_id?: string | null;
    rank: string | null;
    nrp_nip: string | null;
  } | null;
  onDeleted?: () => void;
}

const CONFIRM_WORD = "HAPUS";

export function DeletePersonnelDialog({ open, onOpenChange, candidate, onDeleted }: Props) {
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const runDelete = useServerFn(deletePersonnel);

  function reset() {
    setConfirmText("");
    setReason("");
    setBusy(false);
  }

  function handleOpenChange(next: boolean) {
    if (busy) return;
    if (!next) reset();
    onOpenChange(next);
  }

  async function onConfirm() {
    if (!candidate) return;
    setBusy(true);
    try {
      await runDelete({ data: { candidateId: candidate.id, reason: reason.trim() } });
      toast.success("Data personel dan seluruh data terkait berhasil dihapus.");
      reset();
      onOpenChange(false);
      onDeleted?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal menghapus personel");
      setBusy(false);
    }
  }

  const canConfirm =
    !!candidate && reason.trim().length >= 3 && confirmText === CONFIRM_WORD && !busy;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Hapus Data Personel
          </DialogTitle>
          <DialogDescription>
            Aksi ini bersifat permanen dan tidak dapat dibatalkan.
          </DialogDescription>
        </DialogHeader>

        {candidate && (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm space-y-1">
              <div><span className="text-muted-foreground">Nama:</span> <span className="font-medium">{candidate.full_name}</span></div>
              <div><span className="text-muted-foreground">No Tes / Temp ID:</span> <span className="font-mono">{candidate.test_number ?? candidate.temporary_id ?? "-"}</span></div>
              <div><span className="text-muted-foreground">Pangkat / NRP:</span> {candidate.rank ?? "-"} / {candidate.nrp_nip ?? "-"}</div>
            </div>

            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Peringatan</AlertTitle>
              <AlertDescription>
                Seluruh data terkait personel ini (anamnesa, hasil pemeriksaan, EKG, rontgen, lampiran, notifikasi, riwayat no tes, dll.) akan dihapus permanen.
              </AlertDescription>
            </Alert>

            <div className="space-y-1">
              <Label htmlFor="del-reason">Alasan penghapusan</Label>
              <Textarea
                id="del-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Contoh: duplikat data, salah input, dst."
                maxLength={1000}
                disabled={busy}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="del-confirm">
                Ketik <span className="font-mono font-bold text-destructive">{CONFIRM_WORD}</span> untuk konfirmasi
              </Label>
              <Input
                id="del-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={busy}
                autoComplete="off"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>
            Batal
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={!canConfirm}>
            {busy ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Menghapus data personel...</>
            ) : (
              "Hapus Permanen"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}