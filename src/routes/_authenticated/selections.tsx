import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { createSelection, deleteSelection, listSelections, setDefaultSelection, updateSelection } from "@/lib/selectionService";
import { getDb } from "@/lib/localDb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { logAudit } from "@/lib/audit";
import { ExportDialog } from "@/components/export/ExportDialog";
import { SelectionCard, type SelectionCardData } from "@/components/selection/SelectionCard";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/selections")({
  beforeLoad: async () => {},
  component: SelectionsPage,
});

type Selection = {
  id: string;
  name: string;
  year_label: string;
  participant_label: string;
  institution_header_line_1: string;
  institution_header_line_2: string;
  report_title: string;
  report_subtitle: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  is_default: boolean;
};

function SelectionsPage() {
  const [items, setItems] = useState<Selection[]>([]);
  const [open, setOpen] = useState(false);
  const [exportSel, setExportSel] = useState<Selection | null>(null);
  const [editSel, setEditSel] = useState<Selection | null>(null);
  const [deleteSel, setDeleteSel] = useState<Selection | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  async function load() {
    const data = await listSelections();
    setItems((data ?? []) as Selection[]);
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((s) => {
      if (statusFilter !== "all" && (s.status ?? "").toLowerCase() !== statusFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.year_label.toLowerCase().includes(q) ||
        (s.location ?? "").toLowerCase().includes(q) ||
        s.participant_label.toLowerCase().includes(q)
      );
    });
  }, [items, search, statusFilter]);

  async function setAsDefault(s: Selection) {
    await setDefaultSelection(s.id);
    const db = getDb() as any;
    await logAudit({ action: "set_default", module: "selections", record_id: s.id, before: s, after: db.selections.find((x: any) => x.id === s.id) });
    toast.success("Seleksi default diperbarui");
    load();
  }

  async function toggleStatus(s: Selection) {
    const next = ["inactive", "nonaktif"].includes((s.status ?? "").toLowerCase()) ? "active" : "inactive";
    const patch: any = { status: next };
    if (next === "inactive" && s.is_default) patch.is_default = false;
    const data = await updateSelection(s.id, patch);
    await logAudit({
      action: next === "inactive" ? "deactivate" : "activate",
      module: "selections",
      record_id: s.id,
      before: s,
      after: data,
    });
    toast.success(`Seleksi ${next === "inactive" ? "dinonaktifkan" : "diaktifkan"}`);
    load();
  }

  async function doDelete() {
    if (!deleteSel) return;
    const count = ((getDb() as any).candidates ?? []).filter((c: any) => c.selection_id === deleteSel.id).length;
    if ((count ?? 0) > 0) {
      toast.error(`Tidak bisa dihapus: masih ada ${count} peserta. Nonaktifkan saja.`);
      setDeleteSel(null);
      return;
    }
    await deleteSelection(deleteSel.id);
    await logAudit({ action: "delete", module: "selections", record_id: deleteSel.id, before: deleteSel });
    toast.success("Seleksi dihapus");
    setDeleteSel(null);
    load();
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Master Seleksi</h1>
          <p className="text-sm text-muted-foreground">Kelola event seleksi pemeriksaan kesehatan.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Seleksi Baru
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Tambah Seleksi</DialogTitle>
            </DialogHeader>
            <SelectionForm
              onDone={() => {
                setOpen(false);
                load();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            placeholder="Cari nama, tahun, lokasi…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            <SelectItem value="active">Aktif</SelectItem>
            <SelectItem value="inactive">Nonaktif</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground">{filtered.length} / {items.length}</div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {filtered.map((s) => (
          <SelectionCard
            key={s.id}
            mode="management"
            canExport
            canEdit
            canSetDefault
            canToggleStatus
            canDelete
            onExport={(x) => setExportSel(items.find((i) => i.id === x.id) ?? null)}
            onEdit={(x) => setEditSel(items.find((i) => i.id === x.id) ?? null)}
            onSetDefault={(x) => setAsDefault(items.find((i) => i.id === x.id)!)}
            onToggleStatus={(x) => toggleStatus(items.find((i) => i.id === x.id)!)}
            onDelete={(x) => setDeleteSel(items.find((i) => i.id === x.id) ?? null)}
            selection={s as SelectionCardData}
          />
        ))}
        {filtered.length === 0 && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground col-span-2">Belum ada seleksi. Tambahkan untuk memulai.</CardContent></Card>
        )}
      </div>
      {exportSel && (
        <ExportDialog
          open={!!exportSel}
          onOpenChange={(v) => !v && setExportSel(null)}
          selectionId={exportSel.id}
          selectionLabel={`${exportSel.name} ${exportSel.year_label}`}
        />
      )}
      {editSel && (
        <Dialog open={!!editSel} onOpenChange={(v) => !v && setEditSel(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Ubah Seleksi</DialogTitle>
            </DialogHeader>
            <SelectionForm
              existing={editSel}
              onDone={() => {
                setEditSel(null);
                load();
              }}
            />
          </DialogContent>
        </Dialog>
      )}
      <AlertDialog open={!!deleteSel} onOpenChange={(v) => !v && setDeleteSel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus seleksi?</AlertDialogTitle>
            <AlertDialogDescription>
              Aksi ini tidak bisa dibatalkan. Seleksi yang masih memiliki peserta tidak bisa dihapus — gunakan
              "Nonaktifkan" sebagai gantinya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SelectionForm({ onDone, existing }: { onDone: () => void; existing?: Selection }) {
  const [form, setForm] = useState({
    name: existing?.name ?? "SUSPAJEMEN A-36",
    year_label: existing?.year_label ?? "TA 2026",
    participant_label: existing?.participant_label ?? "Calon Pasis",
    institution_header_line_1: existing?.institution_header_line_1 ?? "MARKAS BESAR TNI ANGKATAN UDARA",
    institution_header_line_2: existing?.institution_header_line_2 ?? "PUSAT KESEHATAN",
    report_title: existing?.report_title ?? "HASIL PEMERIKSAAN KESEHATAN",
    report_subtitle: existing?.report_subtitle ?? "CALON PASIS SUSPAJEMEN A-36 TAHUN 2026",
    location: existing?.location ?? "",
    start_date: existing?.start_date ?? "",
    end_date: existing?.end_date ?? "",
    status: existing?.status ?? "Aktif",
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.start_date) delete payload.start_date;
    if (!payload.end_date) delete payload.end_date;
    try {
      if (existing) {
        const data = await updateSelection(existing.id, payload);
        await logAudit({ action: "update", module: "selections", record_id: existing.id, before: existing, after: data });
        toast.success("Seleksi diperbarui");
      } else {
        const data = await createSelection(payload);
        await logAudit({ action: "create", module: "selections", record_id: data.id, after: data });
        toast.success("Seleksi dibuat");
      }
      onDone();
    } catch (err: any) {
      const code = err?.code ?? "unknown";
      const message = err?.message ?? "unknown";
      if (String(code) === "42501" || /row-level security|permission/i.test(String(message))) {
        toast.error("Gagal membuat seleksi. Akun Anda belum memiliki izin untuk menambah seleksi.");
      } else {
        if (message === "Session lokal tidak valid. Silakan login ulang.") {
          toast.error(message);
          window.location.href = "/login";
          return;
        }
        toast.error(message);
      }
      console.error("Selection mutation failed", {
        table: "selections",
        action: existing ? "update" : "insert",
        code,
        message,
        storage_mode: "local",
      });
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form onSubmit={save} className="grid grid-cols-2 gap-3">
      <Field label="Nama Seleksi"><Input value={form.name} onChange={set("name")} required /></Field>
      <Field label="Tahun"><Input value={form.year_label} onChange={set("year_label")} required /></Field>
      <Field label="Jenis Peserta"><Input value={form.participant_label} onChange={set("participant_label")} required /></Field>
      <Field label="Status"><Input value={form.status} onChange={set("status")} /></Field>
      <Field label="Header Instansi 1" full><Input value={form.institution_header_line_1} onChange={set("institution_header_line_1")} /></Field>
      <Field label="Header Instansi 2" full><Input value={form.institution_header_line_2} onChange={set("institution_header_line_2")} /></Field>
      <Field label="Judul Laporan" full><Input value={form.report_title} onChange={set("report_title")} /></Field>
      <Field label="Subjudul Laporan" full><Input value={form.report_subtitle} onChange={set("report_subtitle")} /></Field>
      <Field label="Lokasi" full><Input value={form.location} onChange={set("location")} /></Field>
      <Field label="Tanggal Mulai"><Input type="date" value={form.start_date} onChange={set("start_date")} /></Field>
      <Field label="Tanggal Selesai"><Input type="date" value={form.end_date} onChange={set("end_date")} /></Field>
      <div className="col-span-2 flex justify-end">
        <Button type="submit">Simpan</Button>
      </div>
    </form>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`space-y-1 ${full ? "col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}