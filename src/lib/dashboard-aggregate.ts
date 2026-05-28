import type { SelectionCardData } from "@/components/selection/SelectionCard";
import { exportLocalDb, getDb, migrateLocalDb, nowIso, repairLocalDbRelations, saveDb } from "@/lib/localDb";

export type DashboardSummary = {
  totalSelectionsActive: number;
  totalCandidates: number;
  inProgress: number;
  finalized: number;
  waitingEkg: number;
  waitingRontgen: number;
  screening: number;
  subteam: number;
  review: number;
  incomplete: number;
};

export type DashboardDebugInfo = {
  localStorageKeyExists: boolean;
  totalSelections: number;
  activeSelections: number;
  totalCandidates: number;
  candidatesWithoutSelectionId: number;
  candidatesWithoutExam: number;
  totalExams: number;
  examsWithoutCandidate: number;
  totalExamSections: number;
  filteredSelectionsCount: number;
  prefilterSelectionsCount: number;
  warningMissingSelection: boolean;
};

export function isSelectionActive(selection: any) {
  const status = String(selection?.status ?? "active").trim().toLowerCase();
  return status === "active" || status === "aktif" || status === "ongoing" || status === "berjalan" || status === "";
}

const normalizeText = (value: any, fallback = "-") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const normalizeSelection = (selection: any): SelectionCardData => ({
  id: String(selection.id ?? ""),
  name: normalizeText(selection.selection_name ?? selection.name ?? selection.title),
  year_label: normalizeText(selection.year ?? selection.tahun ?? selection.academic_year),
  participant_label: normalizeText(selection.type ?? selection.selection_type ?? selection.category),
  location: normalizeText(selection.location ?? selection.lokasi ?? selection.panda),
  status: normalizeText(selection.status ?? "Aktif"),
  is_default: !!selection.is_default,
  institution_header_line_1: selection.institution_header_line_1,
  institution_header_line_2: selection.institution_header_line_2,
});

export function loadDashboardLocalDb() {
  migrateLocalDb();
  repairLocalDbRelations();
  const db = getDb() as any;

  const selectionsAll = (db.selections ?? []).filter((s: any) => !s?.is_deleted && String(s?.status ?? "").toLowerCase() !== "deleted");
  const selectionsActive = selectionsAll.filter(isSelectionActive).map(normalizeSelection).filter((s) => !!s.id && !!s.name);

  const activeCandidates = (db.candidates ?? []).filter((c: any) => !c?.is_deleted && !c?.deleted_at);
  const activeExams = (db.exams ?? []).filter((e: any) => !e?.is_deleted && !e?.deleted_at);

  const cards = selectionsActive.map((selection) => {
    const selectionCandidates = activeCandidates.filter((candidate: any) => candidate.selection_id === selection.id);
    const selectionExams = activeExams.filter((exam: any) => selectionCandidates.some((candidate: any) => candidate.id === exam.candidate_id));
    const total = selectionCandidates.length;
    const progressSum = selectionExams.reduce((acc: number, exam: any) => acc + Number(exam.progress_percentage ?? 0), 0);
    const finalized = selectionExams.filter((exam: any) => String(exam.exam_status ?? "") === "Finalized").length;
    const inProgress = selectionExams.filter((exam: any) => String(exam.exam_status ?? "") !== "Finalized").length;
    const waitingEkg = selectionExams.filter((exam: any) => String(exam.ekg_initial_status ?? "").toLowerCase() === "belum").length;
    const waitingRontgen = selectionExams.filter((exam: any) => String(exam.radiology_initial_status ?? "").toLowerCase() === "belum").length;
    const screening = selectionExams.filter((exam: any) => String(exam.hari_h_stage ?? "").toLowerCase().includes("screening")).length;
    const subteam = selectionExams.filter((exam: any) => String(exam.hari_h_stage ?? "").toLowerCase().includes("subtim")).length;
    const review = selectionExams.filter((exam: any) => String(exam.exam_status ?? "").toLowerCase().includes("review")).length;
    const incomplete = selectionExams.filter((exam: any) => Number(exam.progress_percentage ?? 0) < 100).length;

    return {
      ...selection,
      stats: {
        total_candidates: total,
        progress_avg: total ? progressSum / total : 0,
        finalized,
        in_progress: inProgress,
        incomplete,
        waiting_ekg: waitingEkg,
        waiting_rontgen: waitingRontgen,
        screening,
        subteam,
        review,
        not_started: selectionExams.filter((exam: any) => String(exam.hari_h_stage ?? "").toLowerCase().includes("registrasi")).length,
      },
    };
  });

  const sum = (key: keyof NonNullable<SelectionCardData["stats"]>) => cards.reduce((acc, card) => acc + Number(card.stats?.[key] ?? 0), 0);
  const candidatesWithoutSelectionId = activeCandidates.filter((candidate: any) => !candidate.selection_id).length;
  const candidatesWithoutExam = activeCandidates.filter((candidate: any) => !activeExams.some((exam: any) => exam.candidate_id === candidate.id)).length;
  const examsWithoutCandidate = activeExams.filter((exam: any) => !activeCandidates.some((candidate: any) => candidate.id === exam.candidate_id)).length;

  return {
    selections: cards,
    summary: {
      totalSelectionsActive: cards.length,
      totalCandidates: activeCandidates.length,
      inProgress: sum("in_progress"),
      finalized: sum("finalized"),
      waitingEkg: sum("waiting_ekg"),
      waitingRontgen: sum("waiting_rontgen"),
      screening: sum("screening"),
      subteam: sum("subteam"),
      review: sum("review"),
      incomplete: sum("incomplete"),
    } as DashboardSummary,
    debug: {
      localStorageKeyExists: typeof window !== "undefined" ? window.localStorage.getItem("rikkes_tni_au_local_db_v1") !== null : false,
      totalSelections: selectionsAll.length,
      activeSelections: cards.length,
      totalCandidates: activeCandidates.length,
      candidatesWithoutSelectionId,
      candidatesWithoutExam,
      totalExams: activeExams.length,
      examsWithoutCandidate,
      totalExamSections: (db.exam_sections ?? []).length,
      filteredSelectionsCount: cards.length,
      prefilterSelectionsCount: selectionsAll.length,
      warningMissingSelection: selectionsAll.length === 0 && activeCandidates.some((candidate: any) => !!candidate.selection_id),
    } as DashboardDebugInfo,
  };
}

export function runDashboardMigrationAndRepair() {
  migrateLocalDb();
  repairLocalDbRelations();
  const db = getDb();
  db.meta = { ...(db.meta ?? {}), updated_at: nowIso() };
  saveDb(db as any);
}

export function exportLocalDbJson() {
  return exportLocalDb();
}
