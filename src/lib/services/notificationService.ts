import { getDb, saveDb, getLocalSession } from "@/lib/localDb";

export async function listNotifications(userId: string) {
  const db = getDb() as any;
  if (!Array.isArray(db.notifications)) { db.notifications = []; saveDb(db); }
  const session = getLocalSession() as any;
  const role = session?.role;
  return (db.notifications ?? [])
    .filter((n: any) => n.user_id === userId || n.user_id === "all" || (role && n.role_target === role))
    .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 20);
}
