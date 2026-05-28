import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, Download, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import {
  buildTemplateBlob,
  parseAndValidate,
  applyBulkUpdate,
  type BulkRow,
  type BulkValidationResult,
} from "@/lib/peserta-no-test/bulk-update";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onApplied?: () => void;
};

export function BulkUpdateDialog({ open, onOpenChange, onApplied }: Props) {
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<BulkValidationResult | null>(null);
  const [fileName, setFileName] = useState<string>("");

  function reset() { setResult(null); setFileName(""); }

  function downloadTemplate() {
    saveAs(buildTemplateBlob(), "template-bulk-no-test.xlsx");
  }

  async function handleFile(f: File) {
    setParsing(true); setResult(null); setFileName(f.name);
    try {
      const r = await parseAndValidate(f);
      setResult(r);
      if (r.totals.error === r.totals.total) {
        toast.error("Semua baris bermasalah, periksa file.");
      } else {
        toast.success(`Validasi selesai: ${r.totals.ok + r.totals.warning} siap diterapkan, ${r.totals.error} error.`);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Gagal parse file");
    } finally {
      setParsing(false);
    }
  }

  async function handleApply() {
    if (!result) return;
    setApplying(true);
    try {
      const { applied, failed, errors } = await applyBulkUpdate(result.rows);
      if (applied > 0) toast.success(`${applied} No Test berhasil di-update`);
      if (failed > 0) toast.error(`${failed} baris gagal:\n${errors.slice(0, 3).join("\n")}`);
      onApplied?.();
      onOpenChange(false);
      reset();
    } finally {
      setApplying(false);
    }
  }

  function downloadErrorReport() {
    if (!result) return;
    const errs = result.rows.filter((r) => r.status === "error");
    const csv = [
      "row,temporary_id,nrp_nip,full_name,birth_date,no_test_baru,catatan,error",
      ...errs.map((r) =>
        [r.rowNumber, r.temporary_id, r.nrp_nip, r.full_name_match, r.birth_date_match, r.no_test_baru, r.catatan, r.message]
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    saveAs(new Blob([csv], { type: "text/csv;charset=utf-8" }), "bulk-no-test-errors.csv");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-[760px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Update No Test via XLSX</DialogTitle>
          <DialogDescription>
            Kolom: <code className="text-xs">temporary_id, nrp_nip, full_name, birth_date, no_test_baru, catatan</code>.
            Matching prioritas: <b>temporary_id → nrp_nip → (full_name + birth_date)</b>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 items-center flex-wrap py-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-1" /> Download Template
          </Button>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <Input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }}
            />
            <Button asChild size="sm" disabled={parsing}>
              <span>
                {parsing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                Pilih File
              </span>
            </Button>
          </label>
          {fileName && <span className="text-xs text-slate-500">{fileName}</span>}
        </div>

        {result && (
          <>
            <div className="flex gap-2 flex-wrap text-xs py-1">
              <Badge variant="outline">Total: {result.totals.total}</Badge>
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                <CheckCircle2 className="h-3 w-3 mr-1" /> OK: {result.totals.ok}
              </Badge>
              <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                <AlertTriangle className="h-3 w-3 mr-1" /> Warning: {result.totals.warning}
              </Badge>
              <Badge className="bg-red-100 text-red-800 border-red-200">
                <XCircle className="h-3 w-3 mr-1" /> Error: {result.totals.error}
              </Badge>
              {result.totals.error > 0 && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={downloadErrorReport}>
                  <Download className="h-3 w-3 mr-1" /> Download error report
                </Button>
              )}
            </div>

            {result.totals.warning > 0 && (
              <Alert className="border-amber-300 bg-amber-50 py-2">
                <AlertDescription className="text-xs text-amber-900">
                  Baris warning akan tetap diterapkan dan menimpa No Test lama. Pastikan ini disengaja.
                </AlertDescription>
              </Alert>
            )}

            <div className="overflow-auto border rounded-lg flex-1">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-left text-slate-600">
                    <th className="p-2 w-12">Row</th>
                    <th className="p-2">Kunci Match</th>
                    <th className="p-2">Peserta</th>
                    <th className="p-2">No Test Baru</th>
                    <th className="p-2">Match</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.rowNumber} className="border-t border-slate-100">
                      <td className="p-2 text-slate-500">{r.rowNumber}</td>
                      <td className="p-2 font-mono text-[11px] leading-tight">
                        {r.temporary_id && <div>TMP: {r.temporary_id}</div>}
                        {r.nrp_nip && <div>NRP: {r.nrp_nip}</div>}
                        {r.full_name_match && (
                          <div>{r.full_name_match}{r.birth_date_match ? ` · ${r.birth_date_match}` : ""}</div>
                        )}
                      </td>
                      <td className="p-2">{r.full_name ?? "—"}</td>
                      <td className="p-2 font-mono">{r.no_test_baru}</td>
                      <td className="p-2">
                        {r.matched_by ? (
                          <Badge variant="outline" className="text-[10px]">{r.matched_by}</Badge>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-2">
                        <StatusBadge row={r} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>Tutup</Button>
          <Button
            onClick={handleApply}
            disabled={!result || applying || (result.totals.ok + result.totals.warning) === 0}
          >
            {applying && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Terapkan {result ? `(${result.totals.ok + result.totals.warning})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ row }: { row: BulkRow }) {
  if (row.status === "ok") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">OK</Badge>;
  if (row.status === "warning") return <Badge className="bg-amber-100 text-amber-800 border-amber-200" title={row.message}>Warning</Badge>;
  return <Badge className="bg-red-100 text-red-800 border-red-200" title={row.message}>{row.message ?? "Error"}</Badge>;
}