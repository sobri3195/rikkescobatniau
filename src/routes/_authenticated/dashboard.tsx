import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RefreshCw, Activity, Users, CheckCircle2, Clock, AlertCircle, FileText, ClipboardList } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { isPimpinanViewer } from "@/lib/permissions";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { fetchSelectionsWithStats, type DashboardSummary } from "@/lib/dashboard-aggregate";
import { SelectionCard, type SelectionCardData } from "@/components/selection/SelectionCard";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function SummaryCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="text-xl font-bold tabular-nums">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { roles } = useAuth();
  const { has } = usePermissions();
  const viewerOnly = isPimpinanViewer(roles);
  const canExport = has(PERMISSIONS.EXPORT_XLSX) || has("report.rekap.view_readonly") || roles.includes("super_admin");

  const [selections, setSelections] = useState<SelectionCardData[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("aktif");
  const [locationFilter, setLocationFilter] = useState("all");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchSelectionsWithStats();
      setSelections(data.selections);
      setSummary(data.summary);
    } catch (e: any) {
      setErr(e?.message ?? "Gagal memuat data dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const years = useMemo(
    () => Array.from(new Set(selections.map((s) => s.year_label).filter(Boolean))).sort(),
    [selections],
  );
  const locations = useMemo(
    () => Array.from(new Set(selections.map((s) => s.location ?? "").filter(Boolean))).sort(),
    [selections],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return selections.filter((s) => {
      if (statusFilter !== "all" && (s.status ?? "").toLowerCase() !== statusFilter) return false;
      if (yearFilter !== "all" && s.year_label !== yearFilter) return false;
      if (locationFilter !== "all" && (s.location ?? "") !== locationFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.year_label.toLowerCase().includes(q) ||
        (s.location ?? "").toLowerCase().includes(q) ||
        s.participant_label.toLowerCase().includes(q)
      );
    });
  }, [selections, search, yearFilter, statusFilter, locationFilter]);

  return (
    <div className="p-6 lg:p-8 space-y-6 min-h-screen">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Pemeriksaan</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pantau seluruh seleksi aktif dan progress pemeriksaannya.
            {viewerOnly && (
              <span className="ml-2 inline-block text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-xs">
                Mode Pemantau
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!viewerOnly && (
            <Button asChild variant="outline" size="sm">
              <Link to="/selections">
                <ClipboardList className="h-4 w-4 mr-2" /> Master Seleksi
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {err && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-3 text-sm">{err}</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <SummaryCard icon={ClipboardList} label="Seleksi Aktif" value={summary?.totalSelectionsActive ?? 0} tone="bg-primary/10 text-primary" />
        <SummaryCard icon={Users} label="Total Peserta" value={summary?.totalCandidates ?? 0} tone="bg-sky-100 text-sky-700" />
        <SummaryCard icon={Clock} label="Sedang Berjalan" value={summary?.inProgress ?? 0} tone="bg-blue-100 text-blue-700" />
        <SummaryCard icon={Activity} label="Menunggu EKG" value={summary?.waitingEkg ?? 0} tone="bg-amber-100 text-amber-700" />
        <SummaryCard icon={Activity} label="Menunggu Rontgen" value={summary?.waitingRontgen ?? 0} tone="bg-amber-100 text-amber-700" />
        <SummaryCard icon={Users} label="Screening Hari-H" value={summary?.screening ?? 0} tone="bg-violet-100 text-violet-700" />
        <SummaryCard icon={Users} label="Pemeriksaan Subtim" value={summary?.subteam ?? 0} tone="bg-indigo-100 text-indigo-700" />
        <SummaryCard icon={FileText} label="Review" value={summary?.review ?? 0} tone="bg-cyan-100 text-cyan-700" />
        <SummaryCard icon={CheckCircle2} label="Finalized" value={summary?.finalized ?? 0} tone="bg-emerald-100 text-emerald-700" />
        <SummaryCard icon={AlertCircle} label="Data Belum Lengkap" value={summary?.incomplete ?? 0} tone="bg-orange-100 text-orange-700" />
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input placeholder="Cari nama seleksi, tahun, lokasi…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tahun" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua tahun</SelectItem>
              {years.map((y) => (<SelectItem key={y} value={y}>{y}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              <SelectItem value="aktif">Aktif</SelectItem>
              <SelectItem value="nonaktif">Nonaktif</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Lokasi" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua lokasi</SelectItem>
              {locations.map((l) => (<SelectItem key={l} value={l}>{l}</SelectItem>))}
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground">{filtered.length} / {selections.length}</div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-3">Daftar Seleksi Aktif</h2>
        {loading && (
          <div className="grid md:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}><CardContent className="p-4 h-48 bg-slate-50 animate-pulse rounded" /></Card>
            ))}
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-sm text-muted-foreground py-6 text-center bg-white border rounded-lg">
            Tidak ada seleksi yang cocok dengan filter.
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="grid md:grid-cols-2 gap-3">
            {filtered.map((s) => (
              <SelectionCard
                key={s.id}
                selection={s}
                mode="monitoring"
                canExport={canExport}
                onViewReport={(sel) => {
                  void logAudit({ action: "view_report", module: "dashboard", record_id: sel.id });
                  toast.info("Membuka Laporan Tahap…");
                  window.location.assign(`/laporan-tahap?selection=${sel.id}`);
                }}
                onExport={(sel) => {
                  void logAudit({ action: "export_initiated", module: "dashboard", record_id: sel.id });
                  window.location.assign(`/exports?selection=${sel.id}`);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}