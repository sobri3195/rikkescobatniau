import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { logAudit } from "@/lib/audit";
import {
  loadRuleSet, loadActiveDefaultRuleSet, evaluateBmiClassification,
  evaluateKesum, evaluateKeswa, evaluateFinalResult, evaluateScore, evaluateStakes,
  buildSimSections, SIM_SECTION_KEYS, type FormulaRuleSet,
} from "@/lib/formula-engine";
import { calculateBMI } from "@/lib/rikkes-calculations";

export const Route = createFileRoute("/_authenticated/rule-simulator")({
  component: SimulatorPage,
});

function SimulatorPage() {
  const [ruleSets, setRuleSets] = useState<{ id: string; rule_set_name: string; status: string; version: number }[]>([]);
  const [activeRs, setActiveRs] = useState<FormulaRuleSet | null>(null);
  const [selectedRs, setSelectedRs] = useState<FormulaRuleSet | null>(null);
  const [tb, setTb] = useState<number>(170);
  const [bb, setBb] = useState<number>(65);
  const [classes, setClasses] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from("formula_rule_sets").select("id,rule_set_name,status,version").order("created_at", { ascending: false })
      .then(({ data }) => setRuleSets((data ?? []) as any));
    loadActiveDefaultRuleSet().then((rs) => { setActiveRs(rs); setSelectedRs(rs); });
  }, []);

  const result = useMemo(() => {
    if (!selectedRs) return null;
    const sections = buildSimSections(classes);
    const bmi = calculateBMI(tb, bb);
    const bmiClass = evaluateBmiClassification(bmi, selectedRs.bmi);
    const { kesum, counts, missing } = evaluateKesum(sections, bmiClass, selectedRs.kesum, selectedRs.severity);
    const keswa = evaluateKeswa(sections, selectedRs.keswa);
    const final = evaluateFinalResult(kesum, keswa, selectedRs.finalRules);
    const score = evaluateScore(kesum, final, counts as any, selectedRs.scoring);
    const stakes = evaluateStakes(sections, bmiClass, selectedRs.stakes, selectedRs.severity);
    return { bmi, bmiClass, kesum, keswa, final, score, counts, missing, stakes };
  }, [selectedRs, tb, bb, classes]);

  const compare = useMemo(() => {
    if (!selectedRs || !activeRs || selectedRs.id === activeRs.id) return null;
    const sections = buildSimSections(classes);
    const bmi = calculateBMI(tb, bb);
    const aBmi = evaluateBmiClassification(bmi, activeRs.bmi);
    const { kesum: aKesum, counts: aCounts } = evaluateKesum(sections, aBmi, activeRs.kesum, activeRs.severity);
    const aKeswa = evaluateKeswa(sections, activeRs.keswa);
    const aFinal = evaluateFinalResult(aKesum, aKeswa, activeRs.finalRules);
    const aScore = evaluateScore(aKesum, aFinal, aCounts as any, activeRs.scoring);
    return { kesum: aKesum, keswa: aKeswa, final: aFinal, score: aScore, bmiClass: aBmi };
  }, [selectedRs, activeRs, tb, bb, classes]);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Rule Simulator</h1>
        <p className="text-sm text-muted-foreground">Coba rule set terhadap data sample. Tidak menyimpan ke exam.</p>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-5">
          <CardHeader><CardTitle className="text-sm">Input</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Rule Set</Label>
              <select className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                value={selectedRs?.id ?? ""}
                onChange={async (e) => { const r = await loadRuleSet(e.target.value); setSelectedRs(r); await logAudit({ action: "simulate_rule_set", module: "formula", record_id: e.target.value }); }}>
                {ruleSets.map((r) => <option key={r.id} value={r.id}>{r.rule_set_name} (v{r.version}, {r.status})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">TB (cm)</Label><Input type="number" value={tb} onChange={(e) => setTb(Number(e.target.value))} /></div>
              <div><Label className="text-xs">BB (kg)</Label><Input type="number" value={bb} onChange={(e) => setBb(Number(e.target.value))} /></div>
            </div>
            <div>
              <Label className="text-xs">Classification per section</Label>
              <div className="grid grid-cols-2 gap-2 mt-1 max-h-[40vh] overflow-auto pr-1">
                {SIM_SECTION_KEYS.map((k) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="text-xs flex-1 truncate">{k}</span>
                    <select className="h-8 w-24 rounded-md border bg-background px-1 text-xs"
                      value={classes[k] ?? ""}
                      onChange={(e) => setClasses({ ...classes, [k]: e.target.value })}>
                      <option value="">—</option>
                      {["B","C","K1","K2","TH"].map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-7">
          <CardHeader><CardTitle className="text-sm">Hasil</CardTitle></CardHeader>
          <CardContent>
            {!result ? <div className="text-sm text-muted-foreground">Pilih rule set…</div> : (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <Metric label="BMI" value={result.bmi ?? "—"} sub={result.bmiClass ?? ""} />
                  <Metric label="KESUM" value={result.kesum} />
                  <Metric label="KESWA" value={result.keswa} />
                  <Metric label="Final Result" value={result.final} highlight />
                  <Metric label="Score" value={result.score ?? "—"} />
                  <Metric label="Counts" value={`B${result.counts.B} C${result.counts.C} K1${result.counts.K1} K2${result.counts.K2} TH${result.counts.TH}`} />
                </div>
                <div>
                  <div className="text-xs font-medium mb-1">STAKES</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(result.stakes).map(([k, v]) => <Badge key={k} variant="outline">{k}: {v ?? "—"}</Badge>)}
                  </div>
                </div>
                {result.missing.length > 0 && (
                  <div className="text-xs text-amber-600">Missing required: {result.missing.join(", ")}</div>
                )}
                {compare && (
                  <div className="mt-3 border-t pt-3">
                    <div className="text-xs font-semibold mb-1">Bandingkan dengan Active Default</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>KESUM: <b>{compare.kesum}</b> vs <b>{result.kesum}</b></div>
                      <div>KESWA: <b>{compare.keswa}</b> vs <b>{result.keswa}</b></div>
                      <div>Final: <b>{compare.final}</b> vs <b>{result.final}</b></div>
                      <div>Score: <b>{compare.score ?? "—"}</b> vs <b>{result.score ?? "—"}</b></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, highlight }: { label: string; value: any; sub?: string; highlight?: boolean }) {
  return (
    <div className={`p-2 rounded border ${highlight ? "bg-primary/10 border-primary/30" : "bg-muted/30"}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold">{String(value)}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}