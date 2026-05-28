import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, CheckCircle2, XCircle, ClipboardCheck, FileWarning } from "lucide-react";

export const Route = createFileRoute("/_authenticated/qa-dashboard")({
  component: QADashboard,
});

type Stats = {
  totalCases: number;
  passed: number;
  failed: number;
  blocked: number;
  notRun: number;
  uatActive: number;
  uatCompleted: number;
  issueOpen: number;
  issueCritical: number;
  issueHigh: number;
  issueMedium: number;
  issueLow: number;
};

function QADashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const [recentFailed, setRecentFailed] = useState<any[]>([]);
  const [openCritical, setOpenCritical] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [tc, runs, sess, issues, failed, crit] = await Promise.all([
        supabase.from("qa_test_cases").select("id", { count: "exact", head: true }),
        supabase.from("qa_test_runs").select("id,result,test_case_id,run_at"),
        supabase.from("uat_sessions").select("id,status"),
        supabase.from("qa_issues").select("id,severity,status"),
        supabase.from("qa_test_runs").select("id,test_case_id,result,run_at,actual_result").eq("result", "Failed").order("run_at", { ascending: false }).limit(8),
        supabase.from("qa_issues").select("id,issue_code,title,severity,status,created_at").eq("severity", "Critical").in("status", ["Open", "In Progress"]).order("created_at", { ascending: false }).limit(8),
      ]);
      const runsData = runs.data ?? [];
      // Latest run per case
      const byCase = new Map<string, any>();
      runsData.forEach((r: any) => {
        const prev = byCase.get(r.test_case_id);
        if (!prev || new Date(r.run_at) > new Date(prev.run_at)) byCase.set(r.test_case_id, r);
      });
      const latest = Array.from(byCase.values());
      const issuesData = issues.data ?? [];
      const sessData = sess.data ?? [];
      setS({
        totalCases: tc.count ?? 0,
        passed: latest.filter((r) => r.result === "Passed").length,
        failed: latest.filter((r) => r.result === "Failed").length,
        blocked: latest.filter((r) => r.result === "Blocked").length,
        notRun: (tc.count ?? 0) - latest.length,
        uatActive: sessData.filter((x: any) => x.status === "Active").length,
        uatCompleted: sessData.filter((x: any) => ["Completed", "Signed Off"].includes(x.status)).length,
        issueOpen: issuesData.filter((i: any) => !["Closed", "Resolved", "Won't Fix"].includes(i.status)).length,
        issueCritical: issuesData.filter((i: any) => i.severity === "Critical").length,
        issueHigh: issuesData.filter((i: any) => i.severity === "High").length,
        issueMedium: issuesData.filter((i: any) => i.severity === "Medium").length,
        issueLow: issuesData.filter((i: any) => i.severity === "Low").length,
      });
      setRecentFailed(failed.data ?? []);
      setOpenCritical(crit.data ?? []);
    })();
  }, []);

  if (!s) return <div className="p-8">Memuat...</div>;

  const passRate = s.totalCases > 0 ? Math.round((s.passed / s.totalCases) * 100) : 0;
  const readiness = Math.min(100, Math.round(
    (passRate * 0.5) +
    (s.issueCritical === 0 ? 30 : 0) +
    (s.uatCompleted > 0 ? 20 : 0)
  ));

  return (
    <div className="p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">QA Dashboard</h1>
        <p className="text-sm text-muted-foreground">Ringkasan kesiapan operasional sistem RIKKES</p>
      </header>

      {/* Top KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi icon={ClipboardCheck} label="Test Case" value={s.totalCases} color="text-blue-600" />
        <Kpi icon={CheckCircle2} label="Passed" value={s.passed} color="text-green-600" />
        <Kpi icon={XCircle} label="Failed" value={s.failed} color="text-red-600" />
        <Kpi icon={Activity} label="Belum Dijalankan" value={s.notRun} color="text-amber-600" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi icon={AlertTriangle} label="Issue Open" value={s.issueOpen} color="text-orange-600" />
        <Kpi icon={AlertTriangle} label="Critical" value={s.issueCritical} color="text-red-700" />
        <Kpi icon={FileWarning} label="UAT Aktif" value={s.uatActive} color="text-blue-600" />
        <Kpi icon={CheckCircle2} label="UAT Selesai" value={s.uatCompleted} color="text-green-700" />
      </div>

      {/* Readiness bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Go-Live Readiness (estimasi)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-4 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${readiness >= 80 ? "bg-green-600" : readiness >= 50 ? "bg-amber-500" : "bg-red-600"}`}
              style={{ width: `${readiness}%` }}
            />
          </div>
          <div className="text-sm mt-2 flex justify-between">
            <span>Pass rate: {passRate}%</span>
            <span className="font-semibold">{readiness}% Ready</span>
          </div>
        </CardContent>
      </Card>

      {/* Severity breakdown */}
      <Card>
        <CardHeader><CardTitle className="text-base">Distribusi Severity Issue</CardTitle></CardHeader>
        <CardContent className="flex gap-4 text-sm">
          <Badge variant="destructive">Critical: {s.issueCritical}</Badge>
          <Badge className="bg-orange-600">High: {s.issueHigh}</Badge>
          <Badge className="bg-amber-500">Medium: {s.issueMedium}</Badge>
          <Badge variant="secondary">Low: {s.issueLow}</Badge>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Recent Failed Tests</CardTitle></CardHeader>
          <CardContent>
            {recentFailed.length === 0 ? (
              <div className="text-sm text-muted-foreground">Tidak ada test gagal terbaru.</div>
            ) : (
              <ul className="text-sm space-y-2">
                {recentFailed.map((r) => (
                  <li key={r.id} className="border-b pb-2">
                    <Badge variant="destructive" className="mr-2">Failed</Badge>
                    {r.actual_result ?? "—"}
                    <div className="text-xs text-muted-foreground">{new Date(r.run_at).toLocaleString("id-ID")}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Open Critical Issues</CardTitle></CardHeader>
          <CardContent>
            {openCritical.length === 0 ? (
              <div className="text-sm text-muted-foreground">Tidak ada critical issue terbuka. ✓</div>
            ) : (
              <ul className="text-sm space-y-2">
                {openCritical.map((i) => (
                  <li key={i.id} className="border-b pb-2">
                    <span className="font-mono text-xs">{i.issue_code}</span> — {i.title}
                    <Badge variant="destructive" className="ml-2">{i.severity}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, color }: any) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className={`h-8 w-8 ${color}`} />
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}