import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { SECTIONS } from "@/lib/sections";
import { supabase } from "@/lib/local-supabase-shim";
import { isAnamnesisReadyForFinalization, getAnamnesisStage } from "@/lib/permissions/anamnesis-workflow";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";
import { checkHariHReadiness } from "@/lib/hari-h-readiness";
import { Can } from "@/components/auth/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

interface Section {
  id: string;
  section_key: string;
  section_name: string;
  section_status: string;
  classification: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  exam: any;
  candidate: any;
  sections: Section[];
  summary: any;
  onJumpSection?: (key: string) => void;
  onFinalized?: () => void;
}

const DONE = new Set(["Submitted", "Approved", "Locked"]);

export function FinalizationDialog({
  open,
  onOpenChange,
  exam,
  candidate,
  sections,
  summary,
  onJumpSection,
  onFinalized,
}: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [anamnesis, setAnamnesis] = useState<any | null>(null);

  useEffect(() => {
    if (!open || !exam?.id) return;
    supabase
      .from("medical_history_forms")
      .select("anamnesis_workflow_status, patient_signature_url, candidate_signature_url, doctor_signature_url, doctor_review_status")
      .eq("exam_id", exam.id)
      .maybeSingle()
      .then(({ data }) => setAnamnesis(data ?? null));
  }, [open, exam?.id]);

  const checklist = useMemo(() => {
    const items: { key: string; label: string; ok: boolean; sectionKey?: string }[] = [];
    // Hari-H gating: No Test wajib ada
    items.push({
      key: "no_test",
      label: "No Test sudah terisi (bukan TMP)",
      ok: !!candidate?.test_number && String(candidate.test_number).trim() !== "",
    });
    // Anamnesis workflow wajib clear / catatan / locked
    const wf = getAnamnesisStage(anamnesis);
    items.push({
      key: "anamnesis_patient_signed",
      label: "Anamnesa: peserta sudah submit & tanda tangan",
      sectionKey: "anamnesa",
      ok: !!(anamnesis?.patient_signature_url || anamnesis?.candidate_signature_url),
    });
    items.push({
      key: "anamnesis_doctor_reviewed",
      label: "Anamnesa: sudah direview Dokter Umum (Clear / Ada Catatan)",
      sectionKey: "anamnesa",
      ok: wf === "Clear Dokter" || wf === "Ada Catatan Dokter" || wf === "Locked",
    });
    items.push({
      key: "anamnesis_ready",
      label: "Anamnesa siap difinalisasi (helper)",
      sectionKey: "anamnesa",
      ok: isAnamnesisReadyForFinalization(anamnesis),
    });
    // EKG & Rontgen wajib Cleared
    items.push({
      key: "ekg_cleared",
      label: "EKG / Ergo sudah Cleared",
      ok: exam?.ekg_initial_status === "Cleared",
    });
    items.push({
      key: "ro_cleared",
      label: "Rontgen sudah Cleared",
      ok: exam?.radiology_initial_status === "Cleared",
    });
    for (const def of SECTIONS) {
      if (!def.required) continue;
      if (def.key === "obsgyn" && candidate?.gender !== "Perempuan") continue;
      const s = sections.find((x) => x.section_key === def.key);
      items.push({
        key: def.key,
        label: def.name,
        sectionKey: def.key,
        ok: !!s && DONE.has(s.section_status),
      });
    }
    items.push({
      key: "kesum",
      label: "KESUM sudah terhitung (tidak Belum Lengkap)",
      ok: !!summary?.kesum_classification && summary.kesum_classification !== "Belum Lengkap",
    });
    items.push({
      key: "keswa",
      label: "KESWA sudah terhitung (tidak Belum Lengkap)",
      ok: !!summary?.keswa_status && summary.keswa_status !== "Belum Lengkap",
    });
    items.push({
      key: "final",
      label: "Hasil Akhir sudah ditentukan (MS / TMS / TH)",
      ok: !!summary?.final_result && summary.final_result !== "Belum Lengkap",
    });
    items.push({
      key: "score",
      label: "Nilai Akhir sudah terhitung",
      ok: summary?.final_score != null,
    });
    return items;
  }, [sections, summary, candidate, exam, anamnesis]);

  const failed = checklist.filter((c) => !c.ok);
  const canFinalize = failed.length === 0 && confirmed;

  async function doFinalize() {
    if (!canFinalize || !exam) return;
    setBusy(true);
    try {
      // Re-check Hari-H gating against freshest data at the moment of click.
      const ready = await checkHariHReadiness({ examId: exam.id });
      if (!ready.ok) {
        toast.error("Finalisasi dibatalkan: " + ready.missing.join(", "));
        setBusy(false);
        return;
      }
      const { data: u } = await supabase.auth.getUser();
      const { error: e1 } = await supabase
        .from("exams")
        .update({
          exam_status: "Finalized",
          finalized_by: u.user?.id,
          finalized_at: new Date().toISOString(),
        })
        .eq("id", exam.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("exam_sections")
        .update({
          section_status: "Locked",
          locked_at: new Date().toISOString(),
        })
        .eq("exam_id", exam.id);
      if (e2) throw e2;
      await logAudit({
        action: "finalize_exam",
        module: "exams",
        record_id: exam.id,
        candidate_id: candidate?.id,
        exam_id: exam.id,
        after: {
          exam_status: "Finalized",
          final_result: summary?.final_result,
          final_score: summary?.final_score,
        },
      });
      toast.success("Pemeriksaan difinalisasi & dikunci");
      onOpenChange(false);
      onFinalized?.();
    } catch (err: any) {
      toast.error("Finalisasi gagal: " + (err?.message ?? "unknown"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" /> Finalisasi Pemeriksaan
          </DialogTitle>
          <DialogDescription>
            {candidate?.full_name} — pastikan semua item berikut sudah lengkap sebelum mengunci data.
          </DialogDescription>
        </DialogHeader>

        {failed.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Ada <b>{failed.length}</b> item belum lengkap. Lengkapi terlebih dahulu.
            </AlertDescription>
          </Alert>
        )}

        <ScrollArea className="h-72 rounded border">
          <ul className="divide-y">
            {checklist.map((c) => (
              <li key={c.key} className="flex items-center justify-between px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  {c.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className={c.ok ? "text-foreground" : "text-red-700 font-medium"}>
                    {c.label}
                  </span>
                </div>
                {!c.ok && c.sectionKey && onJumpSection && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onJumpSection(c.sectionKey!);
                      onOpenChange(false);
                    }}
                  >
                    Buka Section
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </ScrollArea>

        <label className="flex items-start gap-2 text-sm pt-2">
          <Checkbox
            checked={confirmed}
            onCheckedChange={(b) => setConfirmed(b === true)}
            disabled={failed.length > 0}
          />
          <span>
            Saya menyatakan data pemeriksaan ini sudah lengkap dan siap difinalisasi.
            Setelah finalisasi, seluruh section akan dikunci.
          </span>
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Batal
          </Button>
          <Can permission={PERMISSIONS.FINALIZATION_CREATE} fallback={
            <Button disabled title="Anda tidak punya izin finalisasi">Finalisasi & Kunci</Button>
          }>
            <Button onClick={doFinalize} disabled={!canFinalize || busy}>
              {busy ? "Memfinalisasi…" : "Finalisasi & Kunci"}
            </Button>
          </Can>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}