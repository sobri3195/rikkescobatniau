import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    const authTimeout = window.setTimeout(() => {
      if (!active) return;
      console.error("Auth gate timeout: session check did not finish.");
      navigate({ to: "/login" });
    }, 8000);
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      window.clearTimeout(authTimeout);
      if (error || !data.user) navigate({ to: "/login" });
      else setReady(true);
    }).catch((error) => {
      if (!active) return;
      window.clearTimeout(authTimeout);
      console.error("Auth gate failed:", error);
      navigate({ to: "/login" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setReady(true);
      if (!session) navigate({ to: "/login" });
    });
    return () => {
      active = false;
      window.clearTimeout(authTimeout);
      sub.subscription.unsubscribe();
    };
  }, [navigate]);
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Memuat…</div>
      </div>
    );
  }
  return <AppShell />;
}