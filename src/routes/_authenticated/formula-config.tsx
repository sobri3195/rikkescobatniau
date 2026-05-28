import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/local-supabase-shim";
import { useAuth } from "@/lib/use-auth";
import { can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Copy, CheckCircle2, Archive, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { loadRuleSet, validateRuleSet, type FormulaRuleSet } from "@/lib/formula-engine";

export const Route = createFileRoute("/_authenticated/formula-config")({
  component: FormulaConfigPage,
});

type RuleSetRow = { id: string; rule_set_name: string; version: number; status: string; is_default: boolean; description: string | null; activated_at: string | null };

function FormulaConfigPage() {
  const { roles } = useAuth();
  const canEdit = can.editFormulaDraft(roles);
  const canActivate = can.activateFormula(roles);

  const [list, setList] = useState<RuleSetRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rs, setRs] = useState<FormulaRuleSet | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);

  async function refreshList() {
    const { data } = await supabase
      .from("formula_rule_sets")
      .select("id,rule_set_name,version,status,is_default,description,activated_at")
      .order("created_at", { ascending: false });
    setList((data ?? []) as RuleSetRow[]);
    if (!selectedId && data && data.length) setSelectedId(data[0].id);
  }

  useEffect(() => { refreshList(); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    if (!selectedId) { setRs(null); return; }
    setLoading(true);
    loadRuleSet(selectedId).then((r) => { setRs(r); setDirty(false); setLoading(false); });
  }, [selectedId]);

  const issues = useMemo(() => (rs ? validateRuleSet(rs) : []), [rs]);
  const isDraft = rs?.status === "Draft";
  const isActive = rs?.status === "Active";

  async function duplicate() {
    if (!rs) return;
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("formula_rule_sets").insert({
      rule_set_name: `${rs.rule_set_name} (Copy)`,
      description: `Duplicate of ${rs.rule_set_name} v${rs.version}`,
      version: 1,
      status: "Draft",
      based_on_rule_set_id: rs.id,
      created_by: u.user?.id,
    }).select("id").single();
    if (error) { toast.error(error.message); return; }
    // Copy children
    const newId = data.id;
    const tasks: PromiseLike<any>[] = [];
    if (rs.bmi.length) tasks.push(supabase.from("bmi_rules").insert(rs.bmi.map(({ id, ...x }: any) => ({ ...x, rule_set_id: newId }))));
    if (rs.kesum.length) tasks.push(supabase.from("kesum_rule_configs").insert(rs.kesum.map(({ id, ...x }: any) => ({ ...x, rule_set_id: newId }))));
    tasks.push(supabase.from("keswa_rule_configs").insert({ ...rs.keswa, rule_set_id: newId }));
    if (rs.finalRules.length) tasks.push(supabase.from("final_result_rules").insert(rs.finalRules.map(({ id, ...x }: any) => ({ ...x, rule_set_id: newId }))));
    if (rs.scoring.length) tasks.push(supabase.from("scoring_rules").insert(rs.scoring.map(({ id, ...x }: any) => ({ ...x, rule_set_id: newId }))));
    if (rs.stakes.length) tasks.push(supabase.from("stakes_configs").insert(rs.stakes.map(({ id, ...x }: any) => ({ ...x, rule_set_id: newId, source_section_keys_json: x.source_section_keys_json }))));
    if (rs.severity.length) tasks.push(supabase.from("classification_ranks").insert(rs.severity.map(({ id, ...x }: any) => ({ ...x, rule_set_id: newId }))));
    await Promise.all(tasks);
    await logAudit({ action: "duplicate_rule_set", module: "formula", record_id: newId, before: { source: rs.id } });
    toast.success("Rule set diduplikat sebagai Draft");
    await refreshList();
    setSelectedId(newId);
  }

  async function activate() {
    if (!rs) return;
    const errs = issues.filter((i) => i.level === "error");
    if (errs.length) { toast.error(`Validasi gagal: ${errs[0].msg}`); return; }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("formula_rule_sets")
      .update({ status: "Active", activated_at: new Date().toISOString(), activated_by: u.user?.id })
      .eq("id", rs.id);
    if (error) { toast.error(error.message); return; }
    await logAudit({ action: "activate_rule_set", module: "formula", record_id: rs.id });
    toast.success("Rule set diaktifkan");
    await refreshList();
    const r = await loadRuleSet(rs.id); setRs(r);
  }

  async function archive() {
    if (!rs) return;
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("formula_rule_sets")
      .update({ status: "Archived", archived_at: new Date().toISOString(), archived_by: u.user?.id })
      .eq("id", rs.id);
    await logAudit({ action: "archive_rule_set", module: "formula", record_id: rs.id });
    toast.success("Rule set diarsipkan");
    await refreshList();
    const r = await loadRuleSet(rs.id); setRs(r);
  }

  async function saveAll() {
    if (!rs || !isDraft) return;
    // Update header
    await supabase.from("formula_rule_sets").update({
      rule_set_name: rs.rule_set_name,
      description: (rs as any).description ?? null,
    }).eq("id", rs.id);
    // Diff replace: simplest reliable approach — delete & re-insert children.
    await Promise.all([
      supabase.from("bmi_rules").delete().eq("rule_set_id", rs.id),
      supabase.from("kesum_rule_configs").delete().eq("rule_set_id", rs.id),
      supabase.from("final_result_rules").delete().eq("rule_set_id", rs.id),
      supabase.from("scoring_rules").delete().eq("rule_set_id", rs.id),
      supabase.from("stakes_configs").delete().eq("rule_set_id", rs.id),
      supabase.from("classification_ranks").delete().eq("rule_set_id", rs.id),
      supabase.from("keswa_rule_configs").delete().eq("rule_set_id", rs.id),
    ]);
    const tasks: PromiseLike<any>[] = [];
    if (rs.bmi.length) tasks.push(supabase.from("bmi_rules").insert(rs.bmi.map(({ id, ...x }: any, i) => ({ ...x, rule_set_id: rs.id, sort_order: i }))));
    if (rs.kesum.length) tasks.push(supabase.from("kesum_rule_configs").insert(rs.kesum.map(({ id, ...x }: any, i) => ({ ...x, rule_set_id: rs.id, sort_order: i }))));
    tasks.push(supabase.from("keswa_rule_configs").insert({ ...rs.keswa, rule_set_id: rs.id }));
    if (rs.finalRules.length) tasks.push(supabase.from("final_result_rules").insert(rs.finalRules.map(({ id, ...x }: any) => ({ ...x, rule_set_id: rs.id }))));
    if (rs.scoring.length) tasks.push(supabase.from("scoring_rules").insert(rs.scoring.map(({ id, ...x }: any) => ({ ...x, rule_set_id: rs.id }))));
    if (rs.stakes.length) tasks.push(supabase.from("stakes_configs").insert(rs.stakes.map(({ id, ...x }: any, i) => ({ ...x, rule_set_id: rs.id, sort_order: i }))));
    if (rs.severity.length) tasks.push(supabase.from("classification_ranks").insert(rs.severity.map(({ id, ...x }: any) => ({ ...x, rule_set_id: rs.id }))));
    await Promise.all(tasks);
    await logAudit({ action: "update_rule_set", module: "formula", record_id: rs.id });
    toast.success("Draft tersimpan");
    setDirty(false);
    const r = await loadRuleSet(rs.id); setRs(r);
  }

  function update<K extends keyof FormulaRuleSet>(key: K, val: FormulaRuleSet[K]) {
    if (!rs) return; setRs({ ...rs, [key]: val }); setDirty(true);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Formula Config</h1>
          <p className="text-sm text-muted-foreground">Kelola rule set kalkulasi KESUM/KESWA/MS/TMS — versioned.</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rule Sets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[70vh] overflow-auto">
            {list.map((l) => (
              <button
                key={l.id}
                onClick={() => setSelectedId(l.id)}
                className={`w-full text-left p-2 rounded text-sm border ${selectedId === l.id ? "bg-accent border-accent-foreground/20" : "hover:bg-muted"}`}
              >
                <div className="font-medium truncate">{l.rule_set_name}</div>
                <div className="flex items-center gap-1 mt-1">
                  <Badge variant={l.status === "Active" ? "default" : l.status === "Draft" ? "secondary" : "outline"}>{l.status}</Badge>
                  <span className="text-xs text-muted-foreground">v{l.version}</span>
                  {l.is_default && <Badge variant="outline" className="text-xs">default</Badge>}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="col-span-9">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                {rs ? (
                  <>
                    <Input value={rs.rule_set_name} disabled={!isDraft || !canEdit}
                      onChange={(e) => update("rule_set_name", e.target.value)} className="text-lg font-semibold mb-1" />
                    <div className="flex items-center gap-2">
                      <Badge>{rs.status}</Badge>
                      <span className="text-xs text-muted-foreground">v{rs.version}</span>
                      {issues.filter((i) => i.level === "error").length > 0 && (
                        <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{issues.filter((i) => i.level === "error").length} error</Badge>
                      )}
                    </div>
                  </>
                ) : <CardTitle>Pilih rule set</CardTitle>}
              </div>
              <div className="flex gap-2">
                {rs && canEdit && (
                  <Button variant="outline" size="sm" onClick={duplicate}><Copy className="h-4 w-4 mr-1" />Duplicate</Button>
                )}
                {rs && isDraft && canEdit && (
                  <Button variant="default" size="sm" onClick={saveAll} disabled={!dirty}>Simpan Draft</Button>
                )}
                {rs && isDraft && canActivate && (
                  <Button variant="default" size="sm" onClick={activate}><CheckCircle2 className="h-4 w-4 mr-1" />Activate</Button>
                )}
                {rs && isActive && canActivate && (
                  <Button variant="outline" size="sm" onClick={archive}><Archive className="h-4 w-4 mr-1" />Archive</Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
            {rs && (
              <Tabs defaultValue="bmi">
                <TabsList>
                  <TabsTrigger value="bmi">BMI</TabsTrigger>
                  <TabsTrigger value="kesum">KESUM</TabsTrigger>
                  <TabsTrigger value="keswa">KESWA</TabsTrigger>
                  <TabsTrigger value="final">Final</TabsTrigger>
                  <TabsTrigger value="scoring">Scoring</TabsTrigger>
                  <TabsTrigger value="stakes">STAKES</TabsTrigger>
                  <TabsTrigger value="severity">Severity</TabsTrigger>
                  <TabsTrigger value="validate">Validasi</TabsTrigger>
                </TabsList>

                <TabsContent value="bmi">
                  <BmiTab rs={rs} update={update} disabled={!isDraft || !canEdit} />
                </TabsContent>
                <TabsContent value="kesum">
                  <KesumTab rs={rs} update={update} disabled={!isDraft || !canEdit} />
                </TabsContent>
                <TabsContent value="keswa">
                  <KeswaTab rs={rs} update={update} disabled={!isDraft || !canEdit} />
                </TabsContent>
                <TabsContent value="final">
                  <FinalTab rs={rs} update={update} disabled={!isDraft || !canEdit} />
                </TabsContent>
                <TabsContent value="scoring">
                  <ScoringTab rs={rs} update={update} disabled={!isDraft || !canEdit} />
                </TabsContent>
                <TabsContent value="stakes">
                  <StakesTab rs={rs} update={update} disabled={!isDraft || !canEdit} />
                </TabsContent>
                <TabsContent value="severity">
                  <SeverityTab rs={rs} update={update} disabled={!isDraft || !canEdit} />
                </TabsContent>
                <TabsContent value="validate">
                  <ValidateTab issues={issues} />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============ Tabs ============
type TabProps = { rs: FormulaRuleSet; update: <K extends keyof FormulaRuleSet>(k: K, v: FormulaRuleSet[K]) => void; disabled: boolean };

function BmiTab({ rs, update, disabled }: TabProps) {
  const rows = rs.bmi;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2">
        <div className="col-span-3">Min (≥)</div><div className="col-span-3">Max (&lt;)</div>
        <div className="col-span-3">Classification</div><div className="col-span-2">Label</div><div className="col-span-1"></div>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <Input type="number" step="0.1" className="col-span-3" value={r.min_value ?? ""} disabled={disabled}
            onChange={(e) => { const v = [...rows]; v[i] = { ...r, min_value: e.target.value === "" ? null : Number(e.target.value) }; update("bmi", v); }} />
          <Input type="number" step="0.1" className="col-span-3" value={r.max_value ?? ""} disabled={disabled}
            onChange={(e) => { const v = [...rows]; v[i] = { ...r, max_value: e.target.value === "" ? null : Number(e.target.value) }; update("bmi", v); }} />
          <select className="col-span-3 h-9 rounded-md border bg-background px-2 text-sm" value={r.classification} disabled={disabled}
            onChange={(e) => { const v = [...rows]; v[i] = { ...r, classification: e.target.value }; update("bmi", v); }}>
            {["B","C","K1","K2","TH"].map((x) => <option key={x}>{x}</option>)}
          </select>
          <Input className="col-span-2" value={r.label ?? ""} disabled={disabled}
            onChange={(e) => { const v = [...rows]; v[i] = { ...r, label: e.target.value }; update("bmi", v); }} />
          <Button variant="ghost" size="icon" className="col-span-1" disabled={disabled}
            onClick={() => update("bmi", rows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" disabled={disabled}
        onClick={() => update("bmi", [...rows, { min_value: null, max_value: null, classification: "B", label: "" }])}>
        <Plus className="h-4 w-4 mr-1" />Tambah Range
      </Button>
    </div>
  );
}

function KesumTab({ rs, update, disabled }: TabProps) {
  const rows = rs.kesum;
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2 pb-2 border-b">
        <div className="col-span-4">Section</div><div className="col-span-2 text-center">Included</div>
        <div className="col-span-2 text-center">Required</div><div className="col-span-2">Weight</div><div className="col-span-2"></div>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center py-1">
          <div className="col-span-4">
            <div className="text-sm font-medium">{r.section_name ?? r.section_key}</div>
            <div className="text-xs text-muted-foreground">{r.section_key}</div>
          </div>
          <div className="col-span-2 flex justify-center">
            <Switch checked={r.is_included} disabled={disabled}
              onCheckedChange={(v) => { const c = [...rows]; c[i] = { ...r, is_included: v }; update("kesum", c); }} />
          </div>
          <div className="col-span-2 flex justify-center">
            <Switch checked={r.is_required} disabled={disabled || !r.is_included}
              onCheckedChange={(v) => { const c = [...rows]; c[i] = { ...r, is_required: v }; update("kesum", c); }} />
          </div>
          <Input type="number" step="0.1" className="col-span-2" value={r.weight ?? 1} disabled={disabled}
            onChange={(e) => { const c = [...rows]; c[i] = { ...r, weight: Number(e.target.value) }; update("kesum", c); }} />
          <div className="col-span-2" />
        </div>
      ))}
    </div>
  );
}

function KeswaTab({ rs, update, disabled }: TabProps) {
  const k = rs.keswa;
  const set = (patch: Partial<typeof k>) => update("keswa", { ...k, ...patch });
  return (
    <div className="grid grid-cols-2 gap-3 max-w-2xl">
      <Field label="Source Section Key"><Input value={k.source_section_key} disabled={disabled} onChange={(e) => set({ source_section_key: e.target.value })} /></Field>
      <Field label="Failure Classification"><Input value={k.failure_classification} disabled={disabled} onChange={(e) => set({ failure_classification: e.target.value })} /></Field>
      <Field label="Pass Result"><Input value={k.pass_result} disabled={disabled} onChange={(e) => set({ pass_result: e.target.value })} /></Field>
      <Field label="Fail Result"><Input value={k.fail_result} disabled={disabled} onChange={(e) => set({ fail_result: e.target.value })} /></Field>
      <Field label="TH Result"><Input value={k.th_result} disabled={disabled} onChange={(e) => set({ th_result: e.target.value })} /></Field>
      <Field label="Incomplete Result"><Input value={k.incomplete_result} disabled={disabled} onChange={(e) => set({ incomplete_result: e.target.value })} /></Field>
    </div>
  );
}

function FinalTab({ rs, update, disabled }: TabProps) {
  const rows = rs.finalRules;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2">
        <div className="col-span-2">Priority</div><div className="col-span-2">Key</div>
        <div className="col-span-3">KESUM in (csv)</div><div className="col-span-3">KESWA in (csv)</div>
        <div className="col-span-1">Result</div><div className="col-span-1"></div>
      </div>
      {rows.map((r, i) => {
        const cj = r.condition_json ?? {};
        const kesum = (cj.kesum ?? []).join(",");
        const keswa = (cj.keswa ?? []).join(",");
        return (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <Input type="number" className="col-span-2" value={r.priority_order} disabled={disabled}
              onChange={(e) => { const v = [...rows]; v[i] = { ...r, priority_order: Number(e.target.value) }; update("finalRules", v); }} />
            <Input className="col-span-2" value={r.condition_key} disabled={disabled}
              onChange={(e) => { const v = [...rows]; v[i] = { ...r, condition_key: e.target.value }; update("finalRules", v); }} />
            <Input className="col-span-3" value={kesum} placeholder="K2,TH" disabled={disabled}
              onChange={(e) => { const v = [...rows]; v[i] = { ...r, condition_json: { ...cj, kesum: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } }; update("finalRules", v); }} />
            <Input className="col-span-3" value={keswa} placeholder="TMS,TH" disabled={disabled}
              onChange={(e) => { const v = [...rows]; v[i] = { ...r, condition_json: { ...cj, keswa: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } }; update("finalRules", v); }} />
            <select className="col-span-1 h-9 rounded-md border bg-background px-2 text-sm" value={r.result_value} disabled={disabled}
              onChange={(e) => { const v = [...rows]; v[i] = { ...r, result_value: e.target.value }; update("finalRules", v); }}>
              {["MS","TMS","TH","Belum Lengkap"].map((x) => <option key={x}>{x}</option>)}
            </select>
            <Button variant="ghost" size="icon" className="col-span-1" disabled={disabled}
              onClick={() => update("finalRules", rows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        );
      })}
      <Button variant="outline" size="sm" disabled={disabled}
        onClick={() => update("finalRules", [...rows, { condition_key: "new", result_value: "MS", priority_order: rows.length + 1, condition_json: {} }])}>
        <Plus className="h-4 w-4 mr-1" />Tambah Rule
      </Button>
      <p className="text-xs text-muted-foreground">Rule pertama yang cocok (priority terkecil) dipakai. Rule tanpa kondisi = fallback.</p>
    </div>
  );
}

function ScoringTab({ rs, update, disabled }: TabProps) {
  const rows = rs.scoring;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2">
        <div className="col-span-2">KESUM</div><div className="col-span-2">Base</div>
        <div className="col-span-1">×K2</div><div className="col-span-1">×K1</div><div className="col-span-1">×C</div><div className="col-span-1">×TH</div>
        <div className="col-span-2">Min (MS)</div><div className="col-span-2">Max</div>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <Input className="col-span-2" value={r.kesum_classification} disabled={disabled}
            onChange={(e) => { const v = [...rows]; v[i] = { ...r, kesum_classification: e.target.value }; update("scoring", v); }} />
          {(["base_score","penalty_k2","penalty_k1","penalty_c","penalty_th","minimum_score","maximum_score"] as const).map((k, idx) => (
            <Input key={k} type="number" step="0.1"
              className={idx === 0 ? "col-span-2" : (idx >= 5 ? "col-span-2" : "col-span-1")}
              value={(r as any)[k] ?? ""}
              disabled={disabled}
              onChange={(e) => { const v = [...rows]; v[i] = { ...r, [k]: e.target.value === "" ? null : Number(e.target.value) }; update("scoring", v); }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function StakesTab({ rs, update, disabled }: TabProps) {
  const rows = rs.stakes;
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <Input className="col-span-1" value={r.stakes_key} disabled={disabled}
            onChange={(e) => { const v = [...rows]; v[i] = { ...r, stakes_key: e.target.value }; update("stakes", v); }} />
          <Input className="col-span-3" value={r.stakes_label ?? ""} disabled={disabled}
            onChange={(e) => { const v = [...rows]; v[i] = { ...r, stakes_label: e.target.value }; update("stakes", v); }} />
          <Input className="col-span-5" value={r.source_section_keys_json.join(",")} disabled={disabled}
            placeholder="section_key,section_key"
            onChange={(e) => { const v = [...rows]; v[i] = { ...r, source_section_keys_json: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }; update("stakes", v); }} />
          <select className="col-span-2 h-9 rounded-md border bg-background px-2 text-sm" value={r.calculation_mode} disabled={disabled}
            onChange={(e) => { const v = [...rows]; v[i] = { ...r, calculation_mode: e.target.value }; update("stakes", v); }}>
            <option value="worst_classification">worst</option>
            <option value="direct_section_classification">direct</option>
            <option value="custom">custom</option>
          </select>
          <Switch className="col-span-1" checked={r.is_enabled} disabled={disabled}
            onCheckedChange={(v) => { const c = [...rows]; c[i] = { ...r, is_enabled: v }; update("stakes", c); }} />
        </div>
      ))}
    </div>
  );
}

function SeverityTab({ rs, update, disabled }: TabProps) {
  const rows = rs.severity;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2">
        <div className="col-span-3">Classification</div><div className="col-span-2">Rank (asc=worst)</div>
        <div className="col-span-3">Label</div><div className="col-span-2">Color</div><div className="col-span-2">Failure?</div>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <Input className="col-span-3" value={r.classification} disabled={disabled}
            onChange={(e) => { const v = [...rows]; v[i] = { ...r, classification: e.target.value }; update("severity", v); }} />
          <Input type="number" className="col-span-2" value={r.rank_value} disabled={disabled}
            onChange={(e) => { const v = [...rows]; v[i] = { ...r, rank_value: Number(e.target.value) }; update("severity", v); }} />
          <Input className="col-span-3" value={(r as any).label ?? ""} disabled={disabled}
            onChange={(e) => { const v = [...rows]; v[i] = { ...r, label: e.target.value } as any; update("severity", v); }} />
          <Input className="col-span-2" value={(r as any).color_key ?? ""} disabled={disabled}
            onChange={(e) => { const v = [...rows]; v[i] = { ...r, color_key: e.target.value } as any; update("severity", v); }} />
          <Switch className="col-span-2" checked={r.is_failure_level} disabled={disabled}
            onCheckedChange={(v) => { const c = [...rows]; c[i] = { ...r, is_failure_level: v }; update("severity", c); }} />
        </div>
      ))}
    </div>
  );
}

function ValidateTab({ issues }: { issues: { level: string; msg: string }[] }) {
  if (!issues.length) return <div className="text-sm text-green-600">Tidak ada masalah validasi.</div>;
  return (
    <ul className="space-y-1 text-sm">
      {issues.map((i, idx) => (
        <li key={idx} className={i.level === "error" ? "text-red-600" : "text-amber-600"}>
          [{i.level.toUpperCase()}] {i.msg}
        </li>
      ))}
    </ul>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}