import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  testNumber?: string | null;
  temporaryId?: string | null;
  onAssign?: () => void;
  canAssign?: boolean;
};

/**
 * Banner peringatan ditampilkan di halaman Detail Pemeriksaan
 * ketika peserta belum punya No Test final.
 */
export function NoTestBanner({ testNumber, temporaryId, onAssign, canAssign }: Props) {
  const tn = (testNumber ?? "").trim();
  const isTmp = !tn || tn.startsWith("TMP-");
  if (!isTmp) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-900">
          Peserta ini belum memiliki Nomor Test final.
        </p>
        <p className="text-xs text-amber-800 mt-0.5">
          ID sementara: <span className="font-mono">{temporaryId ?? "—"}</span>.
          Pemeriksaan tetap bisa dijalankan, tapi <strong>finalisasi akan ditolak</strong> sampai No Test diisi.
        </p>
      </div>
      {canAssign && onAssign && (
        <Button size="sm" onClick={onAssign} className="bg-amber-600 hover:bg-amber-700 text-white flex-shrink-0">
          Isi No Test
        </Button>
      )}
    </div>
  );
}