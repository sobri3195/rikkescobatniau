import { useEffect, useState } from "react";
import { LOCAL_SESSION_KEY, getDb } from "@/lib/localDb";

export interface AuthState { user: any | null; session: any | null; loading: boolean; roles: string[]; }

export function useAuth(): AuthState & { signOut: () => Promise<void>; hasRole: (r: string) => boolean; hasAnyRole: (rs: string[]) => boolean; } {
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);
  useEffect(() => { try { const raw = localStorage.getItem(LOCAL_SESSION_KEY); if (raw) { const s = JSON.parse(raw); const u = getDb().users.find((x: any) => x.id === s.user_id); setSession({ user: u }); setRoles([s.role ?? u?.role ?? "viewer"]); } } finally { setLoading(false); } }, []);
  return { user: session?.user ?? null, session, loading, roles, signOut: async () => { localStorage.removeItem(LOCAL_SESSION_KEY); setSession(null); setRoles([]); window.location.href = "/login"; }, hasRole: (r)=>roles.includes(r), hasAnyRole:(rs)=>rs.some(r=>roles.includes(r)) };
}
