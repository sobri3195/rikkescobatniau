import { supabase } from "@/integrations/supabase/client";
import type { SelectionCardData } from "@/components/selection/SelectionCard";

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

/**
 * Ambil daftar seleksi + ringkasan progress agregat per seleksi.
 * Hanya pakai data yang sudah dihitung trigger (`exams.hari_h_stage`, `progress_percentage`, `exam_status`).
 * 1x query exams + 1x query selections — agregasi di sisi client (jumlah seleksi puluhan, jumlah peserta ratusan→ribuan).
 */
export async function fetchSelectionsWithStats(): Promise<{
  selections: SelectionCardData[];
  summary: DashboardSummary;
}> {
  const [sels, ex] = await Promise.all([
    supabase
      .from("selections")
      .select("id,name,year_label,participant_label,location,status,is_default,institution_header_line_1,institution_header_line_2")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("exams")
      .select("id,selection_id,exam_status,hari_h_stage,progress_percentage"),
  ]);

  if (sels.error) throw sels.error;
  if (ex.error) throw ex.error;

  const exams = (ex.data ?? []) as Array<{
    id: string;
    selection_id: string | null;
    exam_status: string | null;
    hari_h_stage: string | null;
    progress_percentage: number | null;
  }>;

  // Group by selection
  const bySel = new Map<string, typeof exams>();
  for (const e of exams) {
    if (!e.selection_id) continue;
    const arr = bySel.get(e.selection_id) ?? [];
    arr.push(e);
    bySel.set(e.selection_id, arr);
  }

  const cards: SelectionCardData[] = (sels.data ?? []).map((s: any) => {
    const list = bySel.get(s.id) ?? [];
    const total = list.length;
    const progSum = list.reduce((a, b) => a + (b.progress_percentage ?? 0), 0);
    const stage = (st: string) => list.filter((x) => (x.hari_h_stage ?? "") === st).length;
    const finalized = list.filter((x) => x.exam_status === "Finalized").length;
    const inProgress = list.filter((x) => x.exam_status === "In Progress" || x.exam_status === "Pending Review").length;
    const incomplete = list.filter((x) => (x.progress_percentage ?? 0) < 50 && x.exam_status !== "Finalized").length;
    return {
      ...s,
      stats: {
        total_candidates: total,
        progress_avg: total > 0 ? progSum / total : 0,
        finalized,
        in_progress: inProgress,
        incomplete,
        waiting_ekg: stage("Menunggu EKG") + stage("Menunggu Rontgen & EKG"),
        waiting_rontgen: stage("Menunggu Rontgen") + stage("Menunggu Rontgen & EKG"),
        screening: stage("Screening Hari-H"),
        subteam: stage("Pemeriksaan Subtim"),
        review: stage("Review"),
        not_started: stage("Registrasi Awal"),
      },
    };
  });

  const activeCards = cards.filter((c) => (c.status ?? "").toLowerCase() === "aktif");
  const sum = (k: keyof NonNullable<SelectionCardData["stats"]>) =>
    activeCards.reduce((a, c) => a + (c.stats?.[k] ?? 0), 0);

  return {
    selections: cards,
    summary: {
      totalSelectionsActive: activeCards.length,
      totalCandidates: sum("total_candidates"),
      inProgress: sum("in_progress"),
      finalized: sum("finalized"),
      waitingEkg: sum("waiting_ekg"),
      waitingRontgen: sum("waiting_rontgen"),
      screening: sum("screening"),
      subteam: sum("subteam"),
      review: sum("review"),
      incomplete: sum("incomplete"),
    },
  };
}