import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Shield, FilterX, RefreshCw, Loader2 } from "lucide-react";
import { TableExportMenu } from "@/components/export/TableExportMenu";

export const Route = createFileRoute("/_authenticated/audit")({
  component: AuditPage,
});

type AuditRow = {
  id: string;
  action: string;
  module: string | null;
  record_id: string | null;
  candidate_id: string | null;
  user_id: string | null;
  before_data: unknown;
  after_data: unknown;
  created_at: string;
};

type Profile = { auth_user_id: string; full_name: string; email: string | null };

function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [fModule, setFModule] = useState<string>("all");
  const [fUser, setFUser] = useState<string>("all");
  const [fDateFrom, setFDateFrom] = useState<string>("");
  const [fDateTo, setFDateTo] = useState<string>("");
  const [limit, setLimit] = useState<number>(500);

  async function load() {
    setLoading(true);
    let query = supabase
      .from("audit_logs")
      .select("id,action,module,record_id,candidate_id,user_id,before_data,after_data,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (fModule !== "all") query = query.eq("module", fModule);
    if (fUser !== "all") query = query.eq("user_id", fUser);
    if (fDateFrom) query = query.gte("created_at", fDateFrom);
    if (fDateTo) query = query.lte("created_at", fDateTo + "T23:59:59");
    const { data } = await query;
    setRows((data ?? []) as AuditRow[]);
    const { data: profs } = await supabase.from("profiles").select("auth_user_id,full_name,email");
    const m = new Map<string, Profile>();
    for (const p of (profs ?? []) as Profile[]) m.set(p.auth_user_id, p);
    setProfiles(m);
    setLoading(false);
  }

  useEffect(() => { load(); }, [fModule, fUser, fDateFrom, fDateTo, limit]);

  const moduleOptions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => { if (r.module) s.add(r.module); });
    return Array.from(s).sort();
  }, [rows]);

  const userOptions = useMemo(() => {
    const s = new Map<string, string>();
    rows.forEach((r) => {
      if (r.user_id) {
        const p = profiles.get(r.user_id);
        s.set(r.user_id, p?.full_name || p?.email || r.user_id);
      }
    });
    return Array.from(s.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows, profiles]);

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      r.action.toLowerCase().includes(s) ||
      (r.module ?? "").toLowerCase().includes(s) ||
      (r.record_id ?? "").toLowerCase().includes(s)
    );
  });

  function resetFilters() {
    setFModule("all"); setFUser("all"); setFDateFrom(""); setFDateTo(""); setQ(""); setLimit(500);
  }

  function userLabel(uid: string | null): string {
    if (!uid) return "-";
    const p = profiles.get(uid);
    return p?.full_name || p?.email || uid;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            Jejak perubahan data peserta, pemeriksaan, dan finalisasi (akses: super_admin / viewer).
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base">{rows.length} entri (filter aktif) — max {limit}</CardTitle>
            <TableExportMenu
              data={filtered}
              filename="audit_log"
              title="Audit Log"
              columns={[
                { key: "created_at", label: "Waktu", accessor: (r) => new Date(r.created_at).toLocaleString("id-ID") },
                { key: "module", label: "Module" },
                { key: "action", label: "Action" },
                { key: "record_id", label: "Record", accessor: (r) => r.record_id ?? r.candidate_id ?? "" },
                { key: "user_id", label: "User", accessor: (r) => userLabel(r.user_id) },
              ]}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2 mt-3">
            <Input
              placeholder="Cari action / module / record…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="md:col-span-2"
            />
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={fModule} onChange={(e) => setFModule(e.target.value)}>
              <option value="all">Semua Modul</option>
              {moduleOptions.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={fUser} onChange={(e) => setFUser(e.target.value)}>
              <option value="all">Semua User</option>
              {userOptions.map(([uid, label]) => <option key={uid} value={uid}>{label}</option>)}
            </select>
            <Input type="date" value={fDateFrom} onChange={(e) => setFDateFrom(e.target.value)} title="Dari tanggal" />
            <Input type="date" value={fDateTo} onChange={(e) => setFDateTo(e.target.value)} title="Sampai tanggal" />
          </div>
          <div className="flex items-center justify-between gap-2 mt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Limit:
              <select className="h-8 rounded border bg-background px-2 text-xs" value={limit} onChange={(e) => setLimit(parseInt(e.target.value, 10))}>
                {[200, 500, 1000, 2000, 5000].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={resetFilters}><FilterX className="h-3.5 w-3.5 mr-1" /> Reset</Button>
              <Button size="sm" variant="outline" onClick={load} disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                Muat Ulang
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Memuat…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Belum ada entri audit.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase">
                  <tr>
                    <th className="text-left p-3">Waktu</th>
                    <th className="text-left p-3">Module</th>
                    <th className="text-left p-3">Action</th>
                    <th className="text-left p-3">Record</th>
                    <th className="text-left p-3">User</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-t border-border align-top">
                      <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("id-ID")}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{r.module ?? "-"}</Badge>
                      </td>
                      <td className="p-3 font-medium">{r.action}</td>
                      <td className="p-3 font-mono text-[11px] break-all max-w-[240px]">
                        {r.record_id ?? r.candidate_id ?? "-"}
                      </td>
                      <td className="p-3 text-[11px] break-all max-w-[220px]">
                        <div className="font-medium">{userLabel(r.user_id)}</div>
                        {r.user_id && <div className="font-mono text-[10px] text-muted-foreground truncate">{r.user_id}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}