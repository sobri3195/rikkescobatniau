import { getDb } from "@/lib/localDb";
import { buildParticipantRowLocal } from "@/lib/services/participantRowService";
import { recomputeHariHStage } from "@/lib/hari-h-stage";

export function buildHariHQueueRowsLocal() {
  const db = getDb();

  return (db.candidates ?? [])
    .filter((candidate: any) => !candidate.is_deleted && !candidate.deleted_at)
    .map((candidate: any) => buildParticipantRowLocal(candidate, db));
}

export function getHariHColumnLocal(participant: any) {
  return participant?.hari_h_stage ?? participant?.exam?.hari_h_stage ?? "Registrasi Awal";
}

export async function refreshHariHStagesLocal(participants: any[]) {
  await Promise.all(
    (participants ?? [])
      .map((participant: any) => participant?.exam_id)
      .filter(Boolean)
      .slice(0, 50)
      .map((examId: string) => recomputeHariHStage(examId)),
  );
  return buildHariHQueueRowsLocal();
}
