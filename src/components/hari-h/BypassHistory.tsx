import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, CheckCircle2, XCircle, Clock } from "lucide-react";

type Row = {
  id: string;
  bypass_type: string;
  reason: string;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  section_key: string | null;
};

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: any }> = {
  pending: { label: "Pending", cls: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock },
  approved: { label: "Disetujui", cls: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: CheckCircle2 },
  rejected: { label: "Ditolak", cls: "bg-red-100 text-red-800 border-red-200", icon: XCircle },
};

export function BypassHistory({ examId }: { examId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data } = await supabase
        .from("bypass_audit")
        .select("id,bypass_type,reason,status,requested_at,reviewed_at,review_note,section_key")
        .eq("exam_id", examId)
        .order("requested_at", { ascending: false });
      if (mounted) {
        setRows((data as Row[]) ?? []);
        setLoading(false);
      }
    }
    load();
    const ch = supabase
      .channel(`bypass-audit-${examId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bypass_audit", filter: `exam_id=eq.${examId}` }, () => load())
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [examId]);

  if (loading) return <div className="text-xs text-muted-foreground">Memuat riwayat bypass…</div>;
  if (rows.length === 0) return null;

  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-center gap-2 mb-2">
        <ShieldAlert className="h-4 w-4 text-orange-600" />
        <div className="text-sm font-semibold">Riwayat Bypass / Override</div>
        <Badge variant="outline" className="text-[10px]">{rows.length}</Badge>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => {
          const s = STATUS_BADGE[r.status] ?? STATUS_BADGE.pending;
          const Icon = s.icon;
          return (
            <li key={r.id} className="rounded border bg-muted/30 p-2 text-xs">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium uppercase tracking-wide">{r.bypass_type}</span>
                  {r.section_key && <span className="text-muted-foreground">· {r.section_key}</span>}
                </div>
                <Badge className={`${s.cls} border text-[10px] gap-1`}><Icon className="h-3 w-3" /> {s.label}</Badge>
              </div>
              <div className="text-muted-foreground italic">"{r.reason}"</div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                Diajukan {new Date(r.requested_at).toLocaleString("id-ID")}
                {r.reviewed_at && <> · Direview {new Date(r.reviewed_at).toLocaleString("id-ID")}</>}
              </div>
              {r.review_note && <div className="mt-1 text-[10px]">Catatan reviewer: {r.review_note}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}