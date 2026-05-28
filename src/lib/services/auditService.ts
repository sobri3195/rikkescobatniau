import { generateId, getDb, getLocalSession, nowIso, saveDb } from "@/lib/localDb";

export function addAuditLogLocal(action: string, payload: Record<string, any> = {}) {
  const db = getDb() as any;
  const session = getLocalSession();
  db.audit_logs = db.audit_logs ?? [];
  db.audit_logs.push({
    id: generateId("audit"),
    action,
    module: payload.module ?? "localDb",
    user_id: session?.user_id ?? "system_local",
    role: session?.role ?? "system",
    ...payload,
    created_at: nowIso(),
  });
  saveDb(db);
}
