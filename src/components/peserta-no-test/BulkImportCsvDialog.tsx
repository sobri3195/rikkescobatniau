import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, Download, AlertTriangle, CheckCircle2, XCircle, Info } from "lucide-react";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { listActiveSelections } from "@/lib/selectionService";
import {
  buildCsvTemplateBlob,
  parseCsvAndValidate,
  applyCsvImport,
  type CsvRow,
  type CsvValidationResult,
} from "@/lib/peserta-no-test/bulk-import-csv";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported?: () => void;
};

type Selection = { id: string; name: string; year_label?: string | null };

export function BulkImportCsvDialog({ open, onOpenChange, onImported }: Props) {
  const [selections, setSelections] = useState<Selection[]>([]);
  const [selectionId, setSelectionId] = useState("");
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<CsvValidationResult | null>(null);
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    if (!open) return;
    listActiveSelections().then((data) => {
      const list = (data ?? []) as Selection[];
      setSelections(list);
      setSelectionId((prev) => prev || (list.length === 1 ? list[0]?.id ?? "" : list[0]?.id ?? ""));
    });
  }, [open]);

  function reset() { setResult(null); setFileName(""); }

  function downloadTemplate() {
    saveAs(buildCsvTemplateBlob(), "template-import-peserta-tanpa-no-test.csv");
  }

  async function handleFile(f: File) {
    if (!selectionId) { toast.error("Pilih seleksi terlebih dahulu"); return; }
    setParsing(true); setResult(null); setFileName(f.name);
    try {
      const r = await parseCsvAndValidate(f, selectionId);
      setResult(r);
      if (r.totals.total === 0) toast.error("File kosong");
      else if (r.totals.error === r.totals.total) toast.error("Semua baris error, periksa file");
      else toast.success(`${r.totals.ok + r.totals.warning} baris siap di-import, ${r.totals.error} error`);
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal parse file");
    } finally {
      setParsing(false);
    }
  }

  async function handleApply() {
    if (!result || !selectionId) return;
    setApplying(true);
    try {
      const { inserted, failed, errors } = await applyCsvImport(result.rows, selectionId);
      if (inserted > 0) toast.success(`${inserted} peserta berhasil di-import`);
      if (failed > 0) toast.error(`${failed} gagal: ${errors.slice(0, 2).join("; ")}`);
      onImported?.();
      onOpenChange(false);
      reset();
    } finally {
      setApplying(false);
    }
  }

  function downloadErrors() {
    if (!result) return;
    const errs = result.rows.filter((r) => r.status === "error");
    const csv = [
      "row,full_name,test_number,error",
      ...errs.map((r) => [r.rowNumber, r.full_name, r.test_number, r.message]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    saveAs(new Blob([csv], { type: "text/csv;charset=utf-8" }), "import-errors.csv");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-[820px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Import Peserta Tanpa No Test (CSV)</DialogTitle>
          <DialogDescription>
            Upload daftar peserta dari panitia seleksi. Sistem otomatis membuat <span className="font-mono">TMP-YYYYMMDD-NNNN</span> jika kolom <code>test_number</code> kosong.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Seleksi Tujuan <span className="text-rose-600">*</span></Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={selectionId}
                onChange={(e) => { setSelectionId(e.target.value); reset(); }}
              >
                <option value="">— Pilih Seleksi —</option>
                {selections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.year_label ? ` — ${s.year_label}` : ""}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">File CSV</Label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-1" /> Template
                </Button>
                <label className="cursor-pointer">
                  <Input
                    type="file" accept=".csv,text/csv" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }}
                  />
                  <Button asChild size="sm" disabled={parsing || !selectionId}>
                    <span>
                      {parsing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                      Pilih File
                    </span>
                  </Button>
                </label>
              </div>
              {fileName && <p className="text-[11px] text-slate-500">{fileName}</p>}
            </div>
          </div>

          <Alert className="border-sky-200 bg-sky-50 py-2">
            <Info className="h-4 w-4 text-sky-700" />
            <AlertDescription className="text-xs text-sky-900">
              Kolom wajib: <code>full_name</code>. Opsional: gender (L/P), rank, nrp_nip, unit_position, pok_korp, panda, group_name, birth_place, birth_date (YYYY-MM-DD), phone, address, test_number, registration_notes.
            </AlertDescription>
          </Alert>
        </div>

        {result && (
          <>
            <div className="flex gap-2 flex-wrap text-xs">
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
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={downloadErrors}>
                  <Download className="h-3 w-3 mr-1" /> Error report
                </Button>
              )}
            </div>

            <div className="overflow-auto border rounded-lg flex-1">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-left text-slate-600">
                    <th className="p-2 w-12">Row</th>
                    <th className="p-2">Nama</th>
                    <th className="p-2">Gender</th>
                    <th className="p-2">NRP/NIP</th>
                    <th className="p-2">No Test</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.rowNumber} className="border-t border-slate-100">
                      <td className="p-2 text-slate-500">{r.rowNumber}</td>
                      <td className="p-2">{r.full_name || <span className="text-slate-400">—</span>}</td>
                      <td className="p-2">{r.gender}</td>
                      <td className="p-2 font-mono">{r.nrp_nip ?? "—"}</td>
                      <td className="p-2 font-mono">{r.test_number ?? <span className="text-slate-400">auto TMP</span>}</td>
                      <td className="p-2"><StatusBadge row={r} /></td>
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
            Import {result ? `(${result.totals.ok + result.totals.warning})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ row }: { row: CsvRow }) {
  if (row.status === "ok") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">OK</Badge>;
  if (row.status === "warning") return <Badge className="bg-amber-100 text-amber-800 border-amber-200" title={row.message}>Warning</Badge>;
  return <Badge className="bg-red-100 text-red-800 border-red-200" title={row.message}>{row.message ?? "Error"}</Badge>;
}