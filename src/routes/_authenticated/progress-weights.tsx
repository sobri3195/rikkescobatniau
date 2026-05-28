import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { localDataApi } from "@/lib/localDataApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Sliders, Save, RefreshCw, RotateCcw, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/progress-weights")({
  component: ProgressWeightsPage,
});

type Weight = {
  key: string;
  label: string;
  weight: number;
  category: string;
  sort_order: number;
  is_active: boolean;
};

const DEFAULTS: Record<string, number> = {
  identity: 5, test_number: 5, radiology: 10, ekg: 10, anamnesis: 10,
  height: 3, weight: 3, waist: 3, bmi: 3, juknis: 3,
  section_each: 3.75, resume: 10, finalize: 5,
};

const CAT_LABEL: Record<string, string> = {
  identitas: "Identitas",
  penunjang: "Penunjang (EKG/Rontgen)",
  screening: "Screening Hari-H",
  subtim: "Subtim",
  review: "Review & Finalisasi",
  general: "Lain-lain",
};

function ProgressWeightsPage() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");
  const [rows, setRows] = useState<Weight[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recalcing, setRecalcing] = useState(false);
  const [dirty, setDirty] = useState<Record<string, Partial<Weight>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await localDataApi
      .from("progress_weights" as never)
      .select("*")
      .order("sort_order", { ascending: true });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as never as Weight[]);
    setDirty({});
  }, []);

  useEffect(() => { load(); }, [load]);

  function update(key: string, patch: Partial<Weight>) {
    setDirty((d) => ({ ...d, [key]: { ...d[key], ...patch } }));
  }
  function getValue(r: Weight): Weight {
    return { ...r, ...(dirty[r.key] ?? {}) };
  }

  const totalWeight = rows.reduce((sum, r) => {
    const v = getValue(r);
    if (!v.is_active) return sum;
    if (v.key === "section_each") return sum + v.weight * 8;
    return sum + v.weight;
  }, 0);

  async function save() {
    if (!isSuperAdmin) { toast.error("Hanya Super Admin"); return; }
    const changes = Object.entries(dirty);
    if (!changes.length) { toast.info("Tidak ada perubahan"); return; }
    setSaving(true);
    try {
      for (const [key, patch] of changes) {
        const { error } = await localDataApi
          .from("progress_weights" as never)
          .update({ ...patch, updated_at: new Date().toISOString() } as never)
          .eq("key", key);
        if (error) throw error;
      }
      await logAudit({
        action: "update_progress_weights",
        module: "Progress Weights",
        after: { changes: dirty },
      });
      toast.success(`${changes.length} bobot disimpan`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function resetDefaults() {
    if (!isSuperAdmin) return;
    if (!confirm("Reset semua bobot ke nilai default?")) return;
    setSaving(true);
    try {
      for (const r of rows) {
        const def = DEFAULTS[r.key];
        if (def === undefined) continue;
        const { error } = await localDataApi
          .from("progress_weights" as never)
          .update({ weight: def, is_active: true, updated_at: new Date().toISOString() } as never)
          .eq("key", r.key);
        if (error) throw error;
      }
      await logAudit({ action: "reset_progress_weights", module: "Progress Weights" });
      toast.success("Bobot direset ke default");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal reset");
    } finally {
      setSaving(false);
    }
  }

  async function recalcAll() {
    if (!confirm("Hitung ulang progress SEMUA peserta? Ini bisa beberapa menit jika data besar.")) return;
    setRecalcing(true);
    try {
      const { data, error } = await localDataApi.rpc("recompute_selection_progress" as never, { p_selection_id: null } as never);
      if (error) throw error;
      toast.success(`Recompute selesai: ${data ?? 0} peserta`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal recompute");
    } finally {
      setRecalcing(false);
    }
  }

  const grouped = rows.reduce<Record<string, Weight[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="p-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sliders className="h-6 w-6" /> Bobot Progress
          </h1>
          <p className="text-sm text-muted-foreground">
            Atur bobot tiap item progress peserta. Total bobot aktif saat ini: <strong>{totalWeight.toFixed(2)}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          {isSuperAdmin && (
            <>
              <Button variant="outline" onClick={resetDefaults} disabled={saving}>
                <RotateCcw className="h-4 w-4 mr-2" /> Reset Default
              </Button>
              <Button onClick={save} disabled={saving || Object.keys(dirty).length === 0}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Simpan ({Object.keys(dirty).length})
              </Button>
              <Button variant="secondary" onClick={recalcAll} disabled={recalcing}>
                {recalcing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Recompute Semua
              </Button>
            </>
          )}
        </div>
      </div>

      {!isSuperAdmin && (
        <Card><CardContent className="p-4 text-sm text-amber-700 bg-amber-50 border-amber-200">
          Mode lihat saja — hanya Super Admin yang bisa mengubah bobot.
        </CardContent></Card>
      )}

      {Object.entries(grouped).map(([cat, items]) => (
        <Card key={cat}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{CAT_LABEL[cat] ?? cat}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="text-left p-2">Key</th>
                  <th className="text-left p-2">Label</th>
                  <th className="text-left p-2 w-32">Bobot</th>
                  <th className="text-left p-2 w-24">Default</th>
                  <th className="text-left p-2 w-24">Aktif</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => {
                  const v = getValue(r);
                  const isDirty = !!dirty[r.key];
                  return (
                    <tr key={r.key} className={`border-t ${isDirty ? "bg-amber-50/60" : ""}`}>
                      <td className="p-2 font-mono text-xs">{r.key}</td>
                      <td className="p-2">{r.label}</td>
                      <td className="p-2">
                        <Input
                          type="number" step="0.5" min="0" max="100"
                          className="h-8 w-24"
                          value={v.weight}
                          disabled={!isSuperAdmin}
                          onChange={(e) => update(r.key, { weight: Number(e.target.value) })}
                        />
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {DEFAULTS[r.key] ?? "—"}
                      </td>
                      <td className="p-2">
                        <Switch checked={v.is_active} disabled={!isSuperAdmin}
                          onCheckedChange={(b) => update(r.key, { is_active: b })} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <p>• Bobot dipakai saat menghitung % progress per peserta.</p>
          <p>• Item subtim (<code>section_each</code>) dipakai untuk 8 section: bedah, mata, THT, EKG/Ergo, Radiologi, Lab, Gilut, Penyakit Dalam.</p>
          <p>• Setelah mengubah bobot, klik <strong>Recompute Semua</strong> agar peserta yang sudah ada langsung memakai bobot baru.</p>
        </CardContent>
      </Card>
    </div>
  );
}