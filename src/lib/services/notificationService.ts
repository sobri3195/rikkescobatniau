import { generateId, getDb, saveDb, getLocalSession, nowIso } from "@/lib/localDb";
import { emitLocalDbChanged } from "@/lib/services/syncService";

type NotificationInput = {
  user_id?: string | null;
  role_target?: string | null;
  title: string;
  body?: string;
  module?: string;
  action?: string;
  candidate_id?: string | null;
  exam_id?: string | null;
  section_key?: string | null;
  data_json?: any;
};

export function createNotificationLocal(input: NotificationInput) {
  const db = getDb() as any;
  const session = getLocalSession() as any;
  db.notifications = Array.isArray(db.notifications) ? db.notifications : [];
  const row = {
    id: generateId("notif"),
    user_id: input.user_id ?? "all",
    role_target: input.role_target ?? null,
    title: input.title,
    body: input.body ?? "",
    module: input.module ?? "workflow",
    action: input.action ?? null,
    candidate_id: input.candidate_id ?? null,
    exam_id: input.exam_id ?? null,
    section_key: input.section_key ?? null,
    data_json: input.data_json ?? null,
    created_by: session?.user_id ?? db.auth?.current_user_id ?? "system_local",
    created_at: nowIso(),
    read_at: null,
  };
  db.notifications.push(row);
  saveDb(db);
  emitLocalDbChanged("notification_created");
  return row;
}

export function listNotificationsLocal(userId?: string | null, role?: string | null) {
  const db = getDb() as any;
  if (!Array.isArray(db.notifications)) {
    db.notifications = [];
    saveDb(db);
  }
  const session = getLocalSession() as any;
  const effectiveUser = userId ?? session?.user_id ?? db.auth?.current_user_id ?? null;
  const effectiveRole = role ?? session?.role ?? db.auth?.current_role ?? null;
  return (db.notifications ?? [])
    .filter(
      (n: any) =>
        n.user_id === "all" ||
        !n.user_id ||
        n.user_id === effectiveUser ||
        (effectiveRole && n.role_target === effectiveRole),
    )
    .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));
}

export function markNotificationReadLocal(notificationId: string, readAt = nowIso()) {
  const db = getDb() as any;
  const row = (db.notifications ?? []).find((n: any) => n.id === notificationId);
  if (!row) return null;
  row.read_at = readAt;
  saveDb(db);
  emitLocalDbChanged("notification_read");
  return row;
}

export async function listNotifications(userId: string) {
  return listNotificationsLocal(userId).slice(0, 20);
}

export async function markNotificationAsRead(id: string, readAt: string) {
  return markNotificationReadLocal(id, readAt);
}

export async function markAllNotificationsAsRead(userId: string, readAt: string) {
  const db = getDb() as any;
  (db.notifications ?? []).forEach((n: any) => {
    if ((n.user_id === userId || n.user_id === "all") && !n.read_at) n.read_at = readAt;
  });
  saveDb(db);
  emitLocalDbChanged("notifications_read");
}
