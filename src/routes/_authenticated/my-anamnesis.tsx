import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyExamForAnamnesis } from "@/lib/peserta-self.functions";
import { IdentitasAnamnesisForm } from "@/components/rikkes/IdentitasAnamnesisForm";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-anamnesis")({
  component: MyAnamnesisPage,
});

function MyAnamnesisPage() {
  const fetchMine = useServerFn(getMyExamForAnamnesis);
  const router = useRouter();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my-anamnesis"],
    queryFn: () => fetchMine(),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat formulir anamnesis…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
        <button
          type="button"
          className="mt-3 text-sm underline"
          onClick={() => refetch()}
        >
          Coba lagi
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <header className="flex flex-col gap-1 border-b border-border pb-3">
        <h1 className="text-xl font-bold tracking-tight">Form Anamnesis Saya</h1>
        <p className="text-xs text-muted-foreground">
          Lengkapi riwayat kesehatan Anda. Data identitas hanya bisa diubah oleh petugas registrasi.
        </p>
      </header>
      <IdentitasAnamnesisForm
        cand={data.candidate}
        exam={data.exam}
        selectionLabel={data.selectionLabel ?? undefined}
        onSyncSection={async () => {
          await router.invalidate();
        }}
      />
    </div>
  );
}
