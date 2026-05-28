import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  exportConsentPDF,
  exportFullPackagePDF,
  exportResumePDF,
  exportSectionPDF,
} from "@/lib/export/rikkes-pdf-export";
import { checkHariHReadiness } from "@/lib/hari-h-readiness";

const QUICK_SECTIONS: { key: string; label: string }[] = [
  { key: "pemeriksaan_umum", label: "Pemeriksaan Umum" },
  { key: "mata", label: "Mata" },
  { key: "gigi", label: "Gigi/Odontogram" },
  { key: "penyakit_dalam", label: "Penyakit Dalam" },
  { key: "bedah", label: "Bedah" },
  { key: "usg", label: "USG" },
  { key: "radiologi_ro", label: "Radiologi/RO" },
  { key: "ekg_ergo", label: "Jantung/EKG" },
  { key: "laboratorium", label: "Laboratorium" },
  { key: "jiwa_keswa", label: "Jiwa/Keswa" },
];

export function PDFExportMenu({ candidateId }: { candidateId: string }) {
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>, label: string) {
    // Hard gate: block export unless No Test + EKG + Rontgen Cleared.
    const ready = await checkHariHReadiness({ candidateId });
    if (!ready.ok) {
      toast.error(`Export PDF diblokir: ${ready.missing.join(", ")}`);
      return;
    }
    if (
      !confirm(
        `Dokumen ini berisi data kesehatan rahasia. Pastikan hanya dibagikan kepada pihak berwenang.\n\nLanjutkan export ${label}?`,
      )
    )
      return;
    setBusy(true);
    try {
      await fn();
      toast.success(`Export ${label} berhasil`);
    } catch (e: any) {
      toast.error(`Export gagal: ${e?.message ?? "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy}>
          {busy ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4 mr-2" />
          )}
          Export PDF
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-[420px] overflow-y-auto">
        <DropdownMenuLabel>Dokumen Individual</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => run(() => exportFullPackagePDF(candidateId), "Paket Lengkap")}
        >
          Paket Lengkap Peserta
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run(() => exportResumePDF(candidateId), "Resume")}>
          Resume / Kualifikasi Akhir
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => run(() => exportConsentPDF(candidateId), "Surat Pernyataan")}
        >
          Surat Pernyataan
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Lembar Pemeriksaan</DropdownMenuLabel>
        {QUICK_SECTIONS.map((s) => (
          <DropdownMenuItem
            key={s.key}
            onClick={() => run(() => exportSectionPDF(candidateId, s.key), s.label)}
          >
            {s.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}