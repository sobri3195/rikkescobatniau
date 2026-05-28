import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Star,
  Power,
  Pencil,
  Trash2,
  Download,
  Users,
  Activity,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";

export type SelectionCardData = {
  id: string;
  name: string;
  year_label: string;
  participant_label: string;
  location: string | null;
  status: string;
  is_default: boolean;
  institution_header_line_1?: string;
  institution_header_line_2?: string;
  /** Agregasi progress (opsional — null saat belum dimuat) */
  stats?: {
    total_candidates: number;
    progress_avg: number;
    finalized: number;
    in_progress: number;
    incomplete: number;
    waiting_ekg: number;
    waiting_rontgen: number;
    screening: number;
    subteam: number;
    review: number;
    not_started: number;
  } | null;
};

type Actions = {
  /** Mode monitoring (Dashboard): tampilkan tombol pantau saja */
  onViewProgress?: (s: SelectionCardData) => void;
  onViewParticipants?: (s: SelectionCardData) => void;
  onViewReport?: (s: SelectionCardData) => void;
  onExport?: (s: SelectionCardData) => void;
  /** Mode management (Master Seleksi): tombol kelola */
  onEdit?: (s: SelectionCardData) => void;
  onDelete?: (s: SelectionCardData) => void;
  onSetDefault?: (s: SelectionCardData) => void;
  onToggleStatus?: (s: SelectionCardData) => void;
};

export type SelectionCardProps = {
  selection: SelectionCardData;
  mode: "monitoring" | "management";
  canExport?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canSetDefault?: boolean;
  canToggleStatus?: boolean;
} & Actions;

function MiniStat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${tone}`}>
      <Icon className="h-3 w-3" />
      <span className="text-[10px] uppercase tracking-wide opacity-80">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function SelectionCard({
  selection: s,
  mode,
  canExport = false,
  canEdit = false,
  canDelete = false,
  canSetDefault = false,
  canToggleStatus = false,
  onViewProgress,
  onViewParticipants,
  onViewReport,
  onExport,
  onEdit,
  onDelete,
  onSetDefault,
  onToggleStatus,
}: SelectionCardProps) {
  const navigate = useNavigate();
  const st = s.stats;
  const isActive = (s.status ?? "").toLowerCase() === "aktif";
  const progress = st?.progress_avg ?? 0;
  const detailHref = `/selections/${s.id}` as const;
  const isMonitoring = mode === "monitoring";
  const openProgress = () => {
    onViewProgress?.(s);
    void navigate({ to: "/dashboard/seleksi/$selectionId/progress", params: { selectionId: s.id } });
  };

  return (
    <Card className={`${s.is_default ? "border-primary" : ""} transition hover:shadow-md`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {isMonitoring ? (
              <button
                type="button"
                onClick={openProgress}
                className="border-0 bg-transparent p-0 text-left font-semibold text-slate-900 hover:underline flex items-center gap-2"
                title="Buka Progress Peserta"
              >
                <span className="truncate">{s.name}</span>
                {s.is_default && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 shrink-0">
                    <Star className="h-3 w-3 mr-1" /> Default
                  </Badge>
                )}
              </button>
            ) : (
              <Link to={detailHref} className="font-semibold text-slate-900 hover:underline flex items-center gap-2">
                <span className="truncate">{s.name}</span>
                {s.is_default && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 shrink-0">
                    <Star className="h-3 w-3 mr-1" /> Default
                  </Badge>
                )}
              </Link>
            )}
            <div className="text-xs text-muted-foreground mt-0.5 truncate">
              {s.year_label} · {s.participant_label}
              {s.location ? ` · ${s.location}` : ""}
            </div>
          </div>
          <Badge
            variant="outline"
            className={
              isActive
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0"
                : "bg-slate-100 text-slate-600 border-slate-200 shrink-0"
            }
          >
            {s.status}
          </Badge>
        </div>

        {st && (
          <>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                <Users className="h-3 w-3 inline mr-1" />
                {st.total_candidates} peserta
              </span>
              <span className="font-semibold text-slate-700">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <MiniStat icon={CheckCircle2} label="Final" value={st.finalized} tone="bg-emerald-50 text-emerald-700 border-emerald-200" />
              <MiniStat icon={Clock} label="Proses" value={st.in_progress} tone="bg-sky-50 text-sky-700 border-sky-200" />
              <MiniStat icon={Activity} label="EKG" value={st.waiting_ekg} tone="bg-amber-50 text-amber-700 border-amber-200" />
              <MiniStat icon={Activity} label="RO" value={st.waiting_rontgen} tone="bg-amber-50 text-amber-700 border-amber-200" />
              <MiniStat icon={Users} label="Subtim" value={st.subteam} tone="bg-violet-50 text-violet-700 border-violet-200" />
              <MiniStat icon={AlertCircle} label="Blm Lengkap" value={st.incomplete} tone="bg-orange-50 text-orange-700 border-orange-200" />
            </div>
          </>
        )}

        <div className="pt-1 flex flex-wrap gap-2">
          {mode === "monitoring" ? (
            <>
              <Button size="sm" type="button" onClick={openProgress}>
                <Users className="h-3.5 w-3.5 mr-1" /> Lihat Progress Peserta
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to={detailHref} search={{ tab: "progress" } as any}>
                  <Activity className="h-3.5 w-3.5 mr-1" /> Ringkasan Tahap
                </Link>
              </Button>
              {onViewReport && (
                <Button size="sm" variant="outline" onClick={() => onViewReport(s)}>
                  <FileText className="h-3.5 w-3.5 mr-1" /> Laporan
                </Button>
              )}
              {canExport && onExport && (
                <Button size="sm" variant="outline" onClick={() => onExport(s)}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Export
                </Button>
              )}
            </>
          ) : (
            <>
              {canExport && onExport && (
                <Button size="sm" variant="outline" onClick={() => onExport(s)}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Export XLSX
                </Button>
              )}
              {canEdit && onEdit && (
                <Button size="sm" variant="outline" onClick={() => onEdit(s)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Ubah
                </Button>
              )}
              {canSetDefault && !s.is_default && onSetDefault && (
                <Button size="sm" variant="outline" onClick={() => onSetDefault(s)}>
                  <Star className="h-3.5 w-3.5 mr-1" /> Jadikan Default
                </Button>
              )}
              {canToggleStatus && onToggleStatus && (
                <Button size="sm" variant="outline" onClick={() => onToggleStatus(s)}>
                  <Power className="h-3.5 w-3.5 mr-1" />
                  {(s.status ?? "").toLowerCase() === "nonaktif" ? "Aktifkan" : "Nonaktifkan"}
                </Button>
              )}
              {canDelete && onDelete && (
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => onDelete(s)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Hapus
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}