import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/local-supabase-shim";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Save, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/_authenticated/master-juknis")({
  component: MasterJuknisPage,
});

type Rule = {
  id: string;
  selection_type: string | null;
  gender: string | null;
  parameter_key: string;
  parameter_label: string | null;
  min_value: number | null;
  max_value: number | null;
  unit: string | null;
  classification: string | null;
  is_blocking: boolean;
  notes: string | null;
  sort_order: number;
};

const PARAM_KEYS = [
  { v: "tb", l: "Tinggi Badan (TB)" },
  { v: "bb", l: "Berat Badan (BB)" },
  { v: "lp", l: "Lingkar Perut (LP)" },
  { v: "imt", l: "IMT" },
  { v: "td_sistol", l: "Tekanan Darah Sistol" },
  { v: "td_diastol", l: "Tekanan Darah Diastol" },
  { v: "nadi", l: "Nadi" },
  { v: "visus", l: "Visus" },
  { v: "other", l: "Lainnya" },
];

function emptyRule(): Partial<Rule> {
  return {
    selection_type: "",
    gender: "ALL",
    parameter_key: "tb",
    parameter_label: "",
    min_value: null,
    max_value: null,
    unit: "cm",
    classification: "MS",
    is_blocking: false,
    notes: "",
    sort_order: 0,
  };
}

function MasterJuknisPage() {
  const { roles } = useAuth();
  const canWrite = ["super_admin", "admin"].some((r) => roles.includes(r));
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Rule> | null>(null);
  const [filterParam, setFilterParam] = useState<string>("all");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("juknis_parameter_rules" as any)
      .select("*")
      .order("parameter_key")
      .order("sort_order");
    setRules((data as any) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() { setEditing(emptyRule()); setOpen(true); }
  function openEdit(r: Rule) { setEditing({ ...r }); setOpen(true); }

  async function save() {
    if (!editing) return;
    if (!editing.parameter_key) { toast.error("Parameter wajib diisi"); return; }
    setBusy(true);
    try {
      const payload: any = {
        selection_type: editing.selection_type || null,
        gender: editing.gender || null,
        parameter_key: editing.parameter_key,
        parameter_label: editing.parameter_label || null,
        min_value: editing.min_value ?? null,
        max_value: editing.max_value ?? null,
        unit: editing.unit || null,
        classification: editing.classification || null,
        is_blocking: !!editing.is_blocking,
        notes: editing.notes || null,
        sort_order: editing.sort_order ?? 0,
      };
      if (editing.id) {
        const { error } = await supabase.from("juknis_parameter_rules" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
        await logAudit({ action: "update_juknis_rule", module: "master_juknis", record_id: editing.id, after: payload });
      } else {
        const { data, error } = await supabase.from("juknis_parameter_rules" as any).insert(payload).select().single();
        if (error) throw error;
        await logAudit({ action: "create_juknis_rule", module: "master_juknis", record_id: (data as any).id, after: payload });
      }
      toast.success("Tersimpan");
      setOpen(false);
      setEditing(null);
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function remove(r: Rule) {
    if (!confirm(`Hapus parameter "${r.parameter_key}"?`)) return;
    const { error } = await supabase.from("juknis_parameter_rules" as any).delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    await logAudit({ action: "delete_juknis_rule", module: "master_juknis", record_id: r.id });
    toast.success("Dihapus");
    await load();
  }

  const filtered = filterParam === "all" ? rules : rules.filter((r) => r.parameter_key === filterParam);

  function printBlankForm() {
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) { toast.error("Popup diblokir browser"); return; }
    const rows = Array.from({ length: 20 }, (_, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
        <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
        <td>&nbsp;</td><td>&nbsp;</td>
      </tr>`).join("");
    w.document.write(`<!doctype html><html><head><title>Form Kosong — Master Juknis</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; }
        h1 { font-size: 14px; margin: 0 0 4px; }
        p.sub { margin: 0 0 12px; color: #555; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #333; padding: 6px 4px; height: 26px; text-align: left; vertical-align: top; }
        th { background: #eee; font-size: 10px; text-transform: uppercase; }
        .meta { margin-top: 18px; font-size: 10px; }
        .sig { margin-top: 40px; display: flex; justify-content: flex-end; gap: 60px; }
        .sig div { text-align: center; min-width: 160px; }
      </style></head><body>
      <h1>FORM PENGISIAN PARAMETER JUKNIS — RIKKES</h1>
      <p class="sub">Diisi manual oleh tim Master Juknis sebelum entry ke sistem. Tanggal: ____________________</p>
      <table>
        <thead><tr>
          <th style="width:24px">No</th>
          <th>Parameter</th>
          <th>Jenis Seleksi</th>
          <th>Gender</th>
          <th>Min</th>
          <th>Max</th>
          <th>Unit</th>
          <th>Klasifikasi</th>
          <th>Blocking (Y/T)</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="sig">
        <div>__________________________<br/>Penyusun</div>
        <div>__________________________<br/>Ketua Tim Medis</div>
      </div>
      <script>window.onload = () => { window.print(); };</script>
      </body></html>`);
    w.document.close();
  }

  return (
    <div className="p-6 lg:p-8 space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Master Parameter Juknis</h1>
          <p className="text-sm text-slate-600 mt-1">Aturan validasi otomatis untuk Screening Hari-H (TB/BB/IMT/LP, dll).</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterParam} onValueChange={setFilterParam}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua parameter</SelectItem>
              {PARAM_KEYS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={printBlankForm}><Printer className="h-4 w-4 mr-1.5" /> Cetak Form Kosong</Button>
          {canWrite && <Button onClick={openNew}><Plus className="h-4 w-4 mr-1.5" /> Aturan Baru</Button>}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-500"><Loader2 className="h-5 w-5 inline animate-spin mr-2" />Memuat…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Belum ada aturan. Klik "Aturan Baru" untuk menambah.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs uppercase text-slate-600">
                <th className="p-3">Parameter</th>
                <th className="p-3">Jenis Seleksi</th>
                <th className="p-3">Gender</th>
                <th className="p-3">Min</th>
                <th className="p-3">Max</th>
                <th className="p-3">Unit</th>
                <th className="p-3">Klasifikasi</th>
                <th className="p-3">Blocking</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-800">
                    {PARAM_KEYS.find((p) => p.v === r.parameter_key)?.l ?? r.parameter_key}
                    {r.parameter_label && <div className="text-xs text-slate-500">{r.parameter_label}</div>}
                  </td>
                  <td className="p-3 text-slate-600">{r.selection_type ?? "—"}</td>
                  <td className="p-3 text-slate-600">{r.gender ?? "ALL"}</td>
                  <td className="p-3 font-mono text-slate-700">{r.min_value ?? "—"}</td>
                  <td className="p-3 font-mono text-slate-700">{r.max_value ?? "—"}</td>
                  <td className="p-3 text-slate-600">{r.unit ?? "—"}</td>
                  <td className="p-3"><Badge variant="outline">{r.classification ?? "—"}</Badge></td>
                  <td className="p-3">
                    {r.is_blocking ? <Badge className="bg-red-100 text-red-700 border-red-200">Blocking</Badge> : <Badge className="bg-slate-100 text-slate-600 border-slate-200">Warning</Badge>}
                  </td>
                  <td className="p-3 text-right">
                    {canWrite && (
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="destructive" onClick={() => remove(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit Aturan" : "Aturan Baru"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Parameter">
                <Select value={editing.parameter_key} onValueChange={(v) => setEditing({ ...editing, parameter_key: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PARAM_KEYS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Label tampilan (opsional)">
                <Input value={editing.parameter_label ?? ""} onChange={(e) => setEditing({ ...editing, parameter_label: e.target.value })} placeholder="Misal: TB Pria Tamtama" />
              </Field>
              <Field label="Jenis Seleksi (kosong = semua)">
                <Input value={editing.selection_type ?? ""} onChange={(e) => setEditing({ ...editing, selection_type: e.target.value })} placeholder="Misal: Tamtama, Bintara, Akmil" />
              </Field>
              <Field label="Gender">
                <Select value={editing.gender ?? "ALL"} onValueChange={(v) => setEditing({ ...editing, gender: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua</SelectItem>
                    <SelectItem value="L">Laki-laki</SelectItem>
                    <SelectItem value="P">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Min">
                <Input type="number" inputMode="decimal" value={editing.min_value ?? ""} onChange={(e) => setEditing({ ...editing, min_value: e.target.value === "" ? null : Number(e.target.value) })} />
              </Field>
              <Field label="Max">
                <Input type="number" inputMode="decimal" value={editing.max_value ?? ""} onChange={(e) => setEditing({ ...editing, max_value: e.target.value === "" ? null : Number(e.target.value) })} />
              </Field>
              <Field label="Unit">
                <Input value={editing.unit ?? ""} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} placeholder="cm, kg, mmHg, dll" />
              </Field>
              <Field label="Klasifikasi (MS/TMS/K1/K2)">
                <Input value={editing.classification ?? ""} onChange={(e) => setEditing({ ...editing, classification: e.target.value })} placeholder="MS" />
              </Field>
              <div className="md:col-span-2 flex items-center gap-3 p-3 bg-slate-50 rounded-md">
                <Switch checked={!!editing.is_blocking} onCheckedChange={(c) => setEditing({ ...editing, is_blocking: c })} />
                <div>
                  <Label className="text-sm font-medium">Blocking</Label>
                  <p className="text-xs text-slate-500">Jika aktif, peserta dengan nilai di luar rentang ditolak (tidak hanya warning).</p>
                </div>
              </div>
              <Field label="Catatan (opsional)" full>
                <Input value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={busy}><Save className="h-4 w-4 mr-1.5" /> Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1.5 ${full ? "md:col-span-2" : ""}`}>
      <Label className="text-xs font-medium text-slate-700">{label}</Label>
      {children}
    </div>
  );
}