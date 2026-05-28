import { supabase } from "@/integrations/supabase/client";
import { getDb, saveDb } from "@/lib/localDb";
import { isLocalMode } from "@/lib/storage-mode";

export async function listNotifications(userId: string) {
  if (isLocalMode) {
    const db = getDb() as any;
    if (!Array.isArray(db.notifications)) { db.notifications = []; saveDb(db); }
    return (db.notifications ?? []).filter((n: any) => n.user_id === userId || n.user_id === "all").sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 20);
  }
  const { data, error } = await supabase.from("notifications").select("id,type,title,body,link_url,read_at,created_at,metadata").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  if (error) throw error;
  return data ?? [];
}
