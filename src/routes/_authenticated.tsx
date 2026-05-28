import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { LOCAL_SESSION_KEY, getDb, initLocalDb } from "@/lib/localDb";

type GateError = "timeout" | "invalid_session" | "runtime" | null;

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [gateError, setGateError] = useState<GateError>(null);

  useEffect(() => {
    let active = true;

    const timeoutId = window.setTimeout(() => {
      if (!active || ready) return;
      setGateError("timeout");
    }, 3000);

    function goLogin(clearSession = false) {
      if (clearSession) localStorage.removeItem(LOCAL_SESSION_KEY);
      navigate({ to: "/login", replace: true });
    }

    function checkLocalSession() {
      try {
        if (typeof window === "undefined") return;

        if (import.meta.env.VITE_APP_ENV !== "production") {
          // Debug sementara untuk investigasi auth lokal
          console.log("Local session:", localStorage.getItem(LOCAL_SESSION_KEY));
          console.log("Local DB exists:", !!localStorage.getItem("rikkes_tni_au_local_db_v1"));
        }

        if (!localStorage.getItem("rikkes_tni_au_local_db_v1")) {
          initLocalDb();
        }

        const rawSession = localStorage.getItem(LOCAL_SESSION_KEY);
        if (!rawSession) {
          setGateError("invalid_session");
          goLogin();
          return;
        }

        const session = JSON.parse(rawSession);
        const db = getDb() as any;
        const user = db.users?.find((u: any) => u.id === session.user_id);

        if (!user) {
          setGateError("invalid_session");
          goLogin(true);
          return;
        }

        if (!active) return;
        window.clearTimeout(timeoutId);
        setReady(true);
      } catch (error) {
        console.error("Local AuthGate failed:", error);
        setGateError("runtime");
        goLogin(true);
      }
    }

    checkLocalSession();

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [navigate, ready]);

  if (!ready && gateError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-lg border bg-card p-4 shadow">
          <h2 className="text-base font-semibold">Gagal memuat sesi lokal</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {gateError === "timeout"
              ? "Validasi sesi terlalu lama. Silakan kembali ke login atau reset sesi lokal."
              : "Sesi lokal tidak valid atau rusak. Silakan login ulang."}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm"
              onClick={() => navigate({ to: "/login", replace: true })}
            >
              Kembali ke Login
            </button>
            <button
              type="button"
              className="rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground"
              onClick={() => {
                localStorage.removeItem(LOCAL_SESSION_KEY);
                window.location.href = "/login";
              }}
            >
              Reset Session Lokal
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Memuat…</div>
      </div>
    );
  }

  return <AppShell />;
}
