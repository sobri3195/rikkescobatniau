import { supabase } from "@/lib/local-supabase-shim";

export type HariHStage =
  | "Registrasi Awal"
  | "Menunggu EKG"
  | "Menunggu Rontgen"
  | "Penunjang Awal Lengkap"
  | "Screening Hari-H"
  | "Pemeriksaan Subtim"
  | "Review"
  | "Finalized";

export type InitialSupportingStatus =
  | "Belum Diisi"
  | "Draft"
  | "Uploaded"
  | "Submitted"
  | "Perlu Review"
  | "Cleared"
  | "Tidak Wajib";

export const HARI_H_STAGES: HariHStage[] = [
  "Registrasi Awal",
  "Menunggu EKG",
  "Menunggu Rontgen",
  "Penunjang Awal Lengkap",
  "Screening Hari-H",
  "Pemeriksaan Subtim",
  "Review",
  "Finalized",
];

export const STAGE_BADGE: Record<HariHStage, string> = {
  "Registrasi Awal": "bg-slate-100 text-slate-700 border-slate-200",
  "Menunggu EKG": "bg-amber-100 text-amber-800 border-amber-200",
  "Menunggu Rontgen": "bg-orange-100 text-orange-800 border-orange-200",
  "Penunjang Awal Lengkap": "bg-sky-100 text-sky-700 border-sky-200",
  "Screening Hari-H": "bg-blue-100 text-blue-700 border-blue-200",
  "Pemeriksaan Subtim": "bg-indigo-100 text-indigo-700 border-indigo-200",
  Review: "bg-violet-100 text-violet-700 border-violet-200",
  Finalized: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export const INIT_STATUS_BADGE: Record<InitialSupportingStatus, string> = {
  "Belum Diisi": "bg-slate-100 text-slate-600",
  Draft: "bg-amber-100 text-amber-800",
  Uploaded: "bg-sky-100 text-sky-700",
  Submitted: "bg-blue-100 text-blue-700",
  "Perlu Review": "bg-orange-100 text-orange-800",
  Cleared: "bg-emerald-100 text-emerald-700",
  "Tidak Wajib": "bg-slate-100 text-slate-500",
};

/** Recompute hari_h_stage server-side via RPC. Best-effort. */
export async function recomputeHariHStage(examId: string): Promise<void> {
  if (!examId) return;
  const { error } = await supabase.rpc(
    "update_hari_h_stage" as never,
    { p_exam_id: examId } as never,
  );
  if (error) console.warn("update_hari_h_stage:", error.message);
}

export type HariHSettings = {
  id?: string;
  selection_id: string | null;
  require_ekg_before_screening: boolean;
  require_radiology_before_screening: boolean;
  require_ekg_before_subteam: boolean;
  require_radiology_before_subteam: boolean;
  allow_bypass_with_reason: boolean;
};

export const DEFAULT_HARI_H_SETTINGS: HariHSettings = {
  selection_id: null,
  require_ekg_before_screening: true,
  require_radiology_before_screening: true,
  require_ekg_before_subteam: true,
  require_radiology_before_subteam: true,
  allow_bypass_with_reason: true,
};

export async function loadHariHSettings(selectionId: string | null): Promise<HariHSettings> {
  const { data } = await supabase
    .from("hari_h_settings" as any)
    .select("*")
    .eq("selection_id", selectionId)
    .maybeSingle();
  if (data) return data as unknown as HariHSettings;
  // Fallback to global (null selection)
  const { data: g } = await supabase
    .from("hari_h_settings" as any)
    .select("*")
    .is("selection_id", null)
    .maybeSingle();
  return (g as unknown as HariHSettings) ?? { ...DEFAULT_HARI_H_SETTINGS, selection_id: selectionId };
}