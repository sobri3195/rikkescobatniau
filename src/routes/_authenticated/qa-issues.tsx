import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/local-supabase-shim";
import { useAuth } from "@/lib/use-auth";
import { can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { EvidenceUploader } from "@/components/qa/EvidenceUploader";
import { TableExportMenu } from "@/components/export/TableExportMenu";

export const Route = createFileRoute("/_authenticated/qa-issues")({
  component: QAIssuesPage,
});

type Issue = {
  id: string;
  issue_code: string;
  title: string;
  description: string | null;
  module: string | null;
  severity: string;
  priority: string;
  status: string;
  expected_result: string | null;
  actual_result: string | null;
  root_cause: string | null;
  resolution_notes: string | null;
  evidence_url: string | null;
  related_test_run_id: string | null;
  related_candidate_id: string | null;
  related_exam_id: string | null;
  related_export_id: string | null;
  reported_by: string | null;
  assigned_to: string | null;
  created_at: string;
  resolved_at: string | null;
};

const SEVERITY = ["Critical", "High", "Medium", "Low"];
const STATUSES = ["Open", "In Progress", "Ready for Retest", "Resolved", "Closed", "Won't Fix"];
const sevColor: Record<string, string> = {
  Critical: "bg-red-700 text-white",
  High: "bg-orange-600 text-white",
  Medium: "bg-amber-500 text-white",
  Low: "bg-slate-500 text-white",
};

function QAIssuesPage() {
  const { roles } = useAuth();
  const canManage = can.manageIssue(roles);

  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fSev, setFSev] = useState("all");
  const [fStatus, setFStatus] = useState("open");
  const [editing, setEditing] = useState<Issue | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("qa_issues").select("*").order("created_at", { ascending: false });
    setIssues((data ?? []) as any);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = issues.filter((i) => {
    if (fSev !== "all" && i.severity !== fSev) return false;
    if (fStatus === "open" && ["Closed", "Resolved", "Won't Fix"].includes(i.status)) return false;
    if (fStatus !== "open" && fStatus !== "all" && i.status !== fStatus) return false;
    if (search && !`${i.issue_code} ${i.title} ${i.module ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Issue Tracker</h1>
          <p className="text-sm text-muted-foreground">Catatan bug, defect, dan permintaan perbaikan</p>
        </div>
        <div className="flex gap-2">
          <TableExportMenu
            data={filtered}
            filename="qa_issues"
            title="QA Issues"
            columns={[
              { key: "issue_code", label: "Kode" },
              { key: "title", label: "Judul" },
              { key: "module", label: "Module" },
              { key: "severity", label: "Severity" },
              { key: "priority", label: "Priority" },
              { key: "status", label: "Status" },
              { key: "created_at", label: "Dibuat", accessor: (i) => new Date(i.created_at).toLocaleString("id-ID") },
              { key: "resolved_at", label: "Selesai", accessor: (i) => i.resolved_at ? new Date(i.resolved_at).toLocaleString("id-ID") : "" },
            ]}
          />
          {canManage && (
            <Button onClick={() => setEditing({
            id: "", issue_code: `ISS-${Date.now().toString().slice(-6)}`, title: "", description: "",
            module: "", severity: "Medium", priority: "Medium", status: "Open",
            expected_result: "", actual_result: "", root_cause: "", resolution_notes: "",
            evidence_url: "", related_test_run_id: null, related_candidate_id: null,
            related_exam_id: null, related_export_id: null, reported_by: null, assigned_to: null,
            created_at: "", resolved_at: null,
            })}><Plus className="h-4 w-4 mr-2" /> Buat Issue</Button>
          )}
        </div>
      </header>

      <Card>
        <CardContent className="p-4 grid md:grid-cols-4 gap-3">
          <Input placeholder="Cari kode/judul..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={fSev} onValueChange={setFSev}>
            <SelectTrigger><SelectValue placeholder="Severity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Severity</SelectItem>
              {SEVERITY.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Hanya Terbuka</SelectItem>
              <SelectItem value="all">Semua Status</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground self-center">{filtered.length} issue</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-2">Kode</th>
                <th className="p-2">Judul</th>
                <th className="p-2">Module</th>
                <th className="p-2">Severity</th>
                <th className="p-2">Status</th>
                <th className="p-2">Dibuat</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-4 text-center">Memuat...</td></tr>
              ) : filtered.map((i) => (
                <tr key={i.id} className="border-t hover:bg-muted/40 cursor-pointer" onClick={() => canManage && setEditing(i)}>
                  <td className="p-2 font-mono text-xs">{i.issue_code}</td>
                  <td className="p-2">{i.title}</td>
                  <td className="p-2">{i.module}</td>
                  <td className="p-2"><Badge className={sevColor[i.severity]}>{i.severity}</Badge></td>
                  <td className="p-2"><Badge variant="outline">{i.status}</Badge></td>
                  <td className="p-2 text-xs">{new Date(i.created_at).toLocaleDateString("id-ID")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {editing && <IssueDialog issue={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function IssueDialog({ issue, onClose, onSaved }: { issue: Issue; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Issue>(issue);
  const [saving, setSaving] = useState(false);
  const isNew = !issue.id;

  async function save() {
    setSaving(true);
    try {
      const u = (await supabase.auth.getUser()).data.user;
      const wasResolved = ["Resolved", "Closed"].includes(f.status) && !issue.resolved_at;
      const payload: any = {
        issue_code: f.issue_code,
        title: f.title,
        description: f.description,
        module: f.module,
        severity: f.severity,
        priority: f.priority,
        status: f.status,
        expected_result: f.expected_result,
        actual_result: f.actual_result,
        root_cause: f.root_cause,
        resolution_notes: f.resolution_notes,
        evidence_url: f.evidence_url,
      };
      if (isNew) {
        payload.reported_by = u?.id;
      }
      if (wasResolved) {
        payload.resolved_at = new Date().toISOString();
        payload.resolved_by = u?.id;
      }
      const { error } = isNew
        ? await supabase.from("qa_issues").insert(payload)
        : await supabase.from("qa_issues").update(payload).eq("id", issue.id);
      if (error) throw error;
      logAudit({
        action: isNew ? "create_issue" : (issue.status !== f.status ? `change_issue_status_${f.status.toLowerCase().replace(/\s/g,"_")}` : "update_issue"),
        module: "issue",
        record_id: issue.id || undefined,
        before: isNew ? null : issue,
        after: payload,
      });
      toast.success(isNew ? "Issue dibuat" : "Issue diperbarui");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Buat Issue Baru" : `Edit Issue: ${issue.issue_code}`}</DialogTitle>
        </DialogHeader>
        <div className="grid md:grid-cols-2 gap-3">
          <div><Label>Kode</Label><Input value={f.issue_code} onChange={(e) => setF({ ...f, issue_code: e.target.value })} /></div>
          <div><Label>Module</Label><Input value={f.module ?? ""} onChange={(e) => setF({ ...f, module: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Judul</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div><Label>Severity</Label>
            <Select value={f.severity} onValueChange={(v) => setF({ ...f, severity: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SEVERITY.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Status</Label>
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2"><Label>Description</Label><Textarea value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div><Label>Expected</Label><Textarea value={f.expected_result ?? ""} onChange={(e) => setF({ ...f, expected_result: e.target.value })} /></div>
          <div><Label>Actual</Label><Textarea value={f.actual_result ?? ""} onChange={(e) => setF({ ...f, actual_result: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Root Cause</Label><Textarea value={f.root_cause ?? ""} onChange={(e) => setF({ ...f, root_cause: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Resolution Notes</Label><Textarea value={f.resolution_notes ?? ""} onChange={(e) => setF({ ...f, resolution_notes: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Evidence</Label><EvidenceUploader value={f.evidence_url} onChange={(v) => setF({ ...f, evidence_url: v })} folder="issues" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}