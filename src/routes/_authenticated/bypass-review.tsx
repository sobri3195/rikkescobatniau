import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/lib/use-auth";
import { ShieldCheck, AlertTriangle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/bypass-review")({
  component: BypassReviewPage,
});

type Row = {
  id: string;
  candidate_id: string;
  selection_id: string;
  bypass_initial_at: string;
  bypass_initial_by: string | null;
  bypass_initial_reason: string | null;
  bypass_initial_reviewed_at: string | null;
  bypass_initial_reviewed_by: string | null;
  hari_h_stage: string | null;
  ekg_initial_status: string;
  radiology_initial_status: string;
  candidate?: { full_name: string; test_number: string | null; temporary_id: string | null };
};

function BypassReviewPage() {
  const { roles } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "reviewed">("pending");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "ekg" | "radiology" | "both">("all");

  const isAdmin = roles?.some((r: string) => ["super_admin", "admin", "kepala_sub_tim"].includes(r));

  async function load() {
    setLoading(true);
    let q = supabase
      .from("exams")
      .select("id, candidate_id, selection_id, bypass_initial_at, bypass_initial_by, bypass_initial_reason, bypass_initial_reviewed_at, bypass_initial_reviewed_by, hari_h_stage, ekg_initial_status, radiology_initial_status, candidates!inner(full_name, test_number, temporary_id)")
      .not("bypass_initial_at", "is", null)
      .order("bypass_initial_at", { ascending: false })
      .limit(200);
    if (tab === "pending") q = q.is("bypass_initial_reviewed_at", null);
    else q = q.not("bypass_initial_reviewed_at", "is", null);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows(((data ?? []) as any[]).map((r) => ({ ...r, candidate: r.candidates })));
    setLoading(false);
  }

  useEffect(() => { load(); }, [tab]);

  const filtered = rows.filter((r) => {
    if (typeFilter !== "all") {
      const ekgPending = r.ekg_initial_status !== "Cleared";
      const roPending = r.radiology_initial_status !== "Cleared";
      if (typeFilter === "ekg" && !ekgPending) return false;
      if (typeFilter === "radiology" && !roPending) return false;
      if (typeFilter === "both" && !(ekgPending && roPending)) return false;
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      const hay = `${r.candidate?.full_name ?? ""} ${r.candidate?.test_number ?? ""} ${r.candidate?.temporary_id ?? ""} ${r.bypass_initial_reason ?? ""}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  async function approve(r: Row) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("exams")
      .update({
        bypass_initial_reviewed_by: u.user?.id,
        bypass_initial_reviewed_at: new Date().toISOString(),
      })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    // Also approve any pending bypass_audit rows for this exam
    await supabase
      .from("bypass_audit")
      .update({
        status: "approved",
        reviewed_by: u.user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("exam_id", r.id)
      .eq("status", "pending");
    await logAudit({ action: "bypass_review_approve", module: "rikkes", record_id: r.id, candidate_id: r.candidate_id });
    toast.success("Bypass disetujui");
    load();
  }

  async function reject(r: Row) {
    const note = window.prompt("Alasan penolakan bypass:");
    if (!note || note.trim().length < 5) return;
    const { data: u } = await supabase.auth.getUser();
    await supabase
      .from("bypass_audit")
      .update({
        status: "rejected",
        reviewed_by: u.user?.id,
        reviewed_at: new Date().toISOString(),
        review_note: note.trim(),
      })
      .eq("exam_id", r.id)
      .eq("status", "pending");
    await logAudit({ action: "bypass_review_reject", module: "rikkes", record_id: r.id, candidate_id: r.candidate_id, after: { note } });
    toast.success("Bypass ditolak");
    load();
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 min-h-screen">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-orange-600" /> Review Bypass Hari-H
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Daftar exam dengan bypass gating EKG/Rontgen. Hanya admin/kepala sub-tim yang dapat mereview.
        </p>
      </div>

      <div className="flex gap-2">
        <Button variant={tab === "pending" ? "default" : "outline"} onClick={() => setTab("pending")}>
          Menunggu Review
        </Button>
        <Button variant={tab === "reviewed" ? "default" : "outline"} onClick={() => setTab("reviewed")}>
          Sudah Direview
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama / No Test / alasan…" className="pl-9 h-9" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm">
          <option value="all">Semua jenis bypass</option>
          <option value="ekg">EKG saja</option>
          <option value="radiology">Rontgen saja</option>
          <option value="both">EKG + Rontgen</option>
        </select>
        <span className="text-xs text-slate-500 ml-auto">{filtered.length} dari {rows.length} item</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="text-left px-4 py-2">Peserta</th>
              <th className="text-left px-4 py-2">No Test</th>
              <th className="text-left px-4 py-2">Stage</th>
              <th className="text-left px-4 py-2">EKG / RO</th>
              <th className="text-left px-4 py-2">Alasan Bypass</th>
              <th className="text-left px-4 py-2">Waktu</th>
              <th className="text-right px-4 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Memuat…</td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Tidak ada data.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{r.candidate?.full_name}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.candidate?.test_number ?? r.candidate?.temporary_id ?? "-"}</td>
                <td className="px-4 py-2"><Badge variant="outline">{r.hari_h_stage ?? "-"}</Badge></td>
                <td className="px-4 py-2 text-xs">
                  <div>EKG: <span className="font-medium">{r.ekg_initial_status}</span></div>
                  <div>RO: <span className="font-medium">{r.radiology_initial_status}</span></div>
                </td>
                <td className="px-4 py-2 max-w-xs">
                  <div className="flex items-start gap-1 text-orange-800">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span className="text-xs">{r.bypass_initial_reason ?? "-"}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-xs text-slate-500">
                  {r.bypass_initial_at ? new Date(r.bypass_initial_at).toLocaleString("id-ID") : "-"}
                </td>
                <td className="px-4 py-2 text-right">
                  {tab === "pending" && isAdmin ? (
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" onClick={() => approve(r)}>Setujui</Button>
                      <Button size="sm" variant="outline" onClick={() => reject(r)}>Tolak</Button>
                    </div>
                  ) : (
                    <span className="text-xs text-emerald-700">
                      {r.bypass_initial_reviewed_at ? "Disetujui" : "-"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}