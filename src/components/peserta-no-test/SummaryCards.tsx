import { Card, CardContent } from "@/components/ui/card";
import { Users, Activity, Radio, CheckCircle2, ShieldCheck, AlertTriangle } from "lucide-react";

export type SummaryStats = {
  total: number;
  menungguRontgen: number;
  menungguEkg: number;
  rontgenSelesai: number;
  ekgSelesai: number;
  siapScreening: number;
  perluVerifikasi: number;
};

const items = [
  { key: "total", label: "Total", icon: Users, color: "text-slate-700 bg-slate-100" },
  { key: "menungguRontgen", label: "Menunggu Rontgen", icon: Radio, color: "text-orange-700 bg-orange-100" },
  { key: "menungguEkg", label: "Menunggu EKG", icon: Activity, color: "text-amber-700 bg-amber-100" },
  { key: "rontgenSelesai", label: "Rontgen Selesai", icon: CheckCircle2, color: "text-sky-700 bg-sky-100" },
  { key: "ekgSelesai", label: "EKG Selesai", icon: CheckCircle2, color: "text-blue-700 bg-blue-100" },
  { key: "siapScreening", label: "Siap Screening", icon: ShieldCheck, color: "text-emerald-700 bg-emerald-100" },
  { key: "perluVerifikasi", label: "Perlu Verifikasi", icon: AlertTriangle, color: "text-rose-700 bg-rose-100" },
] as const;

export function SummaryCards({ stats }: { stats: SummaryStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <Card key={it.key} className="shadow-sm">
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`p-2 rounded-md ${it.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[11px] uppercase text-slate-500 tracking-wide">{it.label}</div>
                <div className="text-lg font-bold text-slate-800 leading-tight">{stats[it.key]}</div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}