import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { localDataApi } from "@/lib/localDataApi";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { DEFAULT_HARI_H_SETTINGS, type HariHSettings } from "@/lib/hari-h-stage";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/_authenticated/setting-hari-h")({
  component: SettingHariHPage,
});

function SettingHariHPage() {
  const { roles } = useAuth();
  const canWrite = ["super_admin", "admin"].some((r) => roles.includes(r));
  const [selections, setSelections] = useState<any[]>([]);
  const [selectionId, setSelectionId] = useState<string>("GLOBAL");
  const [settings, setSettings] = useState<HariHSettings>({ ...DEFAULT_HARI_H_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await localDataApi.from("selections").select("id, name").order("created_at", { ascending: false });
      setSelections(data ?? []);
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const sid = selectionId === "GLOBAL" ? null : selectionId;
    const q = localDataApi.from("hari_h_settings" as any).select("*");
    const { data } = sid ? await q.eq("selection_id", sid).maybeSingle() : await q.is("selection_id", null).maybeSingle();
    if (data) setSettings(data as unknown as HariHSettings);
    else setSettings({ ...DEFAULT_HARI_H_SETTINGS, selection_id: sid });
    setLoading(false);
  }, [selectionId]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setBusy(true);
    try {
      const sid = selectionId === "GLOBAL" ? null : selectionId;
      const payload: any = {
        selection_id: sid,
        require_ekg_before_screening: settings.require_ekg_before_screening,
        require_radiology_before_screening: settings.require_radiology_before_screening,
        require_ekg_before_subteam: settings.require_ekg_before_subteam,
        require_radiology_before_subteam: settings.require_radiology_before_subteam,
        allow_bypass_with_reason: settings.allow_bypass_with_reason,
      };
      const q = localDataApi.from("hari_h_settings" as any).select("id");
      const existing = sid ? await q.eq("selection_id", sid).maybeSingle() : await q.is("selection_id", null).maybeSingle();
      let res;
      if (existing.data) {
        res = await localDataApi.from("hari_h_settings" as any).update(payload).eq("id", (existing.data as any).id);
      } else {
        res = await localDataApi.from("hari_h_settings" as any).insert(payload);
      }
      if (res.error) throw res.error;
      await logAudit({ action: "update_hari_h_settings", module: "hari_h", after: payload });
      toast.success("Pengaturan tersimpan");
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  function Toggle({ k, label, desc }: { k: keyof HariHSettings; label: string; desc: string }) {
    return (
      <div className="flex items-start justify-between gap-4 p-4 border border-slate-200 rounded-lg bg-white">
        <div>
          <Label className="text-sm font-semibold text-slate-800">{label}</Label>
          <p className="text-xs text-slate-500 mt-1">{desc}</p>
        </div>
        <Switch
          checked={!!settings[k]}
          onCheckedChange={(c) => setSettings({ ...settings, [k]: c } as HariHSettings)}
          disabled={!canWrite}
        />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Setting Hari-H RIKKES</h1>
        <p className="text-sm text-slate-600 mt-1">Atur kewajiban EKG/Rontgen dan kebijakan bypass per seleksi (atau global).</p>
      </div>

      <div className="bg-white p-4 border border-slate-200 rounded-xl space-y-3">
        <Label className="text-xs font-medium text-slate-700">Berlaku untuk</Label>
        <Select value={selectionId} onValueChange={setSelectionId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="GLOBAL">Default Global (semua seleksi tanpa pengaturan khusus)</SelectItem>
            {selections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500"><Loader2 className="h-5 w-5 inline animate-spin mr-2" />Memuat…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Toggle k="require_ekg_before_screening" label="Wajibkan EKG sebelum Screening" desc="Peserta tidak bisa lanjut ke Screening Hari-H tanpa EKG terisi." />
            <Toggle k="require_radiology_before_screening" label="Wajibkan Rontgen sebelum Screening" desc="Peserta tidak bisa lanjut ke Screening Hari-H tanpa Rontgen terisi." />
            <Toggle k="require_ekg_before_subteam" label="Wajibkan EKG sebelum Subtim" desc="Subtim tidak bisa submit tanpa EKG selesai." />
            <Toggle k="require_radiology_before_subteam" label="Wajibkan Rontgen sebelum Subtim" desc="Subtim tidak bisa submit tanpa Rontgen selesai." />
            <Toggle k="allow_bypass_with_reason" label="Izinkan Bypass dengan alasan" desc="Admin/Super Admin dapat melewati gating jika ada alasan tertulis (perlu review)." />
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={busy || !canWrite}>
              <Save className="h-4 w-4 mr-1.5" /> Simpan Pengaturan
            </Button>
          </div>
        </>
      )}
    </div>
  );
}