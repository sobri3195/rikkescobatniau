import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { localDataApi } from "@/lib/localDataApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, RotateCcw, RefreshCw, Search } from "lucide-react";
import { RestoreCandidateDialog } from "@/components/peserta-no-test/RestoreCandidateDialog";
import { useAuth } from "@/lib/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/recovery")({
  component: RecoveryPage,
});

type Row = {
  id: string;
  full_name: string;
  nrp_nip: string | null;
  test_number: string | null;
  temporary_id: string | null;
  selection_id: string | null;
  deleted_at: string | null;
  delete_reason: string | null;
  deleted_by: string | null;
};

function fmt(d: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("id-ID"); } catch { return d; }
}

function RecoveryPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("super_admin") || roles.includes("admin");
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await localDataApi
      .from("candidates")
      .select("id, full_name, nrp_nip, test_number, temporary_id, selection_id, deleted_at, delete_reason, deleted_by")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(500);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as never as Row[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.full_name, r.nrp_nip, r.test_number, r.temporary_id, r.delete_reason]
        .some((v) => (v ?? "").toLowerCase().includes(s))
    );
  }, [rows, q]);

  if (!isAdmin) {
    return (
      <div className="p-8">
        <Card><CardContent className="p-6 text-sm text-muted-foreground">
          Hanya Admin / Super Admin yang bisa mengakses Recovery.
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trash2 className="h-6 w-6" /> Recovery Peserta
          </h1>
          <p className="text-sm text-muted-foreground">
            Daftar peserta yang sudah dihapus (soft-delete). Pilih peserta untuk dipulihkan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8 w-64" placeholder="Cari nama / no test / alasan…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Peserta Terhapus ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="text-left p-2">Nama</th>
                  <th className="text-left p-2">No Test / Temp ID</th>
                  <th className="text-left p-2">NRP/NIP</th>
                  <th className="text-left p-2">Dihapus</th>
                  <th className="text-left p-2">Alasan</th>
                  <th className="text-right p-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-accent/40">
                    <td className="p-2 font-medium">{r.full_name}</td>
                    <td className="p-2">
                      {r.test_number ? (
                        <Badge variant="outline">{r.test_number}</Badge>
                      ) : r.temporary_id ? (
                        <Badge variant="outline" className="font-mono">{r.temporary_id}</Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-2">{r.nrp_nip ?? "—"}</td>
                    <td className="p-2 text-xs text-muted-foreground">{fmt(r.deleted_at)}</td>
                    <td className="p-2 text-xs max-w-md truncate" title={r.delete_reason ?? ""}>{r.delete_reason ?? "—"}</td>
                    <td className="p-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => setTarget(r)}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Pulihkan
                      </Button>
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                    Tidak ada peserta terhapus.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <RestoreCandidateDialog
        open={!!target}
        onOpenChange={(v) => !v && setTarget(null)}
        candidate={target ? { id: target.id, full_name: target.full_name, temporary_id: target.temporary_id, delete_reason: target.delete_reason } : null}
        onDone={load}
      />
    </div>
  );
}