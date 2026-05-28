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

export async function markNotificationAsRead(id: string, readAt: string) {
  const db = getDb() as any;
  const row = (db.notifications ?? []).find((n: any) => n.id === id);
  if (!row) return null;
  row.read_at = readAt;
  saveDb(db);
  return row;
}

export async function markAllNotificationsAsRead(userId: string, readAt: string) {
  const db = getDb() as any;
  (db.notifications ?? []).forEach((n: any) => {
    if (n.user_id === userId && !n.read_at) n.read_at = readAt;
  });
  saveDb(db);
}
