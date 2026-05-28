import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { localDataApi } from "@/lib/localDataApi";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Undo2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/use-auth";
import { TableExportMenu } from "@/components/export/TableExportMenu";

export const Route = createFileRoute("/_authenticated/import-history")({
  component: ImportHistoryPage,
});

interface SessionRow {
  id: string;
  file_name: string | null;
  status: string;
  total_rows: number;
  success_rows: number;
  failed_rows: number;
  warning_rows: number;
  skipped_rows: number;
  import_strategy: string;
  created_at: string;
  selection_id: string | null;
  rolled_back_at: string | null;
  rolled_back_reason: string | null;
  candidates_deleted: number;
  exams_deleted: number;
}

function ImportHistoryPage() {
  const { roles } = useAuth();
  const canRollback = roles.some((r) => ["super_admin", "admin"].includes(r));
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [rbTarget, setRbTarget] = useState<SessionRow | null>(null);
  const [rbReason, setRbReason] = useState("");
  const [rbBusy, setRbBusy] = useState(false);

  async function load() {
    localDataApi
      .from("import_sessions")
      .select("id,file_name,status,total_rows,success_rows,failed_rows,warning_rows,skipped_rows,import_strategy,created_at,selection_id,rolled_back_at,rolled_back_reason,candidates_deleted,exams_deleted")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setRows((data || []) as SessionRow[]));
  }

  useEffect(() => { load(); }, []);

  async function doRollback() {
    if (!rbTarget) return;
    if (!rbReason.trim()) { toast.error("Alasan rollback wajib diisi"); return; }
    setRbBusy(true);
    try {
      const { data, error } = await localDataApi.rpc("rollback_import_session" as never, {
        p_session_id: rbTarget.id,
        p_reason: rbReason.trim(),
      } as never);
      if (error) throw error;
      const r = data as any;
      toast.success(`Rollback berhasil: ${r?.candidates_deleted ?? 0} peserta & ${r?.exams_deleted ?? 0} pemeriksaan dihapus`);
      setRbTarget(null);
      setRbReason("");
      await load();
    } catch (e: any) {
      toast.error("Rollback gagal: " + (e?.message ?? "unknown"));
    } finally {
      setRbBusy(false);
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Import History</h1>
          <p className="text-sm text-muted-foreground">Riwayat import workbook RIKKES ke Lovable Cloud Database.</p>
        </div>
        <div className="flex gap-2">
          <TableExportMenu
            data={rows}
            filename="import_history"
            title="Riwayat Import"
            columns={[
              { key: "created_at", label: "Tanggal", accessor: (r) => new Date(r.created_at).toLocaleString("id-ID") },
              { key: "file_name", label: "File" },
              { key: "import_strategy", label: "Strategi" },
              { key: "total_rows", label: "Total" },
              { key: "success_rows", label: "Sukses" },
              { key: "warning_rows", label: "Warning" },
              { key: "failed_rows", label: "Gagal" },
              { key: "skipped_rows", label: "Skipped" },
              { key: "status", label: "Status" },
            ]}
          />
          <Button asChild><Link to="/import-data">+ Import Baru</Link></Button>
        </div>
      </div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-2">Tanggal</th>
              <th className="text-left p-2">File</th>
              <th className="text-left p-2">Strategi</th>
              <th className="text-right p-2">Total</th>
              <th className="text-right p-2">Sukses</th>
              <th className="text-right p-2">Warning</th>
              <th className="text-right p-2">Gagal</th>
              <th className="text-right p-2">Skipped</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{new Date(r.created_at).toLocaleString("id-ID")}</td>
                <td className="p-2">{r.file_name ?? "—"}</td>
                <td className="p-2 text-xs">{r.import_strategy}</td>
                <td className="p-2 text-right">{r.total_rows}</td>
                <td className="p-2 text-right text-green-700">{r.success_rows}</td>
                <td className="p-2 text-right text-amber-700">{r.warning_rows}</td>
                <td className="p-2 text-right text-red-700">{r.failed_rows}</td>
                <td className="p-2 text-right">{r.skipped_rows}</td>
                <td className="p-2">
                  <Badge variant={r.rolled_back_at ? "destructive" : r.status.includes("Error") ? "destructive" : r.status === "Completed" ? "default" : "outline"}>
                    {r.rolled_back_at ? "Rolled Back" : r.status}
                  </Badge>
                  {r.rolled_back_at && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      −{r.candidates_deleted} peserta, −{r.exams_deleted} exam
                    </div>
                  )}
                </td>
                <td className="p-2">
                  {canRollback && !r.rolled_back_at && r.success_rows > 0 ? (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setRbTarget(r); setRbReason(""); }}>
                      <Undo2 className="h-3 w-3 mr-1" /> Rollback
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Belum ada riwayat import.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={!!rbTarget} onOpenChange={(v) => !v && setRbTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Rollback Import Session
            </DialogTitle>
          </DialogHeader>
          {rbTarget && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-amber-900 text-xs">
                Aksi ini akan <b>menghapus {rbTarget.success_rows} peserta</b> beserta seluruh pemeriksaan yang otomatis dibuat dari sesi import ini. Peserta dipindahkan ke status terhapus (soft delete) sehingga dapat dipulihkan kembali oleh admin bila perlu.
              </div>
              <div>
                <div className="text-xs font-medium mb-1">File: <span className="font-normal">{rbTarget.file_name}</span></div>
                <div className="text-xs text-muted-foreground">Tanggal: {new Date(rbTarget.created_at).toLocaleString("id-ID")}</div>
              </div>
              <div>
                <label className="text-xs font-medium">Alasan rollback (wajib)</label>
                <Textarea value={rbReason} onChange={(e) => setRbReason(e.target.value)} rows={3} placeholder="Misal: file salah, ada duplikasi, dst." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRbTarget(null)} disabled={rbBusy}>Batal</Button>
            <Button variant="destructive" onClick={doRollback} disabled={rbBusy || !rbReason.trim()}>
              {rbBusy ? "Memproses..." : "Konfirmasi Rollback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}