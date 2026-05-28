import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/local-supabase-shim";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export function AckButton({
  documentType,
  documentId,
  documentCode,
  version,
  label = "Saya telah membaca dan memahami dokumen ini",
  auditAction,
}: {
  documentType: "sop" | "help_article" | "release_note" | "training" | "quick_start";
  documentId?: string;
  documentCode?: string;
  version?: number;
  label?: string;
  auditAction?: string;
}) {
  const [acked, setAcked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      let q = supabase
        .from("user_acknowledgements")
        .select("id")
        .eq("user_id", u.user.id)
        .eq("document_type", documentType)
        .limit(1);
      if (documentId) q = q.eq("document_id", documentId);
      else if (documentCode) q = q.eq("document_code", documentCode);
      const { data } = await q;
      if (data && data.length > 0) setAcked(true);
    })();
  }, [documentType, documentId, documentCode]);

  async function handle() {
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setBusy(false);
      return;
    }
    const { error } = await supabase.from("user_acknowledgements").insert({
      user_id: u.user.id,
      document_type: documentType,
      document_id: documentId ?? null,
      document_code: documentCode ?? null,
      version: version ?? null,
      acknowledgement_text: label,
    });
    if (error) {
      toast.error(error.message);
    } else {
      setAcked(true);
      toast.success("Acknowledgement tersimpan");
      await logAudit({
        action: auditAction ?? `acknowledge_${documentType}`,
        module: "documentation",
        record_id: documentId,
      });
    }
    setBusy(false);
  }

  if (acked) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="h-4 w-4" /> Sudah Anda acknowledge
      </div>
    );
  }
  return (
    <Button onClick={handle} disabled={busy} size="sm">
      <Check className="h-4 w-4 mr-2" /> {label}
    </Button>
  );
}