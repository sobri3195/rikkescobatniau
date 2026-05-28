import { getDb } from "@/lib/localDb";
import { buildParticipantRowLocal } from "@/lib/services/participantRowService";

export function buildHariHQueueRowsLocal() {
  const db = getDb();

  return (db.candidates ?? [])
    .filter((candidate: any) => !candidate.is_deleted && !candidate.deleted_at)
    .map((candidate: any) => buildParticipantRowLocal(candidate, db));
}
