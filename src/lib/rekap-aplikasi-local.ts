import { LOCAL_DB_KEY, generateId, getDb, normalizeSectionKey, normalizeSectionStatus, isSectionCompleted, nowIso } from "@/lib/localDb";

type AnyRec = Record<string, any>;

const CLASS_ORDER = ["B", "C", "K1", "K2", "TMS"] as const;
const CHILD_BY_SECTION: Record<string, keyof ReturnType<typeof getDb>> = {
  ekg: "exam_cardiology",
  rontgen: "exam_radiology",
  neurologi: "exam_neurology",
  laboratorium: "exam_laboratory",
  tht: "exam_ent",
  bedah: "exam_surgery",
  mata_visus: "exam_eye",
  gigi: "exam_dental",
  jiwa_keswa: "exam_psychiatry",
};

export function normalizeClassification(value?: string | null): string {
  const v = (value ?? "").toString().trim().toUpperCase();
  if (!v || v === "DRAFT") return "Belum";
  if (["U-1", "U1", "B", "BAIK"].includes(v)) return "B";
  if (["U-2", "U2", "C", "CUKUP"].includes(v)) return "C";
  if (["K1"].includes(v)) return "K1";
  if (["K2"].includes(v)) return "K2";
  if (["TH", "TMS", "TIDAK MEMENUHI SYARAT"].includes(v)) return "TMS";
  if (["MS", "MEMENUHI SYARAT"].includes(v)) return "MS";
  if (v === "SUBMITTED") return "Submitted";
  return value?.toString() || "Belum";
}

function worstClassification(values: (string | null | undefined)[]): string {
  const mapped = values.map((v) => normalizeClassification(v)).filter((v) => CLASS_ORDER.includes(v as any));
  if (!mapped.length) return "Belum";
  return mapped.sort((a, b) => CLASS_ORDER.indexOf(b as any) - CLASS_ORDER.indexOf(a as any))[0];
}

export function getSectionClassificationLocal(examId: string, sectionKey: string): string {
  const db = getDb();
  const canonical = normalizeSectionKey(sectionKey);
  const sectionRows = (db.exam_sections as AnyRec[]).filter((s) => s.exam_id === examId && normalizeSectionKey(s.section_key) === canonical);
  const section = sectionRows[0];
  const status = normalizeSectionStatus(section?.section_status);

  const candidates = [
    section?.classification,
    section?.form_data_json?.classification,
    section?.form_data_json?.qualification,
    section?.form_data_json?.result,
  ];

  const childName = CHILD_BY_SECTION[canonical];
  if (childName) {
    const childRows = (db[childName] as AnyRec[]).filter((r) => r.exam_id === examId);
    for (const child of childRows) {
      candidates.push(child?.classification, child?.qualification, child?.result, child?.form_data_json?.classification, child?.form_data_json?.qualification);
    }
  }

  const normalized = candidates.map((v) => normalizeClassification(v)).find((v) => !["Belum", "Submitted"].includes(v));
  if (normalized) return normalized;
  if (isSectionCompleted(status)) return "Submitted";
  if (status === "Optional" || (canonical === "neurologi" && !db.settings?.neuro_required)) return "Opsional";
  return "Belum";
}

function getHeightWeightForExam(db: ReturnType<typeof getDb>, examId: string, candidate: AnyRec) {
  const sectionRows = (db.exam_sections as AnyRec[]).filter((s) => s.exam_id === examId);
  const fromSection = (key: string) => sectionRows.find((s) => normalizeSectionKey(s.section_key) === key)?.form_data_json || {};
  const scr = fromSection("screening_hari_h");
  const umum = fromSection("pemeriksaan_umum");
  const height = Number(scr.height_cm ?? umum.height_cm ?? candidate?.height_cm ?? 0) || null;
  const weight = Number(scr.weight_kg ?? umum.weight_kg ?? candidate?.weight_kg ?? 0) || null;
  const bmi = Number(scr.bmi ?? umum.bmi ?? 0) || (height && weight ? Number((weight / ((height / 100) ** 2)).toFixed(2)) : null);
  return { height, weight, bmi };
}

export function calculateKesumLocal(examId: string): string {
  const db = getDb();
  const mandatory = ["pemeriksaan_umum", "ekg", "rontgen", "laboratorium", "tht", "bedah", "mata_visus", "gigi"];
  const withNeuro = db.settings?.neuro_required ? [...mandatory, "neurologi"] : mandatory;
  const vals = withNeuro.map((k) => getSectionClassificationLocal(examId, k));
  if (vals.some((v) => v === "Belum")) return "In Progress";
  return worstClassification(vals);
}

export function calculateFinalResultLocal(examId: string): { hasil_akhir: string; penentuan_kelulusan: string } {
  const db = getDb();
  const exam = (db.exams as AnyRec[]).find((e) => e.id === examId);
  const kesum = normalizeClassification(exam?.kesum_classification || calculateKesumLocal(examId));
  const keswa = normalizeClassification(exam?.keswa_status || getSectionClassificationLocal(examId, "jiwa_keswa"));
  const override = normalizeClassification(exam?.final_result);
  const finalResult = override !== "Belum" ? override : (kesum === "TMS" || keswa === "TMS" ? "TMS" : (kesum === "In Progress" || keswa === "Belum" ? "In Progress" : "MS"));
  const graduation = exam?.graduation_decision ?? (finalResult === "In Progress" ? (exam?.exam_status ?? "In Progress") : finalResult);
  return { hasil_akhir: finalResult, penentuan_kelulusan: graduation };
}

export function buildRekapAplikasiRowLocal(candidateId: string, examId: string) {
  const db = getDb();
  const candidate = (db.candidates as AnyRec[]).find((c) => c.id === candidateId);
  const exam = (db.exams as AnyRec[]).find((e) => e.id === examId);
  if (!candidate || !exam) return null;
  const { height, weight, bmi } = getHeightWeightForExam(db, examId, candidate);
  const kesum = normalizeClassification(exam.kesum_classification || calculateKesumLocal(examId));
  const keswaCls = getSectionClassificationLocal(examId, "jiwa_keswa");
  const final = calculateFinalResultLocal(examId);
  return {
    id: `rekap_${examId}`,
    urt: candidate.serial_number ?? candidate.sort_order ?? "-",
    tes: candidate.test_number || candidate.temporary_id || "-",
    pok: candidate.pok_korp || candidate.group_name || candidate.class_group || "-",
    panda: candidate.panda || candidate.pnd_code || candidate.origin_panda || "-",
    identity_display: `${candidate.full_name || "-"}\n${candidate.rank || "-"} / ${candidate.nrp_nip || "-"}\n${candidate.unit_position || candidate.unit || "-"}`,
    exam_status: exam.exam_status || exam.hari_h_stage || "Draft",
    tb_bb: height && weight ? `${height} / ${weight}` : "* / -",
    bmi: bmi ? Number(bmi).toFixed(2) : "-",
    klasifikasi_umum: getSectionClassificationLocal(examId, "pemeriksaan_umum"),
    klasifikasi_ekg: getSectionClassificationLocal(examId, "ekg"),
    klasifikasi_radiologi: getSectionClassificationLocal(examId, "rontgen"),
    klasifikasi_neurologi: getSectionClassificationLocal(examId, "neurologi"),
    klasifikasi_lab: getSectionClassificationLocal(examId, "laboratorium"),
    klasifikasi_tht: getSectionClassificationLocal(examId, "tht"),
    klasifikasi_bedah: getSectionClassificationLocal(examId, "bedah"),
    klasifikasi_mata: getSectionClassificationLocal(examId, "mata_visus"),
    klasifikasi_gigi: getSectionClassificationLocal(examId, "gigi"),
    klasifikasi_keswa: keswaCls,
    kesum,
    keswa: normalizeClassification(exam.keswa_status || keswaCls),
    hasil_akhir: final.hasil_akhir,
    nilai: exam.final_score ?? "-",
    penentuan_kelulusan: final.penentuan_kelulusan,
    progress_percentage: exam.progress_percentage ?? 0,
    candidate_id: candidate.id,
    exam_id: exam.id,
    selection_id: exam.selection_id,
    updated_at: nowIso(),
  };
}

export function refreshRekapAplikasiRowLocal(candidateId: string, examId: string) {
  const db = getDb();
  const row = buildRekapAplikasiRowLocal(candidateId, examId);
  if (!row) return null;
  if (!Array.isArray((db as any).rekap_aplikasi_rows)) (db as any).rekap_aplikasi_rows = [];
  const rows = (db as any).rekap_aplikasi_rows as AnyRec[];
  const idx = rows.findIndex((r) => r.exam_id === examId && r.candidate_id === candidateId);
  if (idx >= 0) rows[idx] = { ...rows[idx], ...row, updated_at: nowIso() }; else rows.push(row);
  const exam = (db.exams as AnyRec[]).find((e) => e.id === examId);
  if (exam) {
    exam.kesum_classification = row.kesum;
    exam.keswa_status = row.keswa;
    exam.final_result = row.hasil_akhir;
    exam.graduation_decision = row.penentuan_kelulusan;
    exam.progress_percentage = row.progress_percentage;
    exam.updated_at = nowIso();
  }
  db.audit_logs.push({ id: generateId("audit"), user_id: db.auth.current_user_id, role: db.auth.current_role, action: "refresh_rekap_aplikasi_row_local", module: "Rekap Aplikasi Local", candidate_id: candidateId, exam_id: examId, selection_id: row.selection_id, before_data_json: null, after_data_json: row, created_at: nowIso() });
  localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
  return row;
}
