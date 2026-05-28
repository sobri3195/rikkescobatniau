// Project rikkes_form_sections group submits into the legacy tables that
// Rekap APLIKASI & Laporan Tahap read from (exam_sections + medical_summary).
//
// This bridges the two parallel section systems so that data submitted in
// the modern group-based form (rikkes_form_sections) shows up immediately in
// Rekap / Laporan / Export — without waiting for the participant to be
// finalized, and without requiring every section to be complete.

import { supabase } from "@/lib/local-supabase-shim";
import { recalculateExamSummary } from "@/lib/rikkes-calculations";

/** Map a rikkes group_key to the legacy exam_sections.section_key list it represents. */
const GROUP_TO_SECTION_KEYS: Record<string, string[]> = {
  identitas_anamnesis: ["identitas", "anamnesa", "surat_pernyataan"],
  screening_hari_h: [], // handled via medical_measurements + screening form itself
  lembar_evaluasi_umum: ["pemeriksaan_umum", "tanda_vital"],
  evaluasi_klinis: ["penyakit_dalam", "ekg_ergo", "paru", "neurologi", "obsgyn", "kulit"],
  gigi_odontogram: ["gigi"],
  penunjang: ["radiologi_ro", "ekg_ergo", "usg"],
  ukuran_lain: ["atas", "bawah"],
  mata_tht: ["mata", "tht", "audio_tympano"],
  tht_subtim: ["tht", "audio_tympano"],
  mata_visus_subtim: ["mata"],
  bedah_subtim: ["bedah"],
  neurologi_subtim: ["neurologi"],
  laboratorium: ["laboratorium"],
  psikologi_subtim: ["jiwa_keswa"],
  resume_rekomendasi: ["resume_kesimpulan", "kualifikasi_akhir"],
};

/** Best-effort extraction of an overall classification from a free-form payload. */
function extractClassification(payload: any): string | null {
  if (!payload || typeof payload !== "object") return null;
  const candidates = [
    payload.klasifikasi,
    payload.classification,
    payload.klasifikasi_sektor,
    payload.kesimpulan_klasifikasi,
    payload.klasifikasi_akhir,
    payload.klasifikasi_kesum,
    payload.screening_classification,
  ];
  for (const v of candidates) {
    if (typeof v === "string" && ["B", "C", "K1", "K2", "TH"].includes(v.toUpperCase())) {
      return v.toUpperCase();
    }
  }
  return null;
}

function extractText(payload: any, keys: string[]): string | null {
  if (!payload || typeof payload !== "object") return null;
  for (const k of keys) {
    const v = payload[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Mirror a group submit/draft into exam_sections and recompute medical_summary
 * so Rekap APLIKASI & Laporan Tahap immediately reflect the change.
 *
 * Non-throwing: failures are logged but never block the primary submit.
 */
export async function syncGroupToRekap(args: {
  examId: string;
  candidateId: string;
  groupKey: string;
  status: string; // 'Draft' | 'Submitted' | 'Approved' | 'Locked'
  payload: any;
}): Promise<void> {
  const { examId, candidateId, groupKey, status, payload } = args;
  try {
    const sectionKeys = GROUP_TO_SECTION_KEYS[groupKey] ?? [];
    if (sectionKeys.length > 0) {
      const classification = extractClassification(payload);
      const findings = extractText(payload, ["findings", "temuan", "hasil", "kesimpulan"]);
      const notes = extractText(payload, ["notes", "catatan", "keterangan"]);

      // Load existing exam_sections rows for these keys (rows are pre-seeded
      // by create_exam_for_candidate trigger, so we only update).
      const { data: existing } = await supabase
        .from("exam_sections")
        .select("id, section_key, classification, findings, notes")
        .eq("exam_id", examId)
        .in("section_key", sectionKeys);

      const byKey = new Map((existing ?? []).map((r: any) => [r.section_key, r]));
      for (const key of sectionKeys) {
        const row = byKey.get(key);
        const patch: any = { section_status: status };
        if (classification) patch.classification = classification;
        if (findings) patch.findings = findings;
        if (notes) patch.notes = notes;
        if (status === "Submitted") patch.submitted_at = new Date().toISOString();
        if (row) {
          await supabase.from("exam_sections").update(patch).eq("id", row.id);
        } else {
          // Fallback: insert if row missing (older exams without seeded sections).
          await supabase.from("exam_sections").insert({
            exam_id: examId,
            candidate_id: candidateId,
            section_key: key,
            section_name: key,
            assigned_role: "dokter",
            ...patch,
          });
        }
      }
    }

    // Always recompute summary so KESUM/KESWA/initial_result reflect latest
    // partial state — Laporan Tahap "Laporan 1" reads medical_summary.initial_result.
    await recalculateExamSummary(examId).catch(() => {});
  } catch (e) {
    // Non-fatal: log to console for diagnostics but don't block the user.
     
    console.warn("[rekap-sync] failed to project group submit", { groupKey, examId }, e);
  }
}
