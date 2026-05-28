import { getDb } from "@/lib/localDb";
import { getCardiologyByExamIdLocal } from "@/lib/services/cardiologyService";
import { getRadiologyByExamIdLocal } from "@/lib/services/radiologyService";

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
  const db = getDb() as any;
  const rows = (db.hari_h_settings ?? []).filter((r: any) => selectionId ? (r.selection_id === selectionId || r.selection_id == null) : r.selection_id == null);
  const data = rows.length ? rows[0] : null;
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
    const data = getCardiologyByExamIdLocal(examId);
    ekgStatus = data?.status ?? "Belum Diisi";
  }
  if (needRo) {
    const data = getRadiologyByExamIdLocal(examId);
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