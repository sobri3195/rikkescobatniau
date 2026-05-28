import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { localDataApi } from "@/lib/localDataApi";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/medical-subteams")({
  component: MedicalSubteamsPage,
});

const SECTION_OPTIONS: { key: string; name: string; display: string }[] = [
  { key: "pemeriksaan_umum", name: "Pemeriksaan Umum", display: "KA SUB TIM UMUM" },
  { key: "mata", name: "Sektor Mata", display: "KA SUB TIM MATA" },
  { key: "gilut", name: "Sektor Gilut / Odontogram", display: "KA SUB TIM GILUT" },
  { key: "penyakit_dalam", name: "Sektor Penyakit Dalam", display: "KA SUB TIM PENY. DALAM" },
  { key: "bedah", name: "Sektor Bedah", display: "KA SUB TIM BEDAH" },
  { key: "usg", name: "Pemeriksaan USG", display: "KA SUB TIM USG" },
  { key: "radiologi", name: "Pemeriksaan Radiologi", display: "KA SUB TIM RADIOLOGI" },
  { key: "jantung_ekg", name: "Pemeriksaan Jantung (EKG)", display: "KA SUB TIM JANTUNG" },
  { key: "laboratorium", name: "Laboratorium", display: "KA SUB TIM LABORATORIUM" },
  { key: "keswa", name: "Jiwa / Keswa", display: "KA SUB TIM KESWA" },
];

type Row = {
  id: string;
  selection_id: string | null;
  section_key: string;
  section_name: string;
  display_title: string;
  doctor_name: string | null;
  doctor_title: string | null;
  rank: string | null;
  nrp: string | null;
  location: string | null;
  signature_url: string | null;
  is_active: boolean;
};

function MedicalSubteamsPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("super_admin") || roles.includes("admin");
  const [rows, setRows] = useState<Row[]>([]);
  const [selections, setSelections] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Row> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: sb }, { data: sel }] = await Promise.all([
      localDataApi.from("medical_subteams").select("*").order("section_key"),
      localDataApi.from("selections").select("id,name").order("created_at", { ascending: false }),
    ]);
    setRows((sb ?? []) as Row[]);
    setSelections((sel ?? []) as any);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function startNew() {
    setEditing({
      section_key: SECTION_OPTIONS[0].key,
      section_name: SECTION_OPTIONS[0].name,
      display_title: SECTION_OPTIONS[0].display,
      is_active: true,
    });
    setOpen(true);
  }
  function startEdit(r: Row) { setEditing({ ...r }); setOpen(true); }

  async function save() {
    if (!editing) return;
    const payload: any = {
      selection_id: editing.selection_id || null,
      section_key: editing.section_key,
      section_name: editing.section_name,
      display_title: editing.display_title,
      doctor_name: editing.doctor_name ?? null,
      doctor_title: editing.doctor_title ?? null,
      rank: editing.rank ?? null,
      nrp: editing.nrp ?? null,
      location: editing.location ?? null,
      signature_url: editing.signature_url ?? null,
      is_active: editing.is_active ?? true,
    };
    try {
      if (editing.id) {
        const { error } = await localDataApi.from("medical_subteams").update(payload).eq("id", editing.id);
        if (error) throw error;
        await logAudit({ action: "update_medical_subteam", module: "master", record_id: editing.id, after: payload });
      } else {
        const { data, error } = await localDataApi.from("medical_subteams").insert(payload).select().single();
        if (error) throw error;
        await logAudit({ action: "create_medical_subteam", module: "master", record_id: data?.id, after: payload });
      }
      toast.success("Tersimpan");
      setOpen(false); setEditing(null); load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function remove(r: Row) {
    if (!confirm(`Hapus subtim ${r.display_title}?`)) return;
    const { error } = await localDataApi.from("medical_subteams").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    await logAudit({ action: "delete_medical_subteam", module: "master", record_id: r.id, before: r });
    toast.success("Dihapus"); load();
  }

  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="bg-white border rounded-xl p-8 text-center">
          <ShieldAlert className="h-10 w-10 mx-auto text-orange-500" />
          <h2 className="text-lg font-bold mt-3">Akses Ditolak</h2>
          <p className="text-sm text-slate-600 mt-1">Hanya Super Admin / Admin yang bisa mengelola Master Subtim.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Master Subtim Pemeriksaan</h1>
          <p className="text-sm text-slate-600 mt-1">Dokter penanggung jawab dan tanda tangan per sektor untuk Lembar Evaluasi Kesehatan.</p>
        </div>
        <Button onClick={startNew}><Plus className="h-4 w-4 mr-2" /> Tambah Subtim</Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="text-left p-3">Sektor</th>
              <th className="text-left p-3">Jabatan Tampil</th>
              <th className="text-left p-3">Dokter</th>
              <th className="text-left p-3">Pangkat / NRP</th>
              <th className="text-left p-3">Lokasi</th>
              <th className="text-left p-3">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="p-6 text-center text-slate-400">Memuat…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-slate-400">Belum ada subtim. Tambahkan untuk setiap sektor pemeriksaan.</td></tr>
              : rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="p-3 font-medium">{r.section_name}</td>
                  <td className="p-3 text-slate-700">{r.display_title}</td>
                  <td className="p-3">{r.doctor_name ?? <span className="text-slate-400 italic">—</span>}{r.doctor_title ? `, ${r.doctor_title}` : ""}</td>
                  <td className="p-3 text-slate-700">{[r.rank, r.nrp].filter(Boolean).join(" / ") || <span className="text-slate-400 italic">—</span>}</td>
                  <td className="p-3">{r.location ?? <span className="text-slate-400 italic">—</span>}</td>
                  <td className="p-3">{r.is_active ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Aktif</Badge> : <Badge variant="secondary">Nonaktif</Badge>}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => startEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="destructive" onClick={() => remove(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit Subtim" : "Tambah Subtim"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Sektor</Label>
                <Select
                  value={editing.section_key}
                  onValueChange={(v) => {
                    const opt = SECTION_OPTIONS.find((s) => s.key === v)!;
                    setEditing({ ...editing, section_key: opt.key, section_name: opt.name, display_title: editing.display_title || opt.display });
                  }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SECTION_OPTIONS.map((s) => <SelectItem key={s.key} value={s.key}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Seleksi (opsional, kosongkan = berlaku semua)</Label>
                <Select value={editing.selection_id ?? "__none"} onValueChange={(v) => setEditing({ ...editing, selection_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Semua seleksi" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— Semua Seleksi —</SelectItem>
                    {selections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">Jabatan Tampil di PDF</Label>
                <Input value={editing.display_title ?? ""} onChange={(e) => setEditing({ ...editing, display_title: e.target.value })} placeholder="KA SUB TIM ..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nama Dokter</Label>
                <Input value={editing.doctor_name ?? ""} onChange={(e) => setEditing({ ...editing, doctor_name: e.target.value })} placeholder="dr. Nama Lengkap" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Gelar / Spesialis</Label>
                <Input value={editing.doctor_title ?? ""} onChange={(e) => setEditing({ ...editing, doctor_title: e.target.value })} placeholder="Sp.PD / Sp.M / drg." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Pangkat</Label>
                <Input value={editing.rank ?? ""} onChange={(e) => setEditing({ ...editing, rank: e.target.value })} placeholder="Letkol Kes / Lettu Kes" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">NRP</Label>
                <Input value={editing.nrp ?? ""} onChange={(e) => setEditing({ ...editing, nrp: e.target.value })} placeholder="535885" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Lokasi</Label>
                <Input value={editing.location ?? ""} onChange={(e) => setEditing({ ...editing, location: e.target.value })} placeholder="Surakarta" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">URL Tanda Tangan (opsional)</Label>
                <Input value={editing.signature_url ?? ""} onChange={(e) => setEditing({ ...editing, signature_url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="inline-flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={!!editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                  Aktif
                </Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}