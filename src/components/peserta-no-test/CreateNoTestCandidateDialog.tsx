import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

type Selection = { id: string; name: string; year_label?: string | null };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
};

const INITIAL = {
  selection_id: "",
  full_name: "",
  gender: "L",
  unit_position: "",
  rank: "",
  nrp_nip: "",
  birth_place: "",
  birth_date: "",
  group_name: "",
  pok_korp: "",
  panda: "",
  address: "",
  phone: "",
  test_number: "",
  registration_notes: "",
};

export function CreateNoTestCandidateDialog({ open, onOpenChange, onCreated }: Props) {
  const [selections, setSelections] = useState<Selection[]>([]);
  const [form, setForm] = useState({ ...INITIAL });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("selections")
      .select("id, name, year_label")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        const list = (data ?? []) as Selection[];
        setSelections(list);
        setForm((f) => ({ ...f, selection_id: f.selection_id || list[0]?.id || "" }));
      });
  }, [open]);

  function set<K extends keyof typeof INITIAL>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.selection_id) return toast.error("Pilih seleksi terlebih dahulu");
    if (!form.full_name.trim()) return toast.error("Nama lengkap wajib diisi");

    setSaving(true);
    try {
      const tn = form.test_number.trim();
      if (tn) {
        const { data: dup } = await supabase
          .from("candidates")
          .select("id")
          .eq("selection_id", form.selection_id)
          .eq("test_number", tn)
          .is("deleted_at", null)
          .limit(1)
          .maybeSingle();
        if (dup) {
          setSaving(false);
          return toast.error("No Test sudah dipakai pada seleksi ini");
        }
      }

      const payload: Record<string, unknown> = {
        selection_id: form.selection_id,
        full_name: form.full_name.trim(),
        gender: form.gender,
        unit_position: form.unit_position || null,
        rank: form.rank || null,
        nrp_nip: form.nrp_nip || null,
        birth_place: form.birth_place || null,
        group_name: form.group_name || null,
        pok_korp: form.pok_korp || null,
        panda: form.panda || null,
        address: form.address || null,
        phone: form.phone || null,
        registration_notes: form.registration_notes || null,
        test_number: tn || null,
        test_number_status: tn ? "Final" : "Belum Ada",
        combined_identity: `${form.full_name.trim()} ${form.rank ? `(${form.rank})` : ""} ${form.nrp_nip ?? ""}`.trim(),
      };
      if (form.birth_date) payload.birth_date = form.birth_date;
      if (tn) {
        const { data: u } = await supabase.auth.getUser();
        payload.test_number_assigned_at = new Date().toISOString();
        payload.test_number_assigned_by = u.user?.id ?? null;
      }

      const { data: cand, error } = await supabase
        .from("candidates")
        .insert(payload as never)
        .select()
        .single();
      if (error) throw error;

      await logAudit({
        action: tn ? "create_candidate" : "create_candidate_without_test_number",
        module: "peserta_tanpa_no_test",
        record_id: cand.id,
        candidate_id: cand.id,
        after: cand,
      });

      toast.success(
        tn
          ? `Peserta dibuat dengan No Test ${tn}`
          : `Peserta dibuat dengan Temporary ID ${cand.temporary_id ?? "(TMP)"}`,
      );
      setForm({ ...INITIAL, selection_id: form.selection_id });
      onCreated();
      onOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal menyimpan";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Peserta Tanpa No Test</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2 space-y-1">
              <Label className="text-xs">Seleksi <span className="text-rose-600">*</span></Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.selection_id}
                onChange={(e) => set("selection_id", e.target.value)}
                required
              >
                <option value="">— Pilih Seleksi —</option>
                {selections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.year_label ? `— ${s.year_label}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <F label="Nama Lengkap *">
              <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} required />
            </F>
            <div className="space-y-1">
              <Label className="text-xs">Jenis Kelamin *</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.gender}
                onChange={(e) => set("gender", e.target.value)}
              >
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>

            <F label="Pangkat"><Input value={form.rank} onChange={(e) => set("rank", e.target.value)} /></F>
            <F label="NRP / NIP"><Input value={form.nrp_nip} onChange={(e) => set("nrp_nip", e.target.value)} /></F>
            <F label="Satuan / Kesatuan"><Input value={form.unit_position} onChange={(e) => set("unit_position", e.target.value)} /></F>
            <F label="Pok / Korp"><Input value={form.pok_korp} onChange={(e) => set("pok_korp", e.target.value)} /></F>
            <F label="Panda"><Input value={form.panda} onChange={(e) => set("panda", e.target.value)} /></F>
            <F label="Kelompok"><Input value={form.group_name} onChange={(e) => set("group_name", e.target.value)} /></F>
            <F label="Tempat Lahir"><Input value={form.birth_place} onChange={(e) => set("birth_place", e.target.value)} /></F>
            <F label="Tanggal Lahir"><Input type="date" value={form.birth_date} onChange={(e) => set("birth_date", e.target.value)} /></F>
            <F label="Nomor HP"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></F>
            <F label="Alamat"><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></F>

            <div className="md:col-span-2 space-y-1">
              <Label className="text-xs">No Test (opsional — kosongkan jika belum ada)</Label>
              <Input
                value={form.test_number}
                onChange={(e) => set("test_number", e.target.value)}
                placeholder="Boleh kosong; Temporary ID akan dibuat otomatis"
              />
              <p className="text-[11px] text-slate-500">
                Jika kosong, sistem akan membuat <span className="font-mono">TMP-YYYYMMDD-NNNN</span> otomatis dan peserta langsung masuk antrian Rontgen & EKG.
              </p>
            </div>

            <div className="md:col-span-2 space-y-1">
              <Label className="text-xs">Catatan Registrasi</Label>
              <Textarea
                rows={2}
                value={form.registration_notes}
                onChange={(e) => set("registration_notes", e.target.value)}
                placeholder="Catatan khusus saat registrasi (opsional)"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Simpan Peserta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}