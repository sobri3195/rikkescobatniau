import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";

type Props = {
  testNumber?: string | null;
  temporaryId?: string | null;
  status?: string | null;
  className?: string;
  showLabel?: boolean;
};

/**
 * Badge konsisten untuk status No Test peserta.
 * - Final  → hijau, tampilkan No Test
 * - Draft  → biru, tampilkan No Test
 * - Belum Ada / TMP-* / null → kuning peringatan, tampilkan TMP ID
 */
export function NoTestBadge({ testNumber, temporaryId, status, className = "", showLabel = true }: Props) {
  const tn = (testNumber ?? "").trim();
  const isTmp = !tn || tn.startsWith("TMP-");
  const effectiveStatus = isTmp ? "Belum Ada" : (status ?? "Final");

  if (isTmp) {
    return (
      <Badge className={`bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-100 ${className}`}>
        <AlertCircle className="h-3 w-3 mr-1" />
        {showLabel ? "No Test: " : ""}
        <span className="font-mono">{temporaryId ?? "Belum Ada"}</span>
      </Badge>
    );
  }

  if (effectiveStatus === "Draft") {
    return (
      <Badge className={`bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-100 ${className}`}>
        <Clock className="h-3 w-3 mr-1" />
        {showLabel ? "No Test: " : ""}
        <span className="font-mono">{tn}</span>
      </Badge>
    );
  }

  return (
    <Badge className={`bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 ${className}`}>
      <CheckCircle2 className="h-3 w-3 mr-1" />
      {showLabel ? "No Test: " : ""}
      <span className="font-mono">{tn}</span>
    </Badge>
  );
}