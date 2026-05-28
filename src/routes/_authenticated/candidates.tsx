import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { TableExportMenu } from "@/components/export/TableExportMenu";
import { useAuth } from "@/lib/use-auth";
import { DeletePersonnelDialog } from "@/components/app/DeletePersonnelDialog";

export const Route = createFileRoute("/_authenticated/candidates")({
  component: CandidatesPage,
});

type Cand = {
  id: string;
  test_number: string | null;
  full_name: string;
  rank: string | null;
  nrp_nip: string | null;
  pok_korp: string | null;
  panda: string | null;
  selection_id: string;
  temporary_id?: string | null;
};
type Sel = { id: string; name: string; year_label: string };

function CandidatesPage() {
  const [cands, setCands] = useState<Cand[]>([]);
  const [sels, setSels] = useState<Sel[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [delTarget, setDelTarget] = useState<Cand | null>(null);
  const { hasAnyRole } = useAuth();
  const canDelete = hasAnyRole(["super_admin", "tester"]);

  async function load() {
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from("candidates").select("*").is("deleted_at", null).order("serial_number"),
      supabase.from("selections").select("id,name,year_label"),
    ]);
    setCands((c ?? []) as Cand[]);
    setSels((s ?? []) as Sel[]);
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = cands.filter((c) =>
    [c.full_name, c.test_number, c.nrp_nip].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Peserta</h1>
          <p className="text-sm text-muted-foreground">Kelola data peserta pemeriksaan.</p>
        </div>
        <div className="flex gap-2">
          <TableExportMenu
            data={filtered}
            filename="peserta"
            title="Daftar Peserta"
            columns={[
              { key: "test_number", label: "No Tes" },
              { key: "full_name", label: "Nama" },
              { key: "rank", label: "Pangkat" },
              { key: "nrp_nip", label: "NRP/NIP" },
              { key: "pok_korp", label: "Pok/Korp" },
              { key: "panda", label: "Panda" },
            ]}
          />
          <Button variant="outline" onClick={() => seedDemo(load)}>
            <Sparkles className="h-4 w-4 mr-2" /> Seed Demo
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={sels.length === 0}>
                <Plus className="h-4 w-4 mr-2" /> Peserta Baru
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Peserta</DialogTitle>
              </DialogHeader>
              <CandidateForm
                selections={sels}
                onDone={() => {
                  setOpen(false);
                  load();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Input placeholder="Cari nama, no tes, NRP..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="text-left p-3">No Tes</th>
                <th className="text-left p-3">Nama</th>
                <th className="text-left p-3">Pangkat/NRP</th>
                <th className="text-left p-3">Pok</th>
                <th className="text-left p-3">Panda</th>
                <th className="text-right p-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{c.test_number ?? "-"}</td>
                  <td className="p-3 font-medium">{c.full_name}</td>
                  <td className="p-3 text-xs">{c.rank} / {c.nrp_nip}</td>
                  <td className="p-3"><Badge variant="outline">{c.pok_korp ?? "-"}</Badge></td>
                  <td className="p-3">{c.panda ?? "-"}</td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link to="/rikkes/$id" params={{ id: c.id }} className="text-accent hover:underline text-sm">
                        Detail →
                      </Link>
                      {canDelete && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDelTarget(c)}
                          title="Hapus permanen"
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Hapus
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Belum ada peserta.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <DeletePersonnelDialog
        open={!!delTarget}
        onOpenChange={(o) => !o && setDelTarget(null)}
        candidate={delTarget}
        onDeleted={load}
      />
    </div>
  );
}

function CandidateForm({ selections, onDone }: { selections: Sel[]; onDone: () => void }) {
  const [form, setForm] = useState({
    selection_id: selections[0]?.id ?? "",
    test_number: "",
    pok_korp: "",
    panda: "",
    unit_position: "",
    full_name: "",
    rank: "",
    nrp_nip: "",
    generation: "",
    birth_place: "",
    birth_date: "",
    gender: "L",
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const combined = `${form.full_name} ${form.rank ? `(${form.rank})` : ""} ${form.nrp_nip ?? ""}`.trim();
    const payload: any = { ...form, combined_identity: combined };
    if (!payload.birth_date) delete payload.birth_date;
    const { data: cand, error } = await supabase.from("candidates").insert(payload).select().single();
    if (error) return toast.error(error.message);
    // exam + 25 sections + measurements + summary are created automatically
    // by the create_exam_for_candidate() database trigger.
    await logAudit({ action: "create", module: "candidates", record_id: cand.id, candidate_id: cand.id, after: cand });
    toast.success("Peserta dibuat");
    onDone();
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form onSubmit={save} className="grid grid-cols-2 gap-3">
      <div className="col-span-2 space-y-1">
        <Label className="text-xs">Seleksi</Label>
        <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.selection_id} onChange={set("selection_id")} required>
          {selections.map((s) => (
            <option key={s.id} value={s.id}>{s.name} — {s.year_label}</option>
          ))}
        </select>
      </div>
      <Field label="No Tes"><Input value={form.test_number} onChange={set("test_number")} required /></Field>
      <Field label="Nama Lengkap"><Input value={form.full_name} onChange={set("full_name")} required /></Field>
      <Field label="Pangkat"><Input value={form.rank} onChange={set("rank")} /></Field>
      <Field label="NRP/NIP"><Input value={form.nrp_nip} onChange={set("nrp_nip")} /></Field>
      <Field label="Pok/Korp"><Input value={form.pok_korp} onChange={set("pok_korp")} /></Field>
      <Field label="Panda"><Input value={form.panda} onChange={set("panda")} /></Field>
      <Field label="Satuan/Jabatan"><Input value={form.unit_position} onChange={set("unit_position")} /></Field>
      <Field label="Angkatan"><Input value={form.generation} onChange={set("generation")} /></Field>
      <Field label="Tempat Lahir"><Input value={form.birth_place} onChange={set("birth_place")} /></Field>
      <Field label="Tanggal Lahir"><Input type="date" value={form.birth_date} onChange={set("birth_date")} /></Field>
      <div className="col-span-2 flex justify-end">
        <Button type="submit">Simpan</Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

const DEMO_NAMES = [
  ["Adi Pranata", "Lettu", "552341"],
  ["Bayu Saputra", "Lettu", "552342"],
  ["Citra Maharani", "Letda", "552343"],
  ["Dimas Pratama", "Lettu", "552344"],
  ["Eko Wibowo", "Kapten", "552345"],
  ["Fitri Handayani", "Letda", "552346"],
  ["Galih Permana", "Lettu", "552347"],
  ["Hadi Saputra", "Lettu", "552348"],
  ["Indah Cahyani", "Letda", "552349"],
  ["Joko Setiawan", "Kapten", "552350"],
  ["Kartika Dewi", "Lettu", "552351"],
  ["Lukman Hakim", "Lettu", "552352"],
  ["Maya Putri", "Letda", "552353"],
  ["Nanda Wijaya", "Lettu", "552354"],
  ["Oka Saputra", "Lettu", "552355"],
  ["Putri Larasati", "Letda", "552356"],
  ["Qori Aulia", "Lettu", "552357"],
  ["Rama Aditya", "Kapten", "552358"],
  ["Sinta Permata", "Letda", "552359"],
  ["Toni Hartono", "Lettu", "552360"],
] as const;

const POK = ["TEK", "ADM", "LEK", "KES"];
const PANDA = ["JAKARTA", "BANDUNG", "SURABAYA", "MEDAN"];

async function seedDemo(reload: () => Promise<void>) {
  let { data: sel } = await supabase.from("selections").select("id").limit(1).maybeSingle();
  if (!sel) {
    const { data } = await supabase
      .from("selections")
      .insert({
        name: "SUSPAJEMEN A-36",
        year_label: "TA 2026",
        participant_label: "CALON PASIS",
        report_subtitle: "CALON PASIS SUSPAJEMEN A-36 TAHUN 2026",
        location: "Surakarta",
        status: "Aktif",
      })
      .select("id")
      .single();
    sel = data;
  }
  if (!sel) return toast.error("Gagal membuat seleksi demo");

  for (let i = 0; i < DEMO_NAMES.length; i++) {
    const [name, rank, nrp] = DEMO_NAMES[i];
    const { data: c, error } = await supabase
      .from("candidates")
      .insert({
        selection_id: sel.id,
        serial_number: i + 1,
        test_number: `T-2026-${String(i + 1).padStart(3, "0")}`,
        pok_korp: POK[i % POK.length],
        panda: PANDA[i % PANDA.length],
        unit_position: "Skadron 1",
        full_name: name,
        rank,
        nrp_nip: nrp,
        generation: "A-36",
        gender: i % 5 === 2 ? "P" : "L",
        combined_identity: `${name} (${rank}) ${nrp}`,
      })
      .select("id")
      .single();
    if (error || !c) continue;

    // Vary section statuses to populate dashboard
    // bucket: 0-4 In Progress (draft), 5-9 Pending Review (all submitted),
    // 10-12 Revision Needed, 13-14 Finalized, 15-19 partial draft
    const bucket = i;
    if (bucket >= 5 && bucket <= 9) {
      await supabase
        .from("exam_sections")
        .update({ section_status: "Submitted", submitted_at: new Date().toISOString() })
        .eq("candidate_id", c.id);
    } else if (bucket >= 10 && bucket <= 12) {
      await supabase
        .from("exam_sections")
        .update({ section_status: "Revision", revision_requested_at: new Date().toISOString(), revision_reason: "Lengkapi temuan" })
        .eq("candidate_id", c.id)
        .in("section_key", ["laboratorium", "tht"]);
    } else if (bucket >= 13 && bucket <= 14) {
      await supabase
        .from("exam_sections")
        .update({ section_status: "Locked", locked_at: new Date().toISOString() })
        .eq("candidate_id", c.id);
    } else if (bucket >= 15) {
      await supabase
        .from("exam_sections")
        .update({ section_status: "Submitted", submitted_at: new Date().toISOString() })
        .eq("candidate_id", c.id)
        .in("section_key", ["identitas", "anamnesa", "pemeriksaan_umum"]);
    }
  }
  toast.success(`${DEMO_NAMES.length} peserta demo dibuat`);
  await reload();
}