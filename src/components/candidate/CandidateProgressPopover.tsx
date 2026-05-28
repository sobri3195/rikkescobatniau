import { useEffect, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Info, ListChecks, Loader2, RefreshCw } from "lucide-react";
import {
  PROGRESS_STATUS_CLASS,
  PROGRESS_STATUS_LABEL,
  type CandidateProgress,
} from "@/lib/candidate-progress";
import { getCandidateProgressSummary } from "@/lib/dashboard-monitoring.functions";
import { useAuth } from "@/lib/use-auth";
import { isReadOnlyViewer } from "@/lib/rikkes-role-access";

type Props = {
  candidateId: string;
  candidateName?: string;
  triggerLabel?: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "secondary";
  /** Render trigger as compact info icon (used on participant cards). */
  iconOnly?: boolean;
};

export function CandidateProgressPopover({
  candidateId,
  candidateName,
  triggerLabel = "Rincian Progress",
  size = "sm",
  variant = "outline",
  iconOnly = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<CandidateProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { roles } = useAuth();
  const readOnly = isReadOnlyViewer(roles);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCandidateProgressSummary({ data: { candidateId } });
      setData(res);
    } catch {
      setError("Gagal memuat rincian progress.");
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    if (open && !data) void load();
  }, [open, data, load]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {iconOnly ? (
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-slate-700" aria-label="Rincian Progress">
            <Info className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size={size} variant={variant} className="h-7 text-xs">
            <ListChecks className="h-3.5 w-3.5 mr-1" /> {triggerLabel}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="end">
        <div className="px-3 py-2 border-b flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-900 truncate">
              {candidateName ?? "Rincian Progress"}
            </div>
            {data && (
              <div className="text-[11px] text-muted-foreground">
                {data.items.filter((i) => i.completed).length}/{data.items.length} item · {data.percent}%
              </div>
            )}
          </div>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => void load()} disabled={loading} title="Refresh">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {loading && !data && (
            <div className="p-4 text-xs text-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Memuat…
            </div>
          )}
          {error && !loading && !data && (
            <div className="p-4 space-y-2 text-center">
              <div className="text-xs text-destructive">{error}</div>
              <Button size="sm" variant="outline" onClick={() => void load()}>
                Coba Lagi
              </Button>
            </div>
          )}
          {data && (
            <>
              <ul className="divide-y">
                {data.items.map((it) => (
                  <li key={it.item_key} className="px-3 py-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-700 truncate">{it.label}</span>
                    <Badge variant="outline" className={`${PROGRESS_STATUS_CLASS[it.status]} border text-[10px] shrink-0`}>
                      {PROGRESS_STATUS_LABEL[it.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
              <div className="border-t p-3">
                <Button asChild size="sm" className="w-full">
                  <Link to="/rikkes/$id" params={{ id: candidateId }} search={{ focus: data.items.find((i) => !i.completed)?.item_key ?? "identitas" } as any}>
                    {readOnly ? "Lihat Detail Peserta" : "Buka Data Belum Lengkap"}
                  </Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}