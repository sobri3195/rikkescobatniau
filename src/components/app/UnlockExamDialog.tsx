import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Unlock, AlertTriangle } from "lucide-react";
import { localDataApi } from "@/lib/localDataApi";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  exam: any;
  candidate: any;
  onUnlocked?: () => void;
}

export function UnlockExamDialog({
  open,
  onOpenChange,
  exam,
  candidate,
  onUnlocked,
}: Props) {
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState<"full" | "section">("full");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const canSubmit = reason.trim().length >= 8 && confirmed;

  async function doUnlock() {
    if (!canSubmit || !exam) return;
    setBusy(true);
    try {
      const { data: u } = await localDataApi.auth.getUser();
      const { error: e1 } = await localDataApi
        .from("exams")
        .update({
          exam_status: "Revision Needed",
          unlocked_by: u.user?.id,
          unlocked_at: new Date().toISOString(),
          unlock_reason: reason,
        })
        .eq("id", exam.id);
      if (e1) throw e1;

      if (scope === "full") {
        await localDataApi
          .from("exam_sections")
          .update({
            section_status: "Revision",
            revision_reason: reason,
            revision_requested_by: u.user?.id,
            revision_requested_at: new Date().toISOString(),
          })
          .eq("exam_id", exam.id);
      }

      const { error: e3 } = await localDataApi.from("unlock_logs").insert({
        exam_id: exam.id,
        candidate_id: candidate?.id,
        unlocked_by: u.user!.id,
        unlock_scope: scope,
        reason,
        status: "open",
      });
      if (e3) throw e3;

      await logAudit({
        action: "unlock_exam",
        module: "exams",
        record_id: exam.id,
        candidate_id: candidate?.id,
        exam_id: exam.id,
        after: { reason, scope },
      });
      toast.success("Dokumen pemeriksaan dibuka kembali");
      setReason("");
      setConfirmed(false);
      onOpenChange(false);
      onUnlocked?.();
    } catch (err: any) {
      toast.error("Gagal unlock: " + (err?.message ?? "unknown"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <Unlock className="h-5 w-5" /> Unlock Finalized Exam
          </DialogTitle>
          <DialogDescription>
            Hanya Super Admin yang dapat membuka kembali pemeriksaan yang sudah difinalisasi.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Tindakan ini akan tercatat permanen dalam audit log dan riwayat unlock.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label>Alasan Unlock</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tuliskan alasan tertulis (min. 8 karakter)…"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Lingkup Unlock</Label>
          <RadioGroup value={scope} onValueChange={(v) => setScope(v as any)}>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="full" /> Unlock seluruh exam (semua section → Revision)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="section" /> Unlock exam saja (section dibuka manual)
            </label>
          </RadioGroup>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={confirmed} onCheckedChange={(b) => setConfirmed(b === true)} />
          <span>
            Saya memahami bahwa membuka kunci data finalized akan tercatat dalam audit log.
          </span>
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Batal
          </Button>
          <Button variant="destructive" onClick={doUnlock} disabled={!canSubmit || busy}>
            {busy ? "Memproses…" : "Unlock Sekarang"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}