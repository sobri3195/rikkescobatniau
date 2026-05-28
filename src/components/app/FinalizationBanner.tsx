import { Lock, Unlock as UnlockIcon } from "lucide-react";

export function FinalizationBanner({
  exam,
}: {
  exam: { exam_status?: string | null; finalized_at?: string | null; unlocked_at?: string | null } | null;
}) {
  if (!exam) return null;
  if (exam.exam_status === "Finalized") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 text-emerald-900 px-3 py-2 text-sm">
        <Lock className="h-4 w-4" />
        <span>
          <b>FINALIZED / LOCKED.</b> Difinalisasi pada{" "}
          {exam.finalized_at ? new Date(exam.finalized_at).toLocaleString("id-ID") : "-"}.
          Data medis read-only.
        </span>
      </div>
    );
  }
  if (exam.unlocked_at) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2 text-sm">
        <UnlockIcon className="h-4 w-4" />
        <span>
          Dokumen pernah dibuka kembali setelah finalisasi (
          {new Date(exam.unlocked_at).toLocaleString("id-ID")}).
        </span>
      </div>
    );
  }
  return null;
}