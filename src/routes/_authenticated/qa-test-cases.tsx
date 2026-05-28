import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { Play, Plus, Copy, Archive, Pencil } from "lucide-react";
import { toast } from "sonner";
import { EvidenceUploader } from "@/components/qa/EvidenceUploader";
import { TableExportMenu } from "@/components/export/TableExportMenu";

export const Route = createFileRoute("/_authenticated/qa-test-cases")({
  component: QATestCasesPage,
});

type TC = {
  id: string;
  test_case_code: string;
  title: string;
  module: string;
  feature: string | null;
  description: string | null;
  precondition: string | null;
  steps_json: any;
  expected_result: string | null;
  priority: string;
  test_type: string;
  status: string;
};

const PRIORITY = ["Critical", "High", "Medium", "Low"];
const TYPES = ["Functional", "Formula", "Export", "Import", "Permission", "Security", "Data Quality", "UI/UX", "Regression", "UAT"];
const STATUSES = ["Draft", "Ready", "Deprecated"];

function QATestCasesPage() {
  const { roles } = useAuth();
  const canManage = can.manageQA(roles);
  const canRun = can.runTest(roles);

  const [cases, setCases] = useState<TC[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fModule, setFModule] = useState("all");
  const [fType, setFType] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [editing, setEditing] = useState<TC | null>(null);
  const [running, setRunning] = useState<TC | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("qa_test_cases")
      .select("*")
      .order("test_case_code");
    setCases((data ?? []) as any);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const modules = useMemo(() => Array.from(new Set(cases.map((c) => c.module))).sort(), [cases]);

  const filtered = cases.filter((c) => {
    if (fModule !== "all" && c.module !== fModule) return false;
    if (fType !== "all" && c.test_type !== fType) return false;
    if (fStatus !== "all" && c.status !== fStatus) return false;
    if (search && !`${c.test_case_code} ${c.title} ${c.feature ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function duplicateCase(tc: TC) {
    if (!canManage) return;
    const newCode = `${tc.test_case_code}-COPY-${Date.now().toString().slice(-4)}`;
    const { error } = await supabase.from("qa_test_cases").insert({
      test_case_code: newCode,
      title: `${tc.title} (copy)`,
      module: tc.module,
      feature: tc.feature,
      description: tc.description,
      precondition: tc.precondition,
      steps_json: tc.steps_json,
      expected_result: tc.expected_result,
      priority: tc.priority,
      test_type: tc.test_type,
      status: "Draft",
    });
    if (error) return toast.error(error.message);
    toast.success("Test case diduplikasi");
    logAudit({ action: "duplicate_test_case", module: "qa", record_id: tc.id });
    load();
  }

  async function deprecate(tc: TC) {
    if (!canManage) return;
    const { error } = await supabase.from("qa_test_cases").update({ status: "Deprecated" }).eq("id", tc.id);
    if (error) return toast.error(error.message);
    toast.success("Test case di-deprecate");
    logAudit({ action: "deprecate_test_case", module: "qa", record_id: tc.id });
    load();
  }

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Test Cases</h1>
          <p className="text-sm text-muted-foreground">Manajemen test case untuk QA & UAT</p>
        </div>
        <div className="flex gap-2">
          <TableExportMenu
            data={filtered}
            filename="qa_test_cases"
            title="QA Test Cases"
            columns={[
              { key: "test_case_code", label: "Kode" },
              { key: "title", label: "Judul" },
              { key: "module", label: "Module" },
              { key: "feature", label: "Feature" },
              { key: "test_type", label: "Type" },
              { key: "priority", label: "Priority" },
              { key: "status", label: "Status" },
              { key: "expected_result", label: "Expected Result" },
            ]}
          />
          {canManage && (
            <Button onClick={() => setEditing({ id: "", test_case_code: "", title: "", module: "Auth", feature: "", description: "", precondition: "", steps_json: [{ step_number: 1, instruction: "", expected: "" }], expected_result: "", priority: "Medium", test_type: "Functional", status: "Draft" })}>
              <Plus className="h-4 w-4 mr-2" /> Tambah Test Case
            </Button>
          )}
        </div>
      </header>

      <Card>
        <CardContent className="p-4 grid md:grid-cols-5 gap-3">
          <Input placeholder="Cari kode/judul..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={fModule} onValueChange={setFModule}>
            <SelectTrigger><SelectValue placeholder="Module" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Module</SelectItem>
              {modules.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fType} onValueChange={setFType}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tipe</SelectItem>
              {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground self-center">{filtered.length} dari {cases.length}</div>
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
                <th className="p-2">Type</th>
                <th className="p-2">Priority</th>
                <th className="p-2">Status</th>
                <th className="p-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-4 text-center">Memuat...</td></tr>
              ) : filtered.map((tc) => (
                <tr key={tc.id} className="border-t hover:bg-muted/40">
                  <td className="p-2 font-mono text-xs">{tc.test_case_code}</td>
                  <td className="p-2">{tc.title}</td>
                  <td className="p-2">{tc.module}</td>
                  <td className="p-2"><Badge variant="outline">{tc.test_type}</Badge></td>
                  <td className="p-2">
                    <Badge variant={tc.priority === "Critical" ? "destructive" : tc.priority === "High" ? "default" : "secondary"}>
                      {tc.priority}
                    </Badge>
                  </td>
                  <td className="p-2">
                    <Badge variant={tc.status === "Ready" ? "default" : tc.status === "Deprecated" ? "secondary" : "outline"}>
                      {tc.status}
                    </Badge>
                  </td>
                  <td className="p-2 text-right space-x-1">
                    {canRun && tc.status === "Ready" && (
                      <Button size="sm" variant="default" onClick={() => setRunning(tc)}>
                        <Play className="h-3 w-3 mr-1" /> Run
                      </Button>
                    )}
                    {canManage && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(tc)}><Pencil className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => duplicateCase(tc)}><Copy className="h-3 w-3" /></Button>
                        {tc.status !== "Deprecated" && (
                          <Button size="sm" variant="ghost" onClick={() => deprecate(tc)}><Archive className="h-3 w-3" /></Button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {editing && <EditDialog tc={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {running && <RunDialog tc={running} onClose={() => setRunning(null)} />}
    </div>
  );
}

function EditDialog({ tc, onClose, onSaved }: { tc: TC; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<TC>(tc);
  const [stepsText, setStepsText] = useState(JSON.stringify(tc.steps_json ?? [], null, 2));
  const [saving, setSaving] = useState(false);
  const isNew = !tc.id;

  async function save() {
    setSaving(true);
    try {
      let steps: any;
      try { steps = JSON.parse(stepsText); } catch { return toast.error("Steps JSON tidak valid"); }
      const payload = {
        test_case_code: form.test_case_code,
        title: form.title,
        module: form.module,
        feature: form.feature,
        description: form.description,
        precondition: form.precondition,
        steps_json: steps,
        expected_result: form.expected_result,
        priority: form.priority,
        test_type: form.test_type,
        status: form.status,
      };
      if (isNew) {
        const { error } = await supabase.from("qa_test_cases").insert(payload);
        if (error) throw error;
        logAudit({ action: "create_test_case", module: "qa" });
        toast.success("Test case dibuat");
      } else {
        const { error } = await supabase.from("qa_test_cases").update(payload).eq("id", tc.id);
        if (error) throw error;
        logAudit({ action: "update_test_case", module: "qa", record_id: tc.id, before: tc, after: payload });
        toast.success("Test case diupdate");
      }
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
        <DialogHeader><DialogTitle>{isNew ? "Tambah" : "Edit"} Test Case</DialogTitle></DialogHeader>
        <div className="grid md:grid-cols-2 gap-3">
          <div><Label>Kode</Label><Input value={form.test_case_code} onChange={(e) => setForm({ ...form, test_case_code: e.target.value })} /></div>
          <div><Label>Module</Label><Input value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Judul</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Feature</Label><Input value={form.feature ?? ""} onChange={(e) => setForm({ ...form, feature: e.target.value })} /></div>
          <div><Label>Priority</Label>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITY.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Type</Label>
            <Select value={form.test_type} onValueChange={(v) => setForm({ ...form, test_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2"><Label>Description</Label><Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Precondition</Label><Textarea value={form.precondition ?? ""} onChange={(e) => setForm({ ...form, precondition: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Expected Result</Label><Textarea value={form.expected_result ?? ""} onChange={(e) => setForm({ ...form, expected_result: e.target.value })} /></div>
          <div className="md:col-span-2">
            <Label>Steps (JSON array)</Label>
            <Textarea className="font-mono text-xs h-40" value={stepsText} onChange={(e) => setStepsText(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RunDialog({ tc, onClose }: { tc: TC; onClose: () => void }) {
  const [result, setResult] = useState("Passed");
  const [actual, setActual] = useState("");
  const [notes, setNotes] = useState("");
  const [evidence, setEvidence] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<string>("none");
  const [createIssue, setCreateIssue] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("uat_sessions").select("id,session_name,status").in("status", ["Active", "Draft"])
      .then((r) => setSessions(r.data ?? []));
  }, []);

  async function submit() {
    setSaving(true);
    try {
      const { data: run, error } = await supabase.from("qa_test_runs").insert({
        test_case_id: tc.id,
        uat_session_id: sessionId === "none" ? null : sessionId,
        result,
        actual_result: actual,
        evidence_url: evidence,
        notes,
        run_by: (await supabase.auth.getUser()).data.user?.id,
      }).select().single();
      if (error) throw error;
      logAudit({ action: `run_test_case_${result.toLowerCase()}`, module: "qa", record_id: tc.id, after: { result, actual } });

      if (createIssue && result === "Failed") {
        const code = `ISS-${Date.now().toString().slice(-6)}`;
        const { data: iss } = await supabase.from("qa_issues").insert({
          issue_code: code,
          title: `Failed: ${tc.title}`,
          description: `Test case ${tc.test_case_code} gagal.\n\nActual: ${actual}\nNotes: ${notes}`,
          module: tc.module,
          severity: tc.priority === "Critical" ? "Critical" : tc.priority === "High" ? "High" : "Medium",
          priority: tc.priority,
          status: "Open",
          related_test_run_id: run.id,
          expected_result: tc.expected_result,
          actual_result: actual,
          evidence_url: evidence,
          reported_by: (await supabase.auth.getUser()).data.user?.id,
        }).select().single();
        if (iss) {
          await supabase.from("qa_test_runs").update({ linked_issue_id: iss.id }).eq("id", run.id);
          logAudit({ action: "create_issue_from_test", module: "qa", record_id: iss.id });
        }
      }

      toast.success(`Test run dicatat: ${result}`);
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  const steps = Array.isArray(tc.steps_json) ? tc.steps_json : [];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Jalankan Test: {tc.test_case_code}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Precondition</Label>
            <div className="text-sm bg-muted p-2 rounded">{tc.precondition || "—"}</div>
          </div>
          <div>
            <Label>Steps</Label>
            <ol className="text-sm space-y-2">
              {steps.map((s: any, i: number) => (
                <li key={i} className="border-l-2 border-primary pl-3">
                  <div className="font-medium">{i + 1}. {s.instruction}</div>
                  <div className="text-xs text-muted-foreground">→ {s.expected}</div>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <Label>Expected Result</Label>
            <div className="text-sm bg-muted p-2 rounded">{tc.expected_result || "—"}</div>
          </div>
          <div>
            <Label>UAT Session (opsional)</Label>
            <Select value={sessionId} onValueChange={setSessionId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Tidak terkait UAT —</SelectItem>
                {sessions.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.session_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Result *</Label>
            <Select value={result} onValueChange={setResult}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Passed">Passed</SelectItem>
                <SelectItem value="Failed">Failed</SelectItem>
                <SelectItem value="Blocked">Blocked</SelectItem>
                <SelectItem value="Need Review">Need Review</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Actual Result</Label>
            <Textarea value={actual} onChange={(e) => setActual(e.target.value)} placeholder="Apa yang sebenarnya terjadi..." />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div>
            <Label>Evidence</Label>
            <EvidenceUploader value={evidence} onChange={setEvidence} folder="test-runs" />
          </div>
          {result === "Failed" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={createIssue} onChange={(e) => setCreateIssue(e.target.checked)} />
              Buat issue otomatis untuk failure ini
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Menyimpan..." : "Submit Run"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}