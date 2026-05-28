import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";

type Target = { id: string; full_name: string; temporary_id: string | null; test_number: string | null };

export function BulkAssignSeriesDialog({
  open, onOpenChange, targets, onDone,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  targets: Target[];
  onDone: () => void | Promise<void>;
}) {
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [start, setStart] = useState("1");
  const [pad, setPad] = useState("4");
  const [step, setStep] = useState("1");
  const [busy, setBusy] = useState(false);

  const startNum = parseInt(start, 10);
  const stepNum = parseInt(step, 10);
  const padNum = Math.max(0, parseInt(pad, 10) || 0);

  const preview = useMemo(() => {
    if (!Number.isFinite(startNum) || !Number.isFinite(stepNum) || stepNum < 1) return [];
    return targets.slice(0, 5).map((t, i) => {
      const num = (startNum + i * stepNum).toString().padStart(padNum, "0");
      return { ...t, new_tn: `${prefix}${num}${suffix}` };
    });
  }, [targets, prefix, suffix, startNum, stepNum, padNum]);

  async function submit() {
    if (targets.length === 0) { toast.error("Tidak ada peserta terpilih"); return; }
    if (!Number.isFinite(startNum) || startNum < 0) { toast.error("Nomor mulai tidak valid"); return; }
    if (!Number.isFinite(stepNum) || stepNum < 1) { toast.error("Step harus ≥ 1"); return; }
    if (!prefix && !suffix && padNum === 0) {
      toast.error("Minimal isi prefix, suffix, atau padding agar No Test bermakna");
      return;
    }

    setBusy(true);
    try {
      const updates = targets.map((t, i) => {
        const num = (startNum + i * stepNum).toString().padStart(padNum, "0");
        return { id: t.id, tn: `${prefix}${num}${suffix}` };
      });
      const tns = updates.map((u) => u.tn);
      const dupInSet = tns.filter((tn, idx) => tns.indexOf(tn) !== idx);
      if (dupInSet.length) {
        toast.error(`Konfigurasi menghasilkan No Test duplikat: ${dupInSet[0]}`);
        setBusy(false); return;
      }
      const { data: existing } = await supabase
        .from("candidates")
        .select("test_number,id")
        .in("test_number", tns);
      const conflictIds = new Set(updates.map((u) => u.id));
      const conflicts = (existing ?? []).filter((r: any) => !conflictIds.has(r.id)).map((r: any) => r.test_number);
      if (conflicts.length) {
        toast.error(`Konflik dengan No Test yang sudah ada: ${conflicts.slice(0, 3).join(", ")}${conflicts.length > 3 ? "…" : ""}`);
        setBusy(false); return;
      }

      let ok = 0; let fail = 0;
      for (const u of updates) {
        const { error } = await supabase
          .from("candidates")
          .update({ test_number: u.tn, test_number_status: "Final", test_number_assigned_at: new Date().toISOString() })
          .eq("id", u.id);
        if (error) { fail++; continue; }
        ok++;
        await logAudit({
          action: "bulk_assign_series",
          module: "Peserta Tanpa No Test",
          record_id: u.id,
          candidate_id: u.id,
          after: { test_number: u.tn, prefix, suffix, padding: padNum, step: stepNum },
        });
      }
      toast.success(`${ok} No Test berhasil di-assign${fail ? `, ${fail} gagal` : ""}`);
      await onDone();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal bulk assign");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(b) => !busy && onOpenChange(b)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Assign Seri No Test</DialogTitle>
          <DialogDescription>
            Memberi No Test final secara berurutan untuk {targets.length} peserta terpilih.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Prefix</Label>
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="mis. 2026-" />
          </div>
          <div className="space-y-1.5">
            <Label>Suffix</Label>
            <Input value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="opsional" />
          </div>
          <div className="space-y-1.5">
            <Label>Mulai dari</Label>
            <Input type="number" min={0} value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Step</Label>
            <Input type="number" min={1} value={step} onChange={(e) => setStep(e.target.value)} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Padding (jumlah digit nol)</Label>
            <Input type="number" min={0} max={10} value={pad} onChange={(e) => setPad(e.target.value)} />
          </div>
        </div>

        <div className="rounded-md border bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-600 mb-2">Pratinjau (5 pertama)</div>
          {preview.length === 0 ? (
            <p className="text-xs text-slate-500">—</p>
          ) : (
            <ul className="text-xs space-y-0.5 font-mono">
              {preview.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span className="truncate text-slate-700">{p.full_name}</span>
                  <span className="text-slate-500">{p.temporary_id ?? p.test_number ?? "—"} → <strong className="text-emerald-700">{p.new_tn}</strong></span>
                </li>
              ))}
              {targets.length > 5 && <li className="text-slate-400">… +{targets.length - 5} peserta lainnya</li>}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Batal</Button>
          <Button onClick={submit} disabled={busy || targets.length === 0}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Assign {targets.length} No Test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}