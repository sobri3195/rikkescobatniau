// Phase 8A: DB-driven formula engine.
// Loads a formula rule set from Lovable Cloud and evaluates BMI, KESUM,
// KESWA, final result, score, and STAKES. Falls back to hardcoded RIKKES
// defaults from rikkes-calculations.ts when no active rule set exists,
// so the rest of the app keeps working during transition.

import { supabase } from "@/lib/local-supabase-shim";
import type { Classification, KesumValue, KeswaValue, FinalValue, SectionLite } from "@/lib/rikkes-calculations";

export interface BmiRule {
  id?: string;
  min_value: number | null;
  max_value: number | null;
  classification: string;
  label?: string | null;
  sort_order?: number;
}
export interface KesumSection {
  section_key: string;
  section_name?: string | null;
  is_included: boolean;
  is_required: boolean;
  weight?: number | null;
  sort_order?: number;
}
export interface KeswaConfig {
  source_section_key: string;
  failure_classification: string;
  pass_result: string;
  fail_result: string;
  th_result: string;
  incomplete_result: string;
}
export interface FinalResultRule {
  condition_key: string;
  result_value: string;
  priority_order: number;
  condition_json: any;
}
export interface ScoringRule {
  kesum_classification: string;
  base_score: number;
  penalty_k2: number;
  penalty_k1: number;
  penalty_c: number;
  penalty_th: number;
  minimum_score: number | null;
  maximum_score: number | null;
}
export interface StakesConfig {
  stakes_key: string;
  stakes_label?: string | null;
  source_section_keys_json: string[];
  calculation_mode: string;
  is_enabled: boolean;
}
export interface SeverityRank {
  classification: string;
  rank_value: number;
  is_failure_level: boolean;
}

export interface FormulaRuleSet {
  id: string;
  rule_set_name: string;
  version: number;
  status: string;
  bmi: BmiRule[];
  kesum: KesumSection[];
  keswa: KeswaConfig;
  finalRules: FinalResultRule[];
  scoring: ScoringRule[];
  stakes: StakesConfig[];
  severity: SeverityRank[];
}

const DEFAULT_KESWA: KeswaConfig = {
  source_section_key: "jiwa_keswa",
  failure_classification: "K2",
  pass_result: "MS",
  fail_result: "TMS",
  th_result: "TH",
  incomplete_result: "Belum Lengkap",
};

export async function loadRuleSet(ruleSetId: string): Promise<FormulaRuleSet | null> {
  const [rs, bmi, kesum, keswa, finals, scoring, stakes, severity] = await Promise.all([
    supabase.from("formula_rule_sets").select("*").eq("id", ruleSetId).maybeSingle(),
    supabase.from("bmi_rules").select("*").eq("rule_set_id", ruleSetId).order("sort_order"),
    supabase.from("kesum_rule_configs").select("*").eq("rule_set_id", ruleSetId).order("sort_order"),
    supabase.from("keswa_rule_configs").select("*").eq("rule_set_id", ruleSetId).maybeSingle(),
    supabase.from("final_result_rules").select("*").eq("rule_set_id", ruleSetId).order("priority_order"),
    supabase.from("scoring_rules").select("*").eq("rule_set_id", ruleSetId),
    supabase.from("stakes_configs").select("*").eq("rule_set_id", ruleSetId).order("sort_order"),
    supabase.from("classification_ranks").select("*").eq("rule_set_id", ruleSetId).order("rank_value"),
  ]);
  if (!rs.data) return null;
  return {
    id: rs.data.id,
    rule_set_name: rs.data.rule_set_name,
    version: rs.data.version,
    status: rs.data.status,
    bmi: (bmi.data as any) ?? [],
    kesum: (kesum.data as any) ?? [],
    keswa: (keswa.data as any) ?? DEFAULT_KESWA,
    finalRules: (finals.data as any) ?? [],
    scoring: (scoring.data as any) ?? [],
    stakes: ((stakes.data as any) ?? []).map((s: any) => ({
      ...s,
      source_section_keys_json: Array.isArray(s.source_section_keys_json)
        ? s.source_section_keys_json
        : (() => { try { return JSON.parse(s.source_section_keys_json); } catch { return []; } })(),
    })),
    severity: (severity.data as any) ?? [],
  };
}

export async function loadActiveDefaultRuleSet(): Promise<FormulaRuleSet | null> {
  const { data } = await supabase
    .from("formula_rule_sets")
    .select("id")
    .eq("status", "Active")
    .eq("is_default", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return loadRuleSet(data.id);
}

export async function loadRuleSetForSelection(selectionId: string | null | undefined): Promise<FormulaRuleSet | null> {
  if (selectionId) {
    const { data: sel } = await supabase
      .from("selections")
      .select("active_formula_rule_set_id")
      .eq("id", selectionId)
      .maybeSingle();
    if (sel?.active_formula_rule_set_id) {
      const rs = await loadRuleSet(sel.active_formula_rule_set_id);
      if (rs) return rs;
    }
  }
  return loadActiveDefaultRuleSet();
}

// ---------- Evaluation helpers ----------
export function evaluateBmiClassification(bmi: number | null | undefined, rules: BmiRule[]): string | null {
  if (bmi == null || isNaN(Number(bmi))) return null;
  for (const r of rules) {
    const okMin = r.min_value == null || bmi >= Number(r.min_value);
    const okMax = r.max_value == null || bmi < Number(r.max_value);
    if (okMin && okMax) return r.classification;
  }
  return null;
}

export function evaluateKesum(
  sections: SectionLite[],
  bmiClassification: string | null,
  kesumCfg: KesumSection[],
  severity: SeverityRank[],
): { kesum: KesumValue; missing: string[]; counts: Record<string, number> } {
  const included = new Map(kesumCfg.filter((k) => k.is_included).map((k) => [k.section_key, k]));
  const counts: Record<string, number> = { B: 0, C: 0, K1: 0, K2: 0, TH: 0 };
  const missing: string[] = [];

  for (const cfg of included.values()) {
    if (cfg.section_key === "bmi_classification") continue;
    const s = sections.find((x) => x.section_key === cfg.section_key);
    const c = (s?.classification ?? "").toUpperCase();
    if (!c) {
      if (cfg.is_required) missing.push(cfg.section_name ?? cfg.section_key);
      continue;
    }
    if (c in counts) counts[c]++;
  }
  if (included.has("bmi_classification") && bmiClassification && bmiClassification in counts) {
    counts[bmiClassification]++;
  }

  if (missing.length > 0) return { kesum: "Belum Lengkap", missing, counts };

  // Pick worst by severity rank (lower rank_value = worse)
  const sevMap = new Map(severity.map((s) => [s.classification, s.rank_value]));
  const present = Object.entries(counts).filter(([, v]) => v > 0).map(([k]) => k);
  if (present.length === 0) return { kesum: "Belum Lengkap", missing, counts };
  const worst = present
    .map((c) => ({ c, rank: sevMap.get(c) ?? 999 }))
    .sort((a, b) => a.rank - b.rank)[0].c;
  return { kesum: worst as KesumValue, missing, counts };
}

export function evaluateKeswa(sections: SectionLite[], cfg: KeswaConfig): KeswaValue {
  const s = sections.find((x) => x.section_key === cfg.source_section_key);
  const c = (s?.classification ?? "").toUpperCase();
  if (!c) return cfg.incomplete_result as KeswaValue;
  if (c === "TH") return cfg.th_result as KeswaValue;
  if (c === cfg.failure_classification) return cfg.fail_result as KeswaValue;
  return cfg.pass_result as KeswaValue;
}

export function evaluateFinalResult(
  kesum: KesumValue,
  keswa: KeswaValue,
  rules: FinalResultRule[],
): FinalValue {
  // Process rules ordered by priority asc; condition_json schema:
  // { kesum: string[], keswa: string[] } — match if either matches
  const sorted = [...rules].sort((a, b) => a.priority_order - b.priority_order);
  for (const r of sorted) {
    const cj = r.condition_json ?? {};
    const kesumList: string[] = Array.isArray(cj.kesum) ? cj.kesum : [];
    const keswaList: string[] = Array.isArray(cj.keswa) ? cj.keswa : [];
    const matchKesum = kesumList.length > 0 && kesumList.includes(kesum);
    const matchKeswa = keswaList.length > 0 && keswaList.includes(keswa);
    const empty = kesumList.length === 0 && keswaList.length === 0;
    if (empty || matchKesum || matchKeswa) return r.result_value as FinalValue;
  }
  return "MS";
}

export function evaluateScore(
  kesum: KesumValue,
  final: FinalValue,
  counts: Record<string, number>,
  scoring: ScoringRule[],
): number | null {
  if (kesum === "Belum Lengkap" || final === "Belum Lengkap" || final === "TH") return null;
  const rule = scoring.find((s) => s.kesum_classification === kesum);
  if (!rule) return null;
  let score =
    rule.base_score -
    (counts.K2 ?? 0) * rule.penalty_k2 -
    (counts.K1 ?? 0) * rule.penalty_k1 -
    (counts.C ?? 0) * rule.penalty_c -
    (counts.TH ?? 0) * rule.penalty_th;
  if (final === "MS" && rule.minimum_score != null) score = Math.max(score, rule.minimum_score);
  if (rule.maximum_score != null) score = Math.min(score, rule.maximum_score);
  if (score < 0) score = 0;
  return Math.round(score * 10) / 10;
}

export function evaluateStakes(
  sections: SectionLite[],
  bmiClassification: string | null,
  cfg: StakesConfig[],
  severity: SeverityRank[],
): Record<string, string | null> {
  const sevMap = new Map(severity.map((s) => [s.classification, s.rank_value]));
  const out: Record<string, string | null> = {};
  for (const s of cfg) {
    if (!s.is_enabled) continue;
    const keys = s.source_section_keys_json ?? [];
    let vals: string[] = [];
    for (const k of keys) {
      if (k === "bmi_classification" && bmiClassification) vals.push(bmiClassification);
      const sec = sections.find((x) => x.section_key === k);
      if (sec?.classification) vals.push(String(sec.classification).toUpperCase());
    }
    if (vals.length === 0) { out[s.stakes_key] = null; continue; }
    if (s.calculation_mode === "direct_section_classification") {
      out[s.stakes_key] = vals[0];
    } else {
      // worst_classification
      out[s.stakes_key] = vals
        .map((c) => ({ c, rank: sevMap.get(c) ?? 999 }))
        .sort((a, b) => a.rank - b.rank)[0].c;
    }
  }
  return out;
}

// ---------- Validation ----------
export interface ValidationIssue { level: "error" | "warn"; msg: string; }
export function validateRuleSet(rs: FormulaRuleSet, opts: { strictBmi?: boolean } = {}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!rs.rule_set_name?.trim()) issues.push({ level: "error", msg: "Nama rule set kosong" });

  // BMI overlap check
  const sorted = [...rs.bmi].sort((a, b) => (a.min_value ?? -Infinity) - (b.min_value ?? -Infinity));
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (a.max_value != null && b.min_value != null && Number(a.max_value) > Number(b.min_value)) {
      issues.push({ level: "error", msg: `BMI range overlap antara ${a.classification} dan ${b.classification}` });
    }
    if (opts.strictBmi && a.max_value != null && b.min_value != null && Number(a.max_value) < Number(b.min_value)) {
      issues.push({ level: "warn", msg: `BMI gap antara ${a.classification} dan ${b.classification}` });
    }
  }

  if (rs.kesum.filter((k) => k.is_included).length === 0)
    issues.push({ level: "error", msg: "KESUM minimal punya satu source section" });
  if (!rs.keswa?.source_section_key)
    issues.push({ level: "error", msg: "KESWA source section kosong" });

  const hasFallback = rs.finalRules.some(
    (r) => !Object.keys(r.condition_json ?? {}).length ||
      ((!r.condition_json?.kesum?.length) && (!r.condition_json?.keswa?.length)),
  );
  if (!hasFallback) issues.push({ level: "error", msg: "Final result rules harus punya fallback" });

  for (const cls of ["B", "C", "K1", "K2"]) {
    if (!rs.scoring.find((s) => s.kesum_classification === cls))
      issues.push({ level: "error", msg: `Scoring rule kosong untuk ${cls}` });
  }
  for (const s of rs.scoring) {
    if ([s.penalty_c, s.penalty_k1, s.penalty_k2, s.penalty_th].some((v) => v < 0))
      issues.push({ level: "error", msg: `Penalty negatif pada scoring ${s.kesum_classification}` });
  }

  const sevKeys = new Set<string>();
  for (const s of rs.severity) {
    if (sevKeys.has(s.classification)) issues.push({ level: "error", msg: `Severity rank duplikat: ${s.classification}` });
    sevKeys.add(s.classification);
  }

  const stakesKeys = new Set<string>();
  for (const s of rs.stakes) {
    if (stakesKeys.has(s.stakes_key)) issues.push({ level: "error", msg: `STAKES key duplikat: ${s.stakes_key}` });
    stakesKeys.add(s.stakes_key);
  }

  return issues;
}

// ---------- Sample data for simulator ----------
export const SIM_SECTION_KEYS = [
  "pemeriksaan_umum","tanda_vital","penyakit_dalam","ekg_ergo","paru","neurologi",
  "obsgyn","kulit","laboratorium","radiologi_ro","usg","tht","bedah",
  "atas","bawah","audio_tympano","mata","gigi","jiwa_keswa",
];

export function buildSimSections(input: Record<string, string>): SectionLite[] {
  return SIM_SECTION_KEYS.map((k) => ({
    section_key: k,
    section_name: k,
    classification: input[k] || null,
    findings: null,
    notes: null,
    section_status: input[k] ? "Submitted" : "Draft",
  }));
}