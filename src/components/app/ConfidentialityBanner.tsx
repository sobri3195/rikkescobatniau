import { ShieldAlert } from "lucide-react";

export function ConfidentialityBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-md border border-red-300 bg-red-50 text-red-900 ${
        compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"
      }`}
      role="note"
    >
      <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
      <div>
        <span className="font-semibold">RAHASIA KEDOKTERAN.</span>{" "}
        Dokumen ini berisi data kesehatan rahasia. Hanya dapat diakses dan
        dibagikan kepada pihak yang berwenang. Semua tindakan dicatat dalam
        audit log.
      </div>
    </div>
  );
}