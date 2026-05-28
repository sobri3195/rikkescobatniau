// RIKKES TNI AU – Engine perhitungan otomatis.
// Murni administratif: tidak melakukan diagnosis, hanya menerjemahkan
// klasifikasi yang sudah diinput dokter/petugas menjadi KESUM/KESWA/hasil akhir.

import { supabase } from "@/lib/local-supabase-shim";
import { logAudit } from "@/lib/audit";
import { SECTIONS } from "@/lib/sections";

export type Classification = "B" | "C" | "K1" | "K2" | "TH";
export type KesumValue = Classification | "Belum Lengkap" | "TH";
export type KeswaValue = "MS" | "TMS" | "TH" | "Belum Lengkap";
export type FinalValue = "MS" | "TMS" | "TH" | "Belum Lengkap";

export interface SectionLite {
  section_key: string;
  section_name: string;
  classification: string | null;
  findings: string | null;
  notes: string | null;
  section_status: string;
}

export interface FindingNote {
  section: string;
  classification: Classification;
  finding: string;
  notes: string;
}

/** Sektor yang berkontribusi ke KESUM (selain BMI). */
export const KESUM_SECTION_KEYS = SECTIONS.filter((s) => s.inKesum).map((s) => s.key);

/** Sektor wajib untuk readiness check. */
export const REQUIRED_SECTION_KEYS = SECTIONS.filter((s) => s.required).map((s) => s.key);

// ---------- Scoring config (mudah diubah Super Admin nanti) ----------
export const SCORING_DEFAULT = {
  base: { B: 85, C: 75, K1: 65, K2: 55 } as Record<Classification, number>,
  penalty: { B: 0, C: 1, K1: 2, K2: 3 } as Record<Classification, number>,
  tmsBase: 55,
  msMin: 60,
  max: 100,
};

// ---------- BMI ----------
export function calculateBMI(heightCm: number | null | undefined, weightKg: number | null | undefined): number | null {
  const h = Number(heightCm);
  const w = Number(weightKg);
  if (!h || !w || h <= 0 || w <= 0) return null;
  const m = h / 100;
  return +(w / (m * m)).toFixed(1);
}

export function classifyBMI(bmi: number | null | undefined): Classification | null {
  if (bmi == null || isNaN(bmi)) return null;
  if (bmi < 14.9) return "K2";
  if (bmi < 18.4) return "K1";
  if (bmi < 19.9) return "C";
  if (bmi < 24.9) return "B";
  if (bmi < 26.9) return "C";
  if (bmi < 29.9) return "K1";
  return "K2";
}

// ---------- Counts ----------
export function countClassifications(
  sections: SectionLite[],
  bmiClassification?: Classification | null,
) {
  const counts = { B: 0, C: 0, K1: 0, K2: 0, TH: 0 };
  const inKesum = sections.filter((s) => KESUM_SECTION_KEYS.includes(s.section_key));
  for (const s of inKesum) {
    const c = s.classification as Classification | null;
    if (c && c in counts) counts[c]++;
  }
  if (bmiClassification && bmiClassification in counts) counts[bmiClassification]++;
  return counts;
}

// ---------- KESUM ----------
export function calculateKesum(
  sections: SectionLite[],
  bmiClassification?: Classification | null,
): { kesum: KesumValue; missing: string[]; hasTH: boolean } {
  const inKesum = sections.filter((s) => KESUM_SECTION_KEYS.includes(s.section_key));
  const missing: string[] = [];
  let hasK2 = false, hasK1 = false, hasC = false, hasB = false, hasTH = false;

  for (const s of inKesum) {
    if (!s.classification) {
      // Required dan masih kosong
      const def = SECTIONS.find((d) => d.key === s.section_key);
      if (def?.required) missing.push(s.section_name);
      continue;
    }
    const c = s.classification as Classification;
    if (c === "K2") hasK2 = true;
    else if (c === "K1") hasK1 = true;
    else if (c === "C") hasC = true;
    else if (c === "B") hasB = true;
    else if (c === "TH") hasTH = true;
  }
  if (bmiClassification) {
    if (bmiClassification === "K2") hasK2 = true;
    else if (bmiClassification === "K1") hasK1 = true;
    else if (bmiClassification === "C") hasC = true;
    else if (bmiClassification === "B") hasB = true;
  }

  if (missing.length > 0) return { kesum: "Belum Lengkap", missing, hasTH };
  let kesum: KesumValue;
  if (hasK2) kesum = "K2";
  else if (hasK1) kesum = "K1";
  else if (hasC) kesum = "C";
  else if (hasB) kesum = "B";
  else if (hasTH) kesum = "TH";
  else kesum = "Belum Lengkap";
  return { kesum, missing, hasTH };
}

// ---------- KESWA ----------
export function calculateKeswa(sections: SectionLite[]): KeswaValue {
  const jiwa = sections.find((s) => s.section_key === "jiwa_keswa");
  const c = jiwa?.classification as Classification | null | undefined;
  if (!c) return "Belum Lengkap";
  if (c === "TH") return "TH";
  if (c === "K2") return "TMS";
  return "MS";
}

// ---------- Final result ----------
export function calculateFinalResult(kesum: KesumValue, keswa: KeswaValue): FinalValue {
  if (kesum === "Belum Lengkap" || keswa === "Belum Lengkap") return "Belum Lengkap";
  if (kesum === "TH" || keswa === "TH") return "TH";
  if (kesum === "K2") return "TMS";
  if (keswa === "TMS") return "TMS";
  return "MS";
}

// ---------- Final score ----------
export function calculateFinalScore(
  kesum: KesumValue,
  final: FinalValue,
  counts: { B: number; C: number; K1: number; K2: number; TH: number },
  cfg = SCORING_DEFAULT,
): number | null {
  if (kesum === "Belum Lengkap" || final === "Belum Lengkap") return null;
  if (final === "TH") return null;
  let base: number;
  if (kesum === "B") base = cfg.base.B;
  else if (kesum === "C") base = cfg.base.C;
  else if (kesum === "K1") base = cfg.base.K1;
  else if (kesum === "K2") base = cfg.base.K2;
  else base = cfg.tmsBase;
  const penalty =
    counts.K2 * cfg.penalty.K2 +
    counts.K1 * cfg.penalty.K1 +
    counts.C * cfg.penalty.C;
  let score = base - penalty;
  if (final === "MS" && score < cfg.msMin) score = cfg.msMin;
  if (score < 0) score = 0;
  if (score > cfg.max) score = cfg.max;
  return Math.round(score * 10) / 10;
}

// ---------- Notes ----------
function buildNote(section: SectionLite): FindingNote {
  return {
    section: section.section_name,
    classification: section.classification as Classification,
    finding: (section.findings ?? "").trim(),
    notes: (section.notes ?? "").trim(),
  };
}

export function generateK1Notes(
  sections: SectionLite[],
  bmiClassification?: Classification | null,
  bmi?: number | null,
): FindingNote[] {
  const out: FindingNote[] = sections
    .filter((s) => s.classification === "K1" && KESUM_SECTION_KEYS.includes(s.section_key))
    .map(buildNote);
  if (bmiClassification === "K1") {
    out.push({
      section: "IMT",
      classification: "K1",
      finding: bmi != null ? `IMT ${bmi}` : "IMT",
      notes: "Klasifikasi IMT K1",
    });
  }
  return out;
}

export function generateK2Notes(
  sections: SectionLite[],
  keswa: KeswaValue,
  bmiClassification?: Classification | null,
  bmi?: number | null,
): FindingNote[] {
  const out: FindingNote[] = sections
    .filter((s) => s.classification === "K2" && KESUM_SECTION_KEYS.includes(s.section_key))
    .map(buildNote);
  if (bmiClassification === "K2") {
    out.push({
      section: "IMT",
      classification: "K2",
      finding: bmi != null ? `IMT ${bmi}` : "IMT",
      notes: "Klasifikasi IMT K2",
    });
  }
  if (keswa === "TMS") {
    const jiwa = sections.find((s) => s.section_key === "jiwa_keswa");
    if (jiwa && jiwa.classification === "K2") {
      out.push(buildNote(jiwa));
    }
  }
  return out;
}

export function notesToString(list: FindingNote[]): string {
  return list.map((n) => `${n.section}: ${[n.finding, n.notes].filter(Boolean).join(" — ")}`).join("; ");
}

// ---------- Readiness ----------
export interface ReadinessCheck {
  ok: boolean;
  items: { label: string; ok: boolean; detail?: string }[];
}

export function checkReadiness(
  sections: SectionLite[],
  kesum: KesumValue,
  keswa: KeswaValue,
  final: FinalValue,
): ReadinessCheck {
  const items: ReadinessCheck["items"] = [];
  const must = (key: string, label: string) => {
    const s = sections.find((x) => x.section_key === key);
    const done = !!s && ["Submitted", "Approved", "Locked"].includes(s.section_status);
    items.push({ label, ok: done });
  };
  must("identitas", "Identitas lengkap");
  must("anamnesa", "Anamnesa terisi");
  must("surat_pernyataan", "Surat pernyataan");

  const pendingRequired = sections
    .filter((s) => REQUIRED_SECTION_KEYS.includes(s.section_key))
    .filter((s) => !["Submitted", "Approved", "Locked"].includes(s.section_status));
  items.push({
    label: "Semua section wajib sudah Submitted/Approved",
    ok: pendingRequired.length === 0,
    detail: pendingRequired.map((s) => s.section_name).join(", ") || undefined,
  });
  items.push({ label: "KESUM terhitung", ok: kesum !== "Belum Lengkap" });
  items.push({ label: "KESWA terhitung", ok: keswa !== "Belum Lengkap" });
  items.push({ label: "Hasil akhir tersedia", ok: final !== "Belum Lengkap" });

  return { ok: items.every((i) => i.ok), items };
}

// ---------- Persistence ----------
export async function recalculateExamSummary(examId: string) {
  const [{ data: ex }, { data: secs }, { data: mm }] = await Promise.all([
    supabase.from("exams").select("id,candidate_id,exam_status").eq("id", examId).maybeSingle(),
    supabase
      .from("exam_sections")
      .select("section_key,section_name,classification,findings,notes,section_status")
      .eq("exam_id", examId),
    supabase.from("medical_measurements").select("*").eq("exam_id", examId).maybeSingle(),
  ]);
  if (!ex) return null;

  const sections = (secs ?? []) as SectionLite[];
  const bmi = mm ? calculateBMI(mm.height_cm, mm.weight_kg) : null;
  const bmiClass = classifyBMI(bmi);

  const { kesum } = calculateKesum(sections, bmiClass);
  const keswa = calculateKeswa(sections);
  const final = calculateFinalResult(kesum, keswa);
  const counts = countClassifications(sections, bmiClass);
  const score = calculateFinalScore(kesum, final, counts);
  const k1 = generateK1Notes(sections, bmiClass, bmi);
  const k2 = generateK2Notes(sections, keswa, bmiClass, bmi);

  const examPatch: any = {
    kesum_classification: kesum === "Belum Lengkap" ? null : kesum,
    keswa_status: keswa === "Belum Lengkap" ? null : keswa,
    final_result: final === "Belum Lengkap" ? null : final,
    final_score: score,
    updated_at: new Date().toISOString(),
  };
  await supabase.from("exams").update(examPatch).eq("id", examId);

  // Update / upsert measurements computed fields
  if (mm) {
    await supabase
      .from("medical_measurements")
      .update({ bmi, bmi_classification: bmiClass })
      .eq("id", mm.id);
  }

  // Update medical_summary
  await supabase
    .from("medical_summary")
    .update({
      count_b: counts.B,
      count_c: counts.C,
      count_k1: counts.K1,
      count_k2: counts.K2,
      kesum_classification: kesum,
      keswa_status: keswa,
      final_result: final,
      final_score: score,
      k1_notes: notesToString(k1),
      k2_notes: notesToString(k2),
      initial_result: final,
    })
    .eq("exam_id", examId);

  await logAudit({
    action: "recalculate_summary",
    module: "exams",
    record_id: examId,
    candidate_id: ex.candidate_id ?? undefined,
    after: { kesum, keswa, final, score, counts },
  });

  return { kesum, keswa, final, score, counts, bmi, bmiClass, k1, k2 };
}