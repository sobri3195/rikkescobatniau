import { supabase } from "@/lib/local-supabase-shim";

export type JuknisRule = {
  id: string;
  selection_type: string | null;
  gender: string | null;
  parameter_key: string;
  parameter_label: string | null;
  min_value: number | null;
  max_value: number | null;
  unit: string | null;
  classification: string | null;
  is_blocking: boolean;
  notes: string | null;
};

export type JuknisCheck = {
  parameter_key: string;
  parameter_label: string;
  value: number | null;
  ok: boolean;
  is_blocking: boolean;
  rule?: JuknisRule;
  message: string;
};

export async function loadJuknisRules(opts: { selectionType?: string | null; gender?: string | null }) {
  let q = supabase.from("juknis_parameter_rules" as any).select("*");
  const { data } = await q;
  const rows = (data as any as JuknisRule[]) ?? [];
  return rows.filter((r) => {
    if (r.selection_type && opts.selectionType && r.selection_type !== opts.selectionType) return false;
    if (r.gender && r.gender !== "ALL" && opts.gender && r.gender !== opts.gender) return false;
    return true;
  });
}

export function calcBMI(heightCm: number | null, weightKg: number | null): number | null {
  if (!heightCm || !weightKg || heightCm <= 0) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function validateJuknis(values: Record<string, number | null | undefined>, rules: JuknisRule[]): JuknisCheck[] {
  const checks: JuknisCheck[] = [];
  for (const r of rules) {
    const v = values[r.parameter_key];
    const numV = v == null || v === undefined ? null : Number(v);
    if (numV == null || !Number.isFinite(numV)) continue;
    const minOk = r.min_value == null || numV >= r.min_value;
    const maxOk = r.max_value == null || numV <= r.max_value;
    const ok = minOk && maxOk;
    const label = r.parameter_label || r.parameter_key.toUpperCase();
    const range = [
      r.min_value != null ? `min ${r.min_value}` : null,
      r.max_value != null ? `max ${r.max_value}` : null,
    ].filter(Boolean).join(", ");
    checks.push({
      parameter_key: r.parameter_key,
      parameter_label: label,
      value: numV,
      ok,
      is_blocking: r.is_blocking,
      rule: r,
      message: ok
        ? `OK (${numV}${r.unit ? " " + r.unit : ""})`
        : `Di luar rentang Juknis (${range}). Nilai: ${numV}${r.unit ? " " + r.unit : ""}`,
    });
  }
  return checks;
}