import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { findDuplicateTestNumberLocal, updateCandidateLocal } from "@/lib/services/candidateService";

type Candidate = {
  id: string;
  full_name: string;
  temporary_id?: string | null;
  test_number?: string | null;
  selection_id: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidate: Candidate | null;
  onSaved?: () => void;
};

export function AssignTestNumberDialog({ open, onOpenChange, candidate, onSaved }: Props) {
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dupWarning, setDupWarning] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(candidate?.test_number ?? "");
      setNotes("");
      setConfirmed(false);
      setDupWarning(null);
    }
  }, [open, candidate]);

  useEffect(() => {
    if (!open || !candidate) return;
    const v = value.trim();
    if (!v || v.startsWith("TMP-")) { setDupWarning(null); return; }
    setChecking(true);
    const t = setTimeout(() => {
      const duplicate = findDuplicateTestNumberLocal({
        selectionId: candidate.selection_id,
        testNumber: v,
        excludeCandidateId: candidate.id,
      });
      setDupWarning(duplicate ? `Nomor test sudah dipakai oleh ${duplicate.full_name ?? "peserta lain"}.` : null);
      setChecking(false);
    }, 200);
    return () => { clearTimeout(t); setChecking(false); };
  }, [value, open, candidate]);

  async function handleSubmit() {
    if (!candidate) return;
    const v = value.trim();
    if (!v) { toast.error("No Test tidak boleh kosong"); return; }
    if (v.startsWith("TMP-")) { toast.error("No Test final tidak boleh diawali TMP-"); return; }
    if (dupWarning) { toast.error("Selesaikan konflik duplikat dulu"); return; }
    if (!confirmed) { toast.error("Konfirmasi dulu bahwa data sudah benar"); return; }

    setSaving(true);
    try {
      const before = { test_number: candidate.test_number, temporary_id: candidate.temporary_id };
      updateCandidateLocal(candidate.id, {
        test_number: v,
        test_number_status: "assigned",
        no_test_missing: false,
        test_number_assigned_at: new Date().toISOString(),
        test_number_assigned_by: "local_user",
        test_number_notes: notes.trim() || null,
      });
      await logAudit({
        action: "set_test_number",
        module: "candidates",
        record_id: candidate.id,
        candidate_id: candidate.id,
        before,
        after: { test_number: v, notes: notes.trim() || null },
      });
      toast.success(`No Test ${v} disimpan untuk ${candidate.full_name}`);
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Isi Nomor Test</DialogTitle>
          <DialogDescription>
            Peserta: <span className="font-medium text-foreground">{candidate?.full_name}</span>
            {candidate?.temporary_id && (
              <> · <span className="font-mono text-xs">{candidate.temporary_id}</span></>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nomor Test Final</Label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Mis: T-2026-0001"
              autoFocus
            />
            {checking && <p className="text-xs text-slate-500"><Loader2 className="h-3 w-3 inline animate-spin mr-1" />Memeriksa duplikat…</p>}
            {dupWarning && (
              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">{dupWarning}</AlertDescription>
              </Alert>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Catatan (opsional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Mis: Diterima susulan dari Panda Jawa Barat"
              rows={2}
            />
          </div>

          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <Checkbox checked={confirmed} onCheckedChange={(c) => setConfirmed(!!c)} className="mt-0.5" />
            <span className="text-slate-700">Saya sudah memverifikasi nomor ini sesuai data resmi dan tidak duplikat.</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
          <Button onClick={handleSubmit} disabled={saving || !confirmed || !!dupWarning || !value.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}