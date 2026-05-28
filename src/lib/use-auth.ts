import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: string[];
}

export function useAuth(): AuthState & {
  signOut: () => Promise<void>;
  hasRole: (r: string) => boolean;
  hasAnyRole: (rs: string[]) => boolean;
} {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    let currentUserId: string | null = null;
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      const nextUserId = s?.user?.id ?? null;
      if (!nextUserId) {
        currentUserId = null;
        setRoles([]);
        return;
      }
      // Only reload roles when user identity actually changes (SIGNED_IN / USER_UPDATED on different user).
      // Skip TOKEN_REFRESHED / INITIAL_SESSION for the same user — prevents role flicker.
      if (nextUserId !== currentUserId) {
        currentUserId = nextUserId;
        // Fire-and-forget to avoid blocking the Supabase auth lock.
        setTimeout(() => loadRoles(nextUserId), 0);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        currentUserId = data.session.user.id;
        await loadRoles(data.session.user.id);
      }
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadRoles(userId: string) {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    setRoles((data ?? []).map((r) => r.role as string));
  }

  return {
    user: session?.user ?? null,
    session,
    loading,
    roles,
    signOut: async () => {
      await supabase.auth.signOut();
    },
    hasRole: (r) => roles.includes(r),
    hasAnyRole: (rs) => rs.some((r) => roles.includes(r)),
  };
}