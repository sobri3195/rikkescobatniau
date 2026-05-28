import { supabase } from "@/integrations/supabase/client";
import { computeBmi } from "@/lib/sections";

export type ProgressItemStatus = "belum" | "berjalan" | "selesai" | "revised" | "finalized";

export type ProgressItem = {
  item_key: string;
  label: string;
  status: ProgressItemStatus;
  completed: boolean;
  source_section: string;
  updated_at: string | null;
  submitted_at: string | null;
};

export type CandidateProgress = {
  candidate_id: string;
  exam_id: string | null;
  items: ProgressItem[];
  percent: number;
  computed_at: string;
};

const CLEARED_SET = new Set(["Cleared", "Submitted", "Approved", "Locked"]);

function statusFromSection(rawStatus: string | null | undefined, submittedAt: string | null | undefined): ProgressItemStatus {
  const st = (rawStatus ?? "").toString();
  if (st === "Locked" || st === "Finalized") return "finalized";
  if (st === "Approved" || st === "Submitted" || submittedAt) return "selesai";
  if (st === "Revision") return "revised";
  if (st === "Draft") return "berjalan";
  return "belum";
}

function valueDone(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "number") return Number.isFinite(v) && v > 0;
  if (typeof v === "string") return v.trim().length > 0;
  return Boolean(v);
}

function makeItem(
  item_key: string,
  label: string,
  status: ProgressItemStatus,
  source_section: string,
  updated_at: string | null = null,
  submitted_at: string | null = null,
): ProgressItem {
  return {
    item_key,
    label,
    status,
    completed: status === "selesai" || status === "finalized" || status === "revised",
    source_section,
    updated_at,
    submitted_at,
  };
}

/**
 * Hitung progress aktual peserta dari data terbaru di database.
 * Item hanya ditampilkan jika field/section relevan benar-benar ada/digunakan.
 */
export async function getCandidateProgress(candidateId: string): Promise<CandidateProgress> {
  const [{ data: cand }, { data: exam }] = await Promise.all([
    supabase
      .from("candidates")
      .select("id, test_number, temporary_id")
      .eq("id", candidateId)
      .maybeSingle(),
    supabase
      .from("exams")
      .select("id, exam_status, ekg_initial_status, radiology_initial_status")
      .eq("candidate_id", candidateId)
      .maybeSingle(),
  ]);

  const examId = exam?.id ?? null;
  const items: ProgressItem[] = [];

  if (!examId) {
    return { candidate_id: candidateId, exam_id: null, items, percent: 0, computed_at: new Date().toISOString() };
  }

  const [{ data: gen }, { data: mm }, { data: rikkesSections }, { data: examSections }] = await Promise.all([
    supabase
      .from("exam_general")
      .select("height_cm, weight_kg, anamnesis, screening_classification, status, updated_at")
      .eq("exam_id", examId)
      .maybeSingle(),
    supabase
      .from("medical_measurements")
      .select("chest_or_waist_lp, bmi, height_cm, weight_kg, updated_at")
      .eq("exam_id", examId)
      .maybeSingle(),
    supabase
      .from("rikkes_form_sections")
      .select("group_key, status, submitted_at, updated_at, form_data_json")
      .eq("exam_id", examId),
    supabase
      .from("exam_sections")
      .select("section_key, section_status, submitted_at, updated_at")
      .eq("exam_id", examId),
  ]);

  const rikkesByKey = new Map<string, any>();
  (rikkesSections ?? []).forEach((r: any) => rikkesByKey.set(r.group_key, r));
  const examByKey = new Map<string, any>();
  (examSections ?? []).forEach((r: any) => examByKey.set(r.section_key, r));

  /* 1. Identitas Minimal */
  const idSection = examByKey.get("identitas");
  items.push(makeItem(
    "identitas",
    "Identitas Minimal",
    statusFromSection(idSection?.section_status, idSection?.submitted_at),
    "exam_sections.identitas",
    idSection?.updated_at ?? null,
    idSection?.submitted_at ?? null,
  ));

  /* 2. No Test Final */
  const hasTestNumber = !!cand?.test_number && !cand.test_number.startsWith("T-");
  items.push(makeItem(
    "no_test_final",
    "No Test Final",
    hasTestNumber ? "selesai" : (cand?.temporary_id ? "berjalan" : "belum"),
    "candidates.test_number",
  ));

  /* 3. Rontgen */
  const roStatus = exam?.radiology_initial_status ?? "";
  items.push(makeItem(
    "rontgen",
    "Rontgen",
    CLEARED_SET.has(roStatus) ? "selesai" : (roStatus && roStatus !== "Belum Diisi" ? "berjalan" : "belum"),
    "exams.radiology_initial_status",
  ));

  /* 4. EKG / Jantung */
  const ekgStatus = exam?.ekg_initial_status ?? "";
  items.push(makeItem(
    "ekg",
    "EKG / Jantung",
    CLEARED_SET.has(ekgStatus) ? "selesai" : (ekgStatus && ekgStatus !== "Belum Diisi" ? "berjalan" : "belum"),
    "exams.ekg_initial_status",
  ));

  /* 5. Anamnesis — gabungan exam_sections.anamnesa + exam_general.anamnesis */
  const anamSection = examByKey.get("anamnesa");
  const anamFromGeneral = valueDone(gen?.anamnesis);
  const anamStatus: ProgressItemStatus = anamSection?.submitted_at || anamSection?.section_status === "Submitted"
    ? "selesai"
    : anamFromGeneral
      ? "berjalan"
      : "belum";
  items.push(makeItem(
    "anamnesis",
    "Anamnesis",
    anamStatus,
    "exam_sections.anamnesa",
    anamSection?.updated_at ?? gen?.updated_at ?? null,
    anamSection?.submitted_at ?? null,
  ));

  /* 6-9. Screening Hari-H per-field — gunakan nilai aktual, BUKAN status submit */
  const tb = gen?.height_cm ?? mm?.height_cm ?? null;
  const bb = gen?.weight_kg ?? mm?.weight_kg ?? null;
  const lp = mm?.chest_or_waist_lp ?? null;
  const imt = mm?.bmi ?? computeBmi(tb as number | null, bb as number | null);

  items.push(makeItem("tb", "Tinggi Badan", valueDone(tb) ? "selesai" : "belum", "exam_general.height_cm", gen?.updated_at ?? null));
  items.push(makeItem("bb", "Berat Badan", valueDone(bb) ? "selesai" : "belum", "exam_general.weight_kg", gen?.updated_at ?? null));
  items.push(makeItem("lp", "Lingkar Perut", valueDone(lp) ? "selesai" : "belum", "medical_measurements.chest_or_waist_lp", mm?.updated_at ?? null));
  items.push(makeItem(
    "imt",
    "IMT",
    valueDone(tb) && valueDone(bb) && valueDone(imt) ? "selesai" : "belum",
    "computed(tb,bb)",
    mm?.updated_at ?? gen?.updated_at ?? null,
  ));

  /* 10. Klasifikasi Screening — HANYA jika field ada (B/C/K1/K2) */
  const cls = (gen?.screening_classification ?? "").toString();
  // Item ini selalu relevan karena field-nya sudah ada di exam_general.
  items.push(makeItem(
    "klasifikasi_screening",
    "Klasifikasi Screening",
    ["B", "C", "K1", "K2"].includes(cls) ? "selesai" : "belum",
    "exam_general.screening_classification",
    gen?.updated_at ?? null,
  ));

  /* Helper: status dari rikkes_form_sections dengan fallback ke exam_sections legacy */
  function sectionItem(
    item_key: string,
    label: string,
    rikkesKey: string,
    legacyKeys: string[] = [],
  ): ProgressItem {
    const r = rikkesByKey.get(rikkesKey);
    if (r) {
      return makeItem(
        item_key,
        label,
        statusFromSection(r.status, r.submitted_at),
        `rikkes_form_sections.${rikkesKey}`,
        r.updated_at ?? null,
        r.submitted_at ?? null,
      );
    }
    for (const lk of legacyKeys) {
      const e = examByKey.get(lk);
      if (e) {
        return makeItem(
          item_key,
          label,
          statusFromSection(e.section_status, e.submitted_at),
          `exam_sections.${lk}`,
          e.updated_at ?? null,
          e.submitted_at ?? null,
        );
      }
    }
    return makeItem(item_key, label, "belum", `rikkes_form_sections.${rikkesKey}`);
  }

  items.push(sectionItem("pemeriksaan_umum", "Pemeriksaan Umum", "lembar_evaluasi_umum", ["pemeriksaan_umum"]));
  items.push(sectionItem("gigi", "Gigi & Odontogram", "gigi_odontogram", ["gigi"]));
  items.push(sectionItem("penunjang", "Pemeriksaan Penunjang", "penunjang", ["ekg_ergo", "radiologi_ro", "usg"]));
  items.push(sectionItem("mata", "Mata", "mata_visus_subtim", ["mata"]));
  items.push(sectionItem("tht", "THT", "tht_subtim", ["tht"]));
  items.push(sectionItem("bedah", "Bedah", "bedah_subtim", ["bedah"]));
  items.push(sectionItem("neurologi", "Neurologi", "neurologi_subtim", ["neurologi"]));
  items.push(sectionItem("laboratorium", "Laboratorium", "laboratorium", ["laboratorium"]));
  items.push(sectionItem("keswa", "Keswa", "psikologi_subtim", ["jiwa_keswa"]));
  items.push(sectionItem("resume", "Resume & Rekomendasi", "resume_rekomendasi", ["resume_kesimpulan", "kualifikasi_akhir"]));

  /* Finalized override jika exam_status Finalized */
  if (exam?.exam_status === "Finalized") {
    items.forEach((it) => {
      if (it.status === "selesai") it.status = "finalized";
    });
  }

  const completedCount = items.filter((it) => it.completed).length;
  const percent = items.length === 0 ? 0 : Math.round((completedCount / items.length) * 100);

  return {
    candidate_id: candidateId,
    exam_id: examId,
    items,
    percent,
    computed_at: new Date().toISOString(),
  };
}

export const PROGRESS_STATUS_LABEL: Record<ProgressItemStatus, string> = {
  belum: "Belum",
  berjalan: "Berjalan",
  selesai: "Selesai",
  revised: "Revised",
  finalized: "Finalized",
};

export const PROGRESS_STATUS_CLASS: Record<ProgressItemStatus, string> = {
  belum: "bg-slate-100 text-slate-600 border-slate-200",
  berjalan: "bg-sky-100 text-sky-700 border-sky-200",
  selesai: "bg-emerald-100 text-emerald-700 border-emerald-200",
  revised: "bg-orange-100 text-orange-700 border-orange-200",
  finalized: "bg-emerald-700 text-white border-emerald-800",
};