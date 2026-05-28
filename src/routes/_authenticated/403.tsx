import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { ShieldAlert, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/403")({
  validateSearch: (s: Record<string, unknown>) => ({
    from: typeof s.from === "string" ? s.from : "",
    key: typeof s.key === "string" ? s.key : "",
  }),
  component: AccessDeniedPage,
});

function AccessDeniedPage() {
  const { from, key } = useSearch({ from: "/_authenticated/403" });
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold">403 — Akses Ditolak</h1>
        <p className="text-sm text-muted-foreground">
          Anda tidak memiliki akses ke bagian ini. Bila ini perlu, hubungi <b>Super Admin</b> untuk mendapatkan permission yang sesuai.
        </p>
        {(from || key) && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-left font-mono space-y-1">
            {from && <div><span className="text-muted-foreground">Halaman:</span> {from}</div>}
            {key && <div><span className="text-muted-foreground">Permission:</span> {key}</div>}
          </div>
        )}
        <div className="flex gap-2 justify-center pt-2">
          <Button variant="outline" onClick={() => history.back()}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Kembali
          </Button>
          <Button asChild>
            <Link to="/dashboard"><Home className="h-4 w-4 mr-1.5" /> Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
