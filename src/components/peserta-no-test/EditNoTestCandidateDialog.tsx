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

export type EditCandidate = {
  id: string;
  temporary_id: string | null;
  full_name: string;
  gender: string | null;
  rank: string | null;
  nrp_nip: string | null;
  unit_position: string | null;
  pok_korp: string | null;
  panda: string | null;
  group_name: string | null;
  birth_place: string | null;
  birth_date: string | null;
  phone: string | null;
  address: string | null;
  registration_notes: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidate: EditCandidate | null;
  onSaved: () => void;
};

export function EditNoTestCandidateDialog({ open, onOpenChange, candidate, onSaved }: Props) {
  const [form, setForm] = useState<EditCandidate | null>(candidate);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(candidate);
  }, [candidate]);

  if (!form) return null;

  function setF<K extends keyof EditCandidate>(k: K, v: EditCandidate[K]) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.full_name?.trim()) return toast.error("Nama wajib diisi");
    setSaving(true);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        gender: form.gender,
        rank: form.rank || null,
        nrp_nip: form.nrp_nip || null,
        unit_position: form.unit_position || null,
        pok_korp: form.pok_korp || null,
        panda: form.panda || null,
        group_name: form.group_name || null,
        birth_place: form.birth_place || null,
        birth_date: form.birth_date || null,
        phone: form.phone || null,
        address: form.address || null,
        registration_notes: form.registration_notes || null,
      };
      const { error } = await supabase.from("candidates").update(payload as never).eq("id", form.id);
      if (error) throw error;
      await logAudit({
        action: "edit_candidate_without_test_number",
        module: "peserta_tanpa_no_test",
        record_id: form.id,
        candidate_id: form.id,
        after: payload,
      });
      toast.success("Perubahan tersimpan");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Peserta</DialogTitle>
          {form.temporary_id && (
            <p className="text-xs text-slate-500 font-mono">Temporary ID: {form.temporary_id}</p>
          )}
        </DialogHeader>

        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nama Lengkap *</Label>
            <Input value={form.full_name} onChange={(e) => setF("full_name", e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Jenis Kelamin</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={form.gender ?? "L"}
              onChange={(e) => setF("gender", e.target.value)}
            >
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
          </div>
          <FF label="Pangkat" v={form.rank ?? ""} on={(v) => setF("rank", v)} />
          <FF label="NRP / NIP" v={form.nrp_nip ?? ""} on={(v) => setF("nrp_nip", v)} />
          <FF label="Satuan / Kesatuan" v={form.unit_position ?? ""} on={(v) => setF("unit_position", v)} />
          <FF label="Pok / Korp" v={form.pok_korp ?? ""} on={(v) => setF("pok_korp", v)} />
          <FF label="Panda" v={form.panda ?? ""} on={(v) => setF("panda", v)} />
          <FF label="Kelompok" v={form.group_name ?? ""} on={(v) => setF("group_name", v)} />
          <FF label="Tempat Lahir" v={form.birth_place ?? ""} on={(v) => setF("birth_place", v)} />
          <div className="space-y-1">
            <Label className="text-xs">Tanggal Lahir</Label>
            <Input type="date" value={form.birth_date ?? ""} onChange={(e) => setF("birth_date", e.target.value)} />
          </div>
          <FF label="Nomor HP" v={form.phone ?? ""} on={(v) => setF("phone", v)} />
          <FF label="Alamat" v={form.address ?? ""} on={(v) => setF("address", v)} />
          <div className="md:col-span-2 space-y-1">
            <Label className="text-xs">Catatan Registrasi</Label>
            <Textarea
              rows={2}
              value={form.registration_notes ?? ""}
              onChange={(e) => setF("registration_notes", e.target.value)}
            />
          </div>

          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FF({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}