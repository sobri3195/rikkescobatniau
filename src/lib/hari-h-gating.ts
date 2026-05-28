import { supabase } from "@/integrations/supabase/client";

const SCREENING_KEYS = new Set(["screening_hari_h"]);
const NON_SUBTIM_KEYS = new Set([
  "identitas_anamnesis",
  "screening_hari_h",
]);

export type GateResult = {
  allowed: boolean;
  reasons: string[];
  canBypass: boolean;
  ekgStatus: string;
  roStatus: string;
  bypassed: boolean;
};

export type HariHSettings = {
  require_ekg_before_screening: boolean;
  require_radiology_before_screening: boolean;
  require_ekg_before_subteam: boolean;
  require_radiology_before_subteam: boolean;
  allow_bypass_with_reason: boolean;
};

const CLEARED = new Set(["Submitted", "Approved", "Locked", "Cleared"]);

export async function loadHariHSettings(selectionId: string | null): Promise<HariHSettings> {
  // Try per-selection first, then global (selection_id is null)
  const { data } = await supabase
    .from("hari_h_settings")
    .select("*")
    .or(selectionId ? `selection_id.eq.${selectionId},selection_id.is.null` : "selection_id.is.null")
    .order("selection_id", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  return {
    require_ekg_before_screening: data?.require_ekg_before_screening ?? true,
    require_radiology_before_screening: data?.require_radiology_before_screening ?? true,
    require_ekg_before_subteam: data?.require_ekg_before_subteam ?? true,
    require_radiology_before_subteam: data?.require_radiology_before_subteam ?? true,
    allow_bypass_with_reason: data?.allow_bypass_with_reason ?? true,
  };
}

export async function evaluateGate(params: {
  examId: string;
  groupKey: string;
  settings: HariHSettings;
  bypassed: boolean;
}): Promise<GateResult> {
  const { examId, groupKey, settings, bypassed } = params;

  const isScreening = SCREENING_KEYS.has(groupKey);
  const isSubtim = !NON_SUBTIM_KEYS.has(groupKey);

  const needEkg =
    (isScreening && settings.require_ekg_before_screening) ||
    (isSubtim && settings.require_ekg_before_subteam);
  const needRo =
    (isScreening && settings.require_radiology_before_screening) ||
    (isSubtim && settings.require_radiology_before_subteam);

  let ekgStatus = "Belum Diisi";
  let roStatus = "Belum Diisi";

  if (needEkg) {
    const { data } = await supabase
      .from("exam_cardiology")
      .select("status")
      .eq("exam_id", examId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    ekgStatus = data?.status ?? "Belum Diisi";
  }
  if (needRo) {
    const { data } = await supabase
      .from("exam_radiology")
      .select("status")
      .eq("exam_id", examId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    roStatus = data?.status ?? "Belum Diisi";
  }

  const reasons: string[] = [];
  if (needEkg && !CLEARED.has(ekgStatus)) reasons.push("EKG belum cleared");
  if (needRo && !CLEARED.has(roStatus)) reasons.push("Rontgen belum cleared");

  const allowed = reasons.length === 0 || bypassed;
  return {
    allowed,
    reasons,
    canBypass: settings.allow_bypass_with_reason && reasons.length > 0,
    ekgStatus,
    roStatus,
    bypassed,
  };
}