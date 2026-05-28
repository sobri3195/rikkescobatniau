import { supabaseAdmin } from "@/lib/local-supabase-shim.server";
import { computeBmi } from "@/lib/sections";
import type { CandidateProgress, ProgressItem, ProgressItemStatus } from "@/lib/candidate-progress";

const DASHBOARD_ROLES = new Set([
  "super_admin",
  "admin",
  "tester",
  "viewer",
  "pimpinan_viewer",
  "viewer_progress",
  "registrasi",
  "kepala_sub_tim",
  "dokter",
  "dokter_umum",
  "dokter_spesialis",
  "dokter_gigi",
  "radiologi",
  "lab",
  "dirbindukkes",
  "kapuskesau",
]);

const CLEARED_SET = new Set(["Cleared", "Submitted", "Approved", "Locked"]);

function progressDetailStatus(rawStatus: unknown): ProgressItemStatus {
  const status = String(rawStatus ?? "");
  if (status === "completed") return "selesai";
  if (status === "in_progress") return "berjalan";
  if (status === "warning") return "revised";
  return "belum";
}

export function assertCanViewDashboardProgress(roles: string[]) {
  const hasKnownProgressRole = roles.some((role) => DASHBOARD_ROLES.has(role));
  const hasInternalRole = roles.some((role) => role !== "peserta" && role !== "casis");
  if (!hasKnownProgressRole && !hasInternalRole) {
    throw new Error("403: Anda tidak berhak melihat dashboard monitoring seleksi.");
  }
}

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

export async function getRolesForUser(supabase: any, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => row.role as string);
}

export async function getSelectionParticipantsProgressServer(data: {
  selectionId: string;
  search: string;
  status: string;
  progress: "all" | "0-25" | "26-50" | "51-75" | "76-99" | "100";
  dateFrom?: string | null;
  dateTo?: string | null;
  page: number;
  pageSize: number;
  sort?: "newest" | "oldest" | "name_asc" | "name_desc" | "progress_desc" | "progress_asc";
}) {
  const { data: selection, error: selErr } = await supabaseAdmin
    .from("selections")
    .select("id,name,year_label,participant_label,location,status")
    .eq("id", data.selectionId)
    .maybeSingle();
  if (selErr) throw new Error(selErr.message);
  if (!selection) throw new Error("Seleksi tidak ditemukan.");

  const progressRange = (() => {
    if (data.progress === "0-25") return { min: 0, max: 25 };
    if (data.progress === "26-50") return { min: 26, max: 50 };
    if (data.progress === "51-75") return { min: 51, max: 75 };
    if (data.progress === "76-99") return { min: 76, max: 99 };
    if (data.progress === "100") return { min: 100, max: 100 };
    return null;
  })();

  let candidateQuery = supabaseAdmin
    .from("candidates")
    .select(`
      id,full_name,test_number,temporary_id,rank,nrp_nip,unit_position,pok_korp,group_name,created_at,
      exams!inner(id,candidate_id,exam_status,hari_h_stage,progress_percentage,progress_completed_count,progress_total_count,ekg_initial_status,radiology_initial_status,selection_id)
    `, { count: "exact" })
    .eq("selection_id", data.selectionId)
    .is("deleted_at", null)
    .eq("exams.selection_id", data.selectionId);

  const q = data.search.trim().replace(/[%_,]/g, "");
  if (q) {
    candidateQuery = candidateQuery.or(`full_name.ilike.%${q}%,test_number.ilike.%${q}%,temporary_id.ilike.%${q}%,nrp_nip.ilike.%${q}%,unit_position.ilike.%${q}%`);
  }
  if (data.dateFrom) candidateQuery = candidateQuery.gte("created_at", data.dateFrom);
  if (data.dateTo) candidateQuery = candidateQuery.lte("created_at", `${data.dateTo}T23:59:59.999Z`);
  if (data.status !== "all") {
    if (data.status === "incomplete") {
      candidateQuery = candidateQuery.lt("exams.progress_percentage", 100).neq("exams.exam_status", "Finalized");
    } else {
      candidateQuery = candidateQuery.eq("exams.exam_status", data.status);
    }
  }
  if (progressRange) {
    candidateQuery = candidateQuery.gte("exams.progress_percentage", progressRange.min).lte("exams.progress_percentage", progressRange.max);
  }

  const pageStart = (data.page - 1) * data.pageSize;
  const sort = data.sort ?? "newest";
  if (sort === "progress_desc" || sort === "progress_asc") {
    candidateQuery = candidateQuery.order("progress_percentage", { foreignTable: "exams", ascending: sort === "progress_asc" });
  } else if (sort === "name_asc") {
    candidateQuery = candidateQuery.order("full_name", { ascending: true });
  } else if (sort === "name_desc") {
    candidateQuery = candidateQuery.order("full_name", { ascending: false });
  } else if (sort === "oldest") {
    candidateQuery = candidateQuery.order("created_at", { ascending: true });
  } else {
    candidateQuery = candidateQuery.order("created_at", { ascending: false });
  }
  const { data: pageRows, error: candErr, count: totalFiltered } = await candidateQuery
    .range(pageStart, pageStart + data.pageSize - 1);
  if (candErr) throw new Error(candErr.message);

  const pickExam = (candidate: any) => Array.isArray(candidate.exams) ? candidate.exams[0] ?? null : candidate.exams ?? null;
  // Card menampilkan completed/total dari DB (compute_exam_progress) — sumber yang sama
  // dipakai popover rincian progress sehingga angka konsisten.
  const rows = (pageRows ?? []).map((candidate: any) => {
    const exam: any = pickExam(candidate);
    const { exams: _exams, ...cleanCandidate } = candidate;
    const total = exam?.progress_total_count ?? 0;
    const completed = exam?.progress_completed_count ?? 0;
    return {
      ...cleanCandidate,
      pok_group: candidate.group_name ?? candidate.pok_korp ?? null,
      exam,
      completed,
      total,
    };
  });

  const { data: statsCandidates, error: statsErr, count: totalCandidates } = await supabaseAdmin
    .from("candidates")
    .select(`
      id,
      exams!inner(id,candidate_id,exam_status,hari_h_stage,progress_percentage,ekg_initial_status,radiology_initial_status,selection_id)
    `, { count: "exact" })
    .eq("selection_id", data.selectionId)
    .is("deleted_at", null)
    .eq("exams.selection_id", data.selectionId)
    .range(0, 99999);
  if (statsErr) throw new Error(statsErr.message);

  const statsRows = ((statsCandidates ?? []) as any[]).map((candidate) => pickExam(candidate));
  const stage = (name: string) => statsRows.filter((exam: any) => (exam?.hari_h_stage ?? "") === name).length;
  const pct = (e: any) => Number(e?.progress_percentage ?? 0);
  const avgProgress = statsRows.length > 0
    ? Math.round(statsRows.reduce((s: number, e: any) => s + pct(e), 0) / statsRows.length)
    : 0;
  const peserta0 = statsRows.filter((e: any) => pct(e) === 0).length;
  const p1to50 = statsRows.filter((e: any) => pct(e) > 0 && pct(e) <= 50).length;
  const pOver50 = statsRows.filter((e: any) => pct(e) > 50 && pct(e) < 100).length;
  const pendingReview = statsRows.filter((e: any) => e?.exam_status === "Pending Review" || e?.exam_status === "Submitted").length;
  return {
    selection,
    rows,
    totalFiltered: totalFiltered ?? rows.length,
    page: data.page,
    pageSize: data.pageSize,
    stats: {
      total: totalCandidates ?? statsRows.length,
      finalized: statsRows.filter((exam: any) => exam?.exam_status === "Finalized").length,
      inProgress: statsRows.filter((exam: any) => exam?.exam_status === "In Progress" || exam?.exam_status === "Pending Review").length,
      incomplete: statsRows.filter((exam: any) => (exam?.progress_percentage ?? 0) < 100 && exam?.exam_status !== "Finalized").length,
      waitingEkg: stage("Menunggu EKG") + stage("Menunggu Rontgen & EKG"),
      waitingRo: stage("Menunggu Rontgen") + stage("Menunggu Rontgen & EKG"),
      screening: stage("Screening Hari-H"),
      subteam: stage("Pemeriksaan Subtim"),
      avgProgress,
      peserta0,
      p1to50,
      pOver50,
      pendingReview,
    },
  };
}

export async function getCandidateProgressServer(candidateId: string): Promise<CandidateProgress> {
  const [{ data: cand }, { data: exam }] = await Promise.all([
    supabaseAdmin
      .from("candidates")
      .select("id, test_number, temporary_id")
      .eq("id", candidateId)
      .maybeSingle(),
    supabaseAdmin
      .from("exams")
      .select("id, exam_status, ekg_initial_status, radiology_initial_status, progress_percentage, progress_completed_count, progress_total_count, progress_detail_json, progress_last_calculated_at")
      .eq("candidate_id", candidateId)
      .maybeSingle(),
  ]);

  const examId = exam?.id ?? null;
  const items: ProgressItem[] = [];

  if (!examId) {
    return { candidate_id: candidateId, exam_id: null, items, percent: 0, computed_at: new Date().toISOString() };
  }

  const examRow = exam as any;
  const progressDetail = examRow.progress_detail_json as any;
  if (Array.isArray(progressDetail?.items) && progressDetail.items.length > 0) {
    const detailItems: ProgressItem[] = progressDetail.items.map((raw: any) => {
      const rawStatus = String(raw?.status ?? "pending");
      const key = String(raw?.key ?? "progress_item");
      const status = progressDetailStatus(rawStatus);
      return {
        item_key: key,
        label: String(raw?.label ?? key),
        status: examRow.exam_status === "Finalized" && status === "selesai" ? "finalized" : status,
        completed: rawStatus === "completed",
        source_section: `exams.progress_detail_json.${key}`,
        updated_at: examRow.progress_last_calculated_at ?? null,
        submitted_at: null,
      };
    });
    return {
      candidate_id: candidateId,
      exam_id: examId,
      items: detailItems,
      percent: Math.round(examRow.progress_percentage ?? progressDetail?.percentage ?? 0),
      computed_at: new Date().toISOString(),
    };
  }

  const [{ data: gen }, { data: mm }, { data: rikkesSections }, { data: examSections }] = await Promise.all([
    supabaseAdmin
      .from("exam_general")
      .select("height_cm, weight_kg, anamnesis, screening_classification, status, updated_at")
      .eq("exam_id", examId)
      .maybeSingle(),
    supabaseAdmin
      .from("medical_measurements")
      .select("chest_or_waist_lp, bmi, height_cm, weight_kg, updated_at")
      .eq("exam_id", examId)
      .maybeSingle(),
    supabaseAdmin
      .from("rikkes_form_sections")
      .select("group_key, status, submitted_at, updated_at, form_data_json")
      .eq("exam_id", examId),
    supabaseAdmin
      .from("exam_sections")
      .select("section_key, section_status, submitted_at, updated_at")
      .eq("exam_id", examId),
  ]);

  const rikkesByKey = new Map<string, any>();
  (rikkesSections ?? []).forEach((r: any) => rikkesByKey.set(r.group_key, r));
  const examByKey = new Map<string, any>();
  (examSections ?? []).forEach((r: any) => examByKey.set(r.section_key, r));

  const idSection = examByKey.get("identitas");
  items.push(makeItem("identitas", "Identitas Minimal", statusFromSection(idSection?.section_status, idSection?.submitted_at), "exam_sections.identitas", idSection?.updated_at ?? null, idSection?.submitted_at ?? null));
  const hasTestNumber = !!cand?.test_number && !cand.test_number.startsWith("T-");
  items.push(makeItem("no_test_final", "No Test Final", hasTestNumber ? "selesai" : (cand?.temporary_id ? "berjalan" : "belum"), "candidates.test_number"));
  const roStatus = exam?.radiology_initial_status ?? "";
  items.push(makeItem("rontgen", "Rontgen", CLEARED_SET.has(roStatus) ? "selesai" : (roStatus && roStatus !== "Belum Diisi" ? "berjalan" : "belum"), "exams.radiology_initial_status"));
  const ekgStatus = exam?.ekg_initial_status ?? "";
  items.push(makeItem("ekg", "EKG / Jantung", CLEARED_SET.has(ekgStatus) ? "selesai" : (ekgStatus && ekgStatus !== "Belum Diisi" ? "berjalan" : "belum"), "exams.ekg_initial_status"));

  const anamSection = examByKey.get("anamnesa");
  const anamFromGeneral = valueDone(gen?.anamnesis);
  const anamStatus: ProgressItemStatus = anamSection?.submitted_at || anamSection?.section_status === "Submitted" ? "selesai" : anamFromGeneral ? "berjalan" : "belum";
  items.push(makeItem("anamnesis", "Anamnesis", anamStatus, "exam_sections.anamnesa", anamSection?.updated_at ?? gen?.updated_at ?? null, anamSection?.submitted_at ?? null));

  const tb = gen?.height_cm ?? mm?.height_cm ?? null;
  const bb = gen?.weight_kg ?? mm?.weight_kg ?? null;
  const lp = mm?.chest_or_waist_lp ?? null;
  const imt = mm?.bmi ?? computeBmi(tb as number | null, bb as number | null);
  items.push(makeItem("tb", "Tinggi Badan", valueDone(tb) ? "selesai" : "belum", "exam_general.height_cm", gen?.updated_at ?? null));
  items.push(makeItem("bb", "Berat Badan", valueDone(bb) ? "selesai" : "belum", "exam_general.weight_kg", gen?.updated_at ?? null));
  items.push(makeItem("lp", "Lingkar Perut", valueDone(lp) ? "selesai" : "belum", "medical_measurements.chest_or_waist_lp", mm?.updated_at ?? null));
  items.push(makeItem("imt", "IMT", valueDone(tb) && valueDone(bb) && valueDone(imt) ? "selesai" : "belum", "computed(tb,bb)", mm?.updated_at ?? gen?.updated_at ?? null));
  const cls = (gen?.screening_classification ?? "").toString();
  items.push(makeItem("klasifikasi_screening", "Klasifikasi Juknis", ["B", "C", "K1", "K2"].includes(cls) ? "selesai" : "belum", "exam_general.screening_classification", gen?.updated_at ?? null));

  function sectionItem(item_key: string, label: string, rikkesKey: string, legacyKeys: string[] = []): ProgressItem {
    const r = rikkesByKey.get(rikkesKey);
    if (r) return makeItem(item_key, label, statusFromSection(r.status, r.submitted_at), `rikkes_form_sections.${rikkesKey}`, r.updated_at ?? null, r.submitted_at ?? null);
    for (const lk of legacyKeys) {
      const e = examByKey.get(lk);
      if (e) return makeItem(item_key, label, statusFromSection(e.section_status, e.submitted_at), `exam_sections.${lk}`, e.updated_at ?? null, e.submitted_at ?? null);
    }
    return makeItem(item_key, label, "belum", `rikkes_form_sections.${rikkesKey}`);
  }

  items.push(sectionItem("bedah", "Bedah", "bedah_subtim", ["bedah"]));
  items.push(sectionItem("ekg_ergo_section", "EKG/Ergo (Section)", "penunjang", ["ekg_ergo"]));
  items.push(sectionItem("gigi", "Gigi & Odontogram", "gigi_odontogram", ["gigi"]));
  items.push(sectionItem("penunjang", "Pemeriksaan Penunjang", "penunjang", ["radiologi_ro", "usg"]));
  items.push(sectionItem("mata", "Mata", "mata_visus_subtim", ["mata"]));
  items.push(sectionItem("tht", "THT", "tht_subtim", ["tht"]));
  items.push(sectionItem("neurologi", "Neurologi", "neurologi_subtim", ["neurologi"]));
  items.push(sectionItem("laboratorium", "Laboratorium", "laboratorium", ["laboratorium"]));
  items.push(sectionItem("keswa", "KESWA", "psikologi_subtim", ["jiwa_keswa"]));
  items.push(sectionItem("resume", "Resume & Rekomendasi", "resume_rekomendasi", ["resume_kesimpulan", "kualifikasi_akhir"]));

  if (exam?.exam_status === "Finalized") {
    items.forEach((it) => {
      if (it.status === "selesai") it.status = "finalized";
    });
  }

  // Persen kanonik berasal dari kolom DB (compute_exam_progress) agar konsisten
  // dengan persen yang ditampilkan kartu peserta di halaman progress.
  const percent = Math.round((exam as any)?.progress_percentage ?? 0);
  return { candidate_id: candidateId, exam_id: examId, items, percent, computed_at: new Date().toISOString() };
}