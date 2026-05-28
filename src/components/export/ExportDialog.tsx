import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Download, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  exportRikkesWorkbook,
  previewExport,
  type ExportFilters,
  type ExportOptions,
} from "@/lib/export/rikkes-xlsx-export";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectionId: string;
  selectionLabel?: string;
  activeFilters?: ExportFilters;
  selectedCandidateIds?: string[];
}

export function ExportDialog({ open, onOpenChange, selectionId, selectionLabel, activeFilters, selectedCandidateIds }: Props) {
  const [scope, setScope] = useState<"all" | "filtered" | "selected">(selectedCandidateIds?.length ? "selected" : "filtered");
  const [includeHelper, setIncludeHelper] = useState(false);
  const [finalizedOnly, setFinalizedOnly] = useState(false);
  const [format, setFormat] = useState<"full" | "aplikasi" | "laporan" | "resume">("full");
  const [fileName, setFileName] = useState("");
  const [disdikau, setDisdikau] = useState<"all" | "ms" | "tms" | "finalized">("all");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ pct: 0, label: "" });
  const [done, setDone] = useState<{ fileName: string; rows: number; sheets: number; counts: any } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ total: number; MS: number; TMS: number; TH: number; incomplete: number; noTestCount: number } | null>(null);
  const [requireFinalNoTest, setRequireFinalNoTest] = useState(false);

  function buildOpts(): ExportOptions {
    const filters: ExportFilters = scope === "filtered" ? { ...(activeFilters ?? {}) } : {};
    if (finalizedOnly) filters.finalized_only = true;
    return {
      selectionId,
      filters,
      includeHelperColumns: includeHelper,
      selectedCandidateIds: scope === "selected" ? selectedCandidateIds : undefined,
      format,
      disdikauFilter: disdikau,
      fileName: fileName || undefined,
      requireFinalNoTest,
    };
  }

  useEffect(() => {
    if (!open || !selectionId) return;
    setDone(null); setErr(null); setProgress({ pct: 0, label: "" });
    previewExport(buildOpts()).then(setPreview).catch(() => setPreview(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectionId, scope, finalizedOnly, requireFinalNoTest]);

  async function generate() {
    setBusy(true); setErr(null); setDone(null);
    try {
      const result = await exportRikkesWorkbook({
        ...buildOpts(),
        onProgress: (label, pct) => setProgress({ label, pct }),
      });
      setDone({ fileName: result.fileName, rows: result.rowCount, sheets: result.sheetCount, counts: result.counts });
      toast.success(`Workbook diunduh: ${result.fileName}`);
    } catch (e: any) {
      setErr(e?.message ?? "Gagal export");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export XLSX — {selectionLabel ?? "Seleksi"}</DialogTitle>
        </DialogHeader>

        {/* Preview ringkas */}
        {preview && (
          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            <div className="rounded border p-2"><div className="text-muted-foreground">Total</div><div className="font-bold text-base">{preview.total}</div></div>
            <div className="rounded border p-2 bg-emerald-50"><div>MS</div><div className="font-bold text-base">{preview.MS}</div></div>
            <div className="rounded border p-2 bg-rose-50"><div>TMS</div><div className="font-bold text-base">{preview.TMS}</div></div>
            <div className="rounded border p-2 bg-slate-100"><div>TH</div><div className="font-bold text-base">{preview.TH}</div></div>
            <div className="rounded border p-2 bg-amber-50"><div>Belum</div><div className="font-bold text-base">{preview.incomplete}</div></div>
          </div>
        )}
        {preview && preview.total > 200 && (
          <div className="text-xs flex gap-2 items-center text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            <AlertTriangle className="h-4 w-4" /> Export mungkin membutuhkan waktu lebih lama.
          </div>
        )}
        {preview && preview.incomplete > 0 && (
          <div className="text-xs flex gap-2 items-center text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            <AlertTriangle className="h-4 w-4" /> Ada peserta dengan data belum lengkap. Export tetap dilanjutkan.
          </div>
        )}
        {preview && preview.noTestCount > 0 && (
          <div className={`text-xs flex gap-2 items-start border rounded p-2 ${
            requireFinalNoTest ? "text-rose-800 bg-rose-50 border-rose-300" : "text-amber-800 bg-amber-50 border-amber-200"
          }`}>
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">
                {preview.noTestCount} peserta masih TANPA No Test final (temporary_id / kosong).
              </div>
              <div className="opacity-90">
                {requireFinalNoTest
                  ? "Mode 'Tolak jika ada No Test belum final' aktif — export akan ditolak sampai semua peserta punya No Test final."
                  : "PDF akan menampilkan watermark 'DRAFT - NO TEST BELUM ADA' untuk peserta tersebut."}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Cakupan</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {[
                { v: "all", l: "Semua peserta" },
                { v: "filtered", l: "Hasil filter aktif" },
                { v: "selected", l: `Peserta terpilih${selectedCandidateIds?.length ? ` (${selectedCandidateIds.length})` : ""}`, disabled: !selectedCandidateIds?.length },
              ].map((o) => (
                <Button key={o.v} type="button" size="sm" variant={scope === o.v ? "default" : "outline"}
                  disabled={o.disabled} onClick={() => setScope(o.v as any)}>{o.l}</Button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Format Workbook</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {[
                { v: "full", l: "Full workbook (10 sheet)" },
                { v: "aplikasi", l: "Rekap APLIKASI saja" },
                { v: "laporan", l: "Laporan saja" },
                { v: "resume", l: "Resume Casis saja" },
              ].map((o) => (
                <Button key={o.v} type="button" size="sm" variant={format === o.v ? "default" : "outline"}
                  onClick={() => setFormat(o.v as any)}>{o.l}</Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={includeHelper} onCheckedChange={(v) => setIncludeHelper(!!v)} />
              Tampilkan helper columns
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={finalizedOnly} onCheckedChange={(v) => setFinalizedOnly(!!v)} />
              Hanya exam Finalized
            </label>
            <label className="flex items-center gap-2 text-sm col-span-2">
              <Checkbox checked={requireFinalNoTest} onCheckedChange={(v) => setRequireFinalNoTest(!!v)} />
              <span>
                Tolak export jika ada peserta tanpa <strong>No Test final</strong>{" "}
                <span className="text-xs text-muted-foreground">(untuk export final/resmi)</span>
              </span>
            </label>
          </div>

          <div>
            <Label className="text-xs">Filter khusus DISDIKAU</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {[
                { v: "all", l: "Semua" },
                { v: "ms", l: "Hanya MS" },
                { v: "tms", l: "Hanya TMS" },
                { v: "finalized", l: "Finalized" },
              ].map((o) => (
                <Button key={o.v} type="button" size="sm" variant={disdikau === o.v ? "default" : "outline"}
                  onClick={() => setDisdikau(o.v as any)}>{o.l}</Button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="fname" className="text-xs">Nama File (opsional)</Label>
            <Input id="fname" placeholder="Otomatis: RIKKES_[NAMA]_[TAHUN]_[TGL].xlsx" value={fileName} onChange={(e) => setFileName(e.target.value)} />
          </div>

          {busy && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs"><span>{progress.label}</span><span>{progress.pct}%</span></div>
              <Progress value={progress.pct} />
            </div>
          )}
          {done && (
            <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm space-y-1">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                <CheckCircle2 className="h-4 w-4" /> Export berhasil
              </div>
              <div className="text-xs">File: <span className="font-mono">{done.fileName}</span></div>
              <div className="text-xs">{done.rows} peserta · {done.sheets} sheet · MS {done.counts.MS} · TMS {done.counts.TMS} · TH {done.counts.TH} · Belum {done.counts.incomplete}</div>
            </div>
          )}
          {err && (
            <div className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
              <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Gagal export</div>
              <div className="text-xs mt-1">{err}</div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Tutup</Button>
          <Button onClick={generate} disabled={busy || !selectionId || (preview?.total ?? 0) === 0}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {err ? "Coba Lagi" : "Generate XLSX"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}