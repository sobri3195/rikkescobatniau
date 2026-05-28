import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/local-supabase-shim";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, FileSpreadsheet, FileText, FileArchive, Loader2 } from "lucide-react";
import { ExportDialog } from "@/components/export/ExportDialog";
import { TableExportMenu } from "@/components/export/TableExportMenu";
import { exportAttachmentsZip } from "@/lib/export/attachments-zip";
import { toast } from "sonner";
import { Can } from "@/components/auth/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export const Route = createFileRoute("/_authenticated/exports")({
  component: ExportsPage,
});

type Sel = { id: string; name: string; year_label: string };
type Hist = {
  id: string;
  selection_id: string | null;
  file_name: string | null;
  file_url: string | null;
  export_type: string;
  document_type: string;
  filter_json: any;
  exported_at: string;
  exported_by: string | null;
};

function ExportsPage() {
  const [sels, setSels] = useState<Sel[]>([]);
  const [selId, setSelId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<Hist[]>([]);
  const [fSelId, setFSelId] = useState<string>("all");
  const [fType, setFType] = useState<string>("all");
  const [zipBusy, setZipBusy] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ d: number; t: number } | null>(null);

  async function downloadZip() {
    if (!selId) return;
    setZipBusy(true);
    setZipProgress({ d: 0, t: 0 });
    try {
      const sel = sels.find((s) => s.id === selId);
      const res = await exportAttachmentsZip({
        selectionId: selId,
        zipName: `lampiran-${(sel?.name || "seleksi").replace(/\s+/g, "_")}-${sel?.year_label || ""}.zip`,
        onProgress: (d, t) => setZipProgress({ d, t }),
      });
      toast.success(`Berhasil unduh ${res.succeeded}/${res.total} lampiran`);
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal export ZIP");
    } finally {
      setZipBusy(false);
      setZipProgress(null);
    }
  }

  async function loadHistory() {
    const { data } = await supabase
      .from("document_exports")
      .select("*")
      .order("exported_at", { ascending: false })
      .limit(100);
    setHistory((data ?? []) as Hist[]);
  }

  useEffect(() => {
    supabase.from("selections").select("id,name,year_label").order("created_at", { ascending: false }).then(({ data }) => {
      setSels((data ?? []) as Sel[]);
      if (data?.[0]) setSelId(data[0].id);
    });
    loadHistory();
  }, []);

  const filteredHist = history.filter((h) => {
    if (fSelId !== "all" && h.selection_id !== fSelId) return false;
    if (fType !== "all" && h.document_type !== fType) return false;
    return true;
  });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Export Center</h1>
        <p className="text-sm text-muted-foreground">Generate workbook RIKKES multi-sheet dan lihat riwayat export.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Export XLSX</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={selId} onChange={(e) => setSelId(e.target.value)}>
              {sels.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.year_label}</option>)}
              {sels.length === 0 && <option value="">Tidak ada seleksi</option>}
            </select>
            <Can permission={PERMISSIONS.EXPORT_XLSX} fallback={<p className="text-xs text-muted-foreground">Anda tidak punya izin export XLSX.</p>}>
              <Button onClick={() => setOpen(true)} disabled={!selId}>
                <Download className="h-4 w-4 mr-2" /> Buka Dialog Export
              </Button>
            </Can>
            <p className="text-xs text-muted-foreground">
              Sheet: Absen perkelas, APLIKASI, Laporan 1, DIRBINDUKKES, PARADE, RAKOR, PRA PANTUKHIR, DISMINPERSAU, DISDIKAU, RESUME CASIS.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Export PDF</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Export PDF terjadwal untuk fase berikutnya.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileArchive className="h-4 w-4" /> Export Lampiran (ZIP)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Unduh semua lampiran EKG &amp; Rontgen peserta pada seleksi terpilih, terorganisir per peserta.</p>
            <Can permission={PERMISSIONS.EXPORT_XLSX} fallback={<p className="text-xs text-muted-foreground">Anda tidak punya izin export lampiran.</p>}>
              <Button onClick={downloadZip} disabled={!selId || zipBusy}>
                {zipBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileArchive className="h-4 w-4 mr-2" />}
                {zipBusy ? `Mengunduh… ${zipProgress?.d ?? 0}/${zipProgress?.t ?? 0}` : "Unduh ZIP Lampiran"}
              </Button>
            </Can>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base">Riwayat Export</CardTitle>
            <TableExportMenu
              data={filteredHist}
              filename="riwayat_export"
              title="Riwayat Export"
              columns={[
                { key: "exported_at", label: "Tanggal", accessor: (h) => new Date(h.exported_at).toLocaleString("id-ID") },
                { key: "file_name", label: "Nama File" },
                { key: "export_type", label: "Jenis" },
                { key: "selection_id", label: "Seleksi", accessor: (h) => {
                  const s = sels.find((x) => x.id === h.selection_id);
                  return s ? `${s.name} ${s.year_label}` : "";
                } },
                { key: "row_count", label: "Peserta", accessor: (h) => (h.filter_json as any)?.row_count ?? "" },
                { key: "sheet_count", label: "Sheet", accessor: (h) => (h.filter_json as any)?.sheet_count ?? "" },
                { key: "file_url", label: "URL" },
              ]}
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <select className="h-8 rounded border bg-background px-2 text-xs" value={fSelId} onChange={(e) => setFSelId(e.target.value)}>
              <option value="all">Semua Seleksi</option>
              {sels.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className="h-8 rounded border bg-background px-2 text-xs" value={fType} onChange={(e) => setFType(e.target.value)}>
              <option value="all">Semua Jenis</option>
              <option value="RIKKES_MULTI_SHEET">RIKKES Multi-Sheet</option>
            </select>
            <Button size="sm" variant="ghost" onClick={loadHistory}>Refresh</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase">
                <tr>
                  <th className="text-left p-3">Tanggal</th>
                  <th className="text-left p-3">Nama File</th>
                  <th className="text-left p-3">Jenis</th>
                  <th className="text-left p-3">Seleksi</th>
                  <th className="text-left p-3">Peserta</th>
                  <th className="text-left p-3">Sheet</th>
                  <th className="text-right p-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredHist.map((h) => {
                  const sel = sels.find((s) => s.id === h.selection_id);
                  const fj = (h.filter_json ?? {}) as any;
                  return (
                    <tr key={h.id} className="border-t border-border">
                      <td className="p-3 text-xs">{new Date(h.exported_at).toLocaleString("id-ID")}</td>
                      <td className="p-3 font-mono text-xs">{h.file_name ?? "-"}</td>
                      <td className="p-3 text-xs"><Badge variant="outline">{h.export_type}</Badge></td>
                      <td className="p-3 text-xs">{sel ? `${sel.name} ${sel.year_label}` : "-"}</td>
                      <td className="p-3 text-xs">{fj.row_count ?? "-"}</td>
                      <td className="p-3 text-xs">{fj.sheet_count ?? "-"}</td>
                      <td className="p-3 text-right">
                        {h.file_url ? (
                          <a href={h.file_url} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline"><Download className="h-3 w-3 mr-1" /> Unduh</Button>
                          </a>
                        ) : <span className="text-xs text-muted-foreground">Tidak tersimpan</span>}
                      </td>
                    </tr>
                  );
                })}
                {filteredHist.length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-sm text-muted-foreground">Belum ada riwayat export.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {selId && (
        <ExportDialog
          open={open}
          onOpenChange={(v) => { setOpen(v); if (!v) loadHistory(); }}
          selectionId={selId}
          selectionLabel={sels.find((s) => s.id === selId)?.name}
        />
      )}
    </div>
  );
}