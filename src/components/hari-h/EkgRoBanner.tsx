import { useEffect, useState } from "react";
import { getExamDetailLocal } from "@/lib/services/examService";
import { getCardiologyByExamIdLocal } from "@/lib/services/cardiologyService";
import { getRadiologyByExamIdLocal } from "@/lib/services/radiologyService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, ScanLine, CheckCircle2, AlertCircle, ShieldAlert, Upload } from "lucide-react";
import { QuickSupportingModal } from "./QuickSupportingModal";
import { BypassHistory } from "./BypassHistory";

const OK = ["Submitted", "Approved", "Locked", "Cleared"];

export function EkgRoBanner({ examId, candidateId }: { examId?: string; candidateId?: string }) {
  const [ekg, setEkg] = useState<string>("Belum Diisi");
  const [ro, setRo] = useState<string>("Belum Diisi");
  const [stage, setStage] = useState<string | null>(null);
  const [bypass, setBypass] = useState<{ at: string | null; reason: string | null; reviewed: string | null } | null>(null);
  const [modal, setModal] = useState<"ekg" | "radiology" | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!examId) return;
    (async () => {
      const e = getCardiologyByExamIdLocal(examId);
      const r = getRadiologyByExamIdLocal(examId);
      const xd = getExamDetailLocal(examId) as any;
      setEkg(e?.status ?? "Belum Diisi");
      setRo(r?.status ?? "Belum Diisi");
      setStage(xd?.hari_h_stage ?? null);
      if (xd?.bypass_initial_at) setBypass({ at: xd.bypass_initial_at, reason: xd.bypass_initial_reason, reviewed: xd.bypass_initial_reviewed_at });
      else setBypass(null);
    })();
  }, [examId, reloadKey]);

  const ekgOK = OK.includes(ekg);
  const roOK = OK.includes(ro);
  const bg = ekgOK && roOK ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200";

  return (
    <div className={`rounded-lg border ${bg} px-4 py-3 flex items-center justify-between gap-3 flex-wrap`}>
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-slate-700" />
          <span className="font-medium text-slate-700">EKG:</span>
          <Badge className={ekgOK ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-800 border-amber-200"}>
            {ekgOK ? <CheckCircle2 className="h-3 w-3 mr-1 inline" /> : <AlertCircle className="h-3 w-3 mr-1 inline" />}{ekg}
          </Badge>
          {examId && candidateId && (
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => setModal("ekg")}>
              <Upload className="h-3 w-3 mr-1" /> Upload
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <ScanLine className="h-4 w-4 text-slate-700" />
          <span className="font-medium text-slate-700">Rontgen:</span>
          <Badge className={roOK ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-800 border-amber-200"}>
            {roOK ? <CheckCircle2 className="h-3 w-3 mr-1 inline" /> : <AlertCircle className="h-3 w-3 mr-1 inline" />}{ro}
          </Badge>
          {examId && candidateId && (
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => setModal("radiology")}>
              <Upload className="h-3 w-3 mr-1" /> Upload
            </Button>
          )}
        </div>
      </div>
      {stage && (
        <Badge variant="outline" className="text-xs">Stage Hari-H: {stage}</Badge>
      )}
      {bypass && (
        <div className="basis-full flex items-start gap-2 text-xs text-orange-800 bg-orange-100 border border-orange-200 rounded px-2 py-1.5">
          <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div>
            <span className="font-medium">Bypass aktif{bypass.reviewed ? " (disetujui)" : " (menunggu review)"}:</span>{" "}
            {bypass.reason ?? "-"}
          </div>
        </div>
      )}
      {modal && examId && candidateId && (
        <QuickSupportingModal
          open={!!modal}
          onOpenChange={(v) => !v && setModal(null)}
          mode={modal}
          examId={examId}
          candidateId={candidateId}
          onSaved={() => setReloadKey((k) => k + 1)}
        />
      )}
      {examId && (
        <div className="w-full mt-2">
          <BypassHistory examId={examId} />
        </div>
      )}
    </div>
  );
}