import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@/shims/tanstack-react-start";
import { localDataApi } from "@/lib/localDataApi";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ShieldCheck,
  ShieldOff,
  UserPlus,
  Search,
  Trash2,
  Pencil,
  KeyRound,
  History,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createUserAccount,
  deleteUserAccount,
  resetUserPassword,
} from "@/lib/user-management.functions";
import { seedTestAccounts } from "@/lib/permissions/seed-test-accounts.functions";
import { SectionAssignmentDialog } from "@/components/user-management/SectionAssignmentDialog";
import { EffectivePermissionsDialog } from "@/components/user-management/EffectivePermissionsDialog";
import { Sparkles, ListChecks, Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/user-management")({
  component: UserManagementPage,
});

type Role =
  | "super_admin"
  | "admin"
  | "kepala_sub_tim"
  | "dokter"
  | "dokter_spesialis"
  | "dokter_gigi"
  | "radiologi"
  | "lab"
  | "tester"
  | "registrasi"
  | "viewer";

const ROLE_GROUPS: { title: string; roles: { value: Role; label: string; desc: string }[] }[] = [
  {
    title: "Administrator",
    roles: [
      { value: "super_admin", label: "Super Admin", desc: "Akses penuh sistem & kelola peran" },
      { value: "admin", label: "Admin", desc: "Kelola data & operasional" },
      { value: "kepala_sub_tim", label: "Kepala Sub Tim", desc: "Verifikasi & finalisasi" },
    ],
  },
  {
    title: "Tim Medis",
    roles: [
      { value: "dokter", label: "Dokter Umum", desc: "Pemeriksaan umum" },
      { value: "dokter_spesialis", label: "Dokter Spesialis", desc: "Pemeriksaan spesialistik" },
      { value: "dokter_gigi", label: "Dokter Gigi", desc: "Odontogram & gigi" },
      { value: "radiologi", label: "Radiologi", desc: "Rontgen / USG" },
      { value: "lab", label: "Laboratorium", desc: "Pemeriksaan lab" },
    ],
  },
  {
    title: "Lainnya",
    roles: [
      { value: "registrasi", label: "Registrasi", desc: "Pendataan peserta" },
      { value: "tester", label: "Tester / QA", desc: "Uji coba sistem" },
      { value: "viewer", label: "Viewer", desc: "Hanya melihat" },
    ],
  },
];

const ALL_ROLES = ROLE_GROUPS.flatMap((g) => g.roles);

interface ProfileRow {
  id: string;
  auth_user_id: string;
  full_name: string;
  email: string | null;
  rank: string | null;
  unit: string | null;
  is_active: boolean;
  created_at: string;
  roles: Role[];
}

interface AuditRow {
  id: string;
  action: string;
  record_id: string | null;
  user_id: string | null;
  created_at: string;
  before_data: any;
  after_data: any;
}

async function writeClientAudit(args: {
  action: string;
  recordId?: string;
  before?: any;
  after?: any;
}) {
  const { data: u } = await localDataApi.auth.getUser();
  if (!u.user) return;
  await localDataApi.from("audit_logs").insert({
    user_id: u.user.id,
    action: args.action,
    module: "user_management",
    record_id: args.recordId ?? null,
    before_data: args.before ?? null,
    after_data: args.after ?? null,
  });
}

function UserManagementPage() {
  const { hasRole, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterRole, setFilterRole] = useState<Role | "all">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProfileRow | null>(null);
  const [pwTarget, setPwTarget] = useState<ProfileRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProfileRow | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [sectionTarget, setSectionTarget] = useState<ProfileRow | null>(null);
  const [permTarget, setPermTarget] = useState<ProfileRow | null>(null);

  const callCreate = useServerFn(createUserAccount);
  const callDelete = useServerFn(deleteUserAccount);
  const callResetPw = useServerFn(resetUserPassword);
  const callSeed = useServerFn(seedTestAccounts);

  const isSuper = hasRole("super_admin");

  useEffect(() => {
    if (authLoading) return;
    if (!isSuper) {
      toast.error("Hanya Super Admin yang dapat mengakses Manajemen Pengguna");
      nav({ to: "/dashboard" });
      return;
    }
    void load();
  }, [authLoading, isSuper]);

  async function load() {
    setLoading(true);
    const [{ data: profiles, error: pe }, { data: rolesData, error: re }] = await Promise.all([
      localDataApi
        .from("profiles")
        .select("id, auth_user_id, full_name, email, rank, unit, is_active, created_at")
        .order("created_at", { ascending: false }),
      localDataApi.from("user_roles").select("user_id, role"),
    ]);
    if (pe || re) {
      toast.error("Gagal memuat data pengguna");
      setLoading(false);
      return;
    }
    const map = new Map<string, Role[]>();
    (rolesData ?? []).forEach((r: any) => {
      const arr = map.get(r.user_id) ?? [];
      arr.push(r.role as Role);
      map.set(r.user_id, arr);
    });
    setRows(
      (profiles ?? []).map((p: any) => ({
        ...p,
        roles: map.get(p.auth_user_id) ?? [],
      })),
    );
    setLoading(false);
    void loadAudit();
  }

  async function loadAudit() {
    const { data } = await localDataApi
      .from("audit_logs")
      .select("id, action, record_id, user_id, created_at, before_data, after_data")
      .eq("module", "user_management")
      .order("created_at", { ascending: false })
      .limit(100);
    setAudit((data ?? []) as AuditRow[]);
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() + 86_399_000 : null;
    return rows.filter((r) => {
      const matchQ =
        !needle ||
        r.full_name?.toLowerCase().includes(needle) ||
        r.email?.toLowerCase().includes(needle) ||
        r.rank?.toLowerCase().includes(needle);
      const matchRole = filterRole === "all" || r.roles.includes(filterRole);
      const matchStatus =
        filterStatus === "all" ||
        (filterStatus === "active" ? r.is_active : !r.is_active);
      const createdMs = new Date(r.created_at).getTime();
      const matchDate =
        (!fromTs || createdMs >= fromTs) && (!toTs || createdMs <= toTs);
      return matchQ && matchRole && matchStatus && matchDate;
    });
  }, [rows, q, filterRole, filterStatus, dateFrom, dateTo]);

  async function toggleRole(row: ProfileRow, role: Role) {
    if (busy) return;
    const key = `${row.auth_user_id}:${role}`;
    setBusy(key);
    const has = row.roles.includes(role);
    try {
      if (has) {
        if (role === "super_admin" && row.roles.length === 1) {
          throw new Error("Tidak boleh mencabut peran terakhir Super Admin");
        }
        const { error } = await localDataApi
          .from("user_roles")
          .delete()
          .eq("user_id", row.auth_user_id)
          .eq("role", role);
        if (error) throw error;
        await writeClientAudit({
          action: "user.role_revoke",
          recordId: row.auth_user_id,
          before: { roles: row.roles },
          after: { revoked: role },
        });
        toast.success(`Peran ${role} dicabut`);
      } else {
        const { error } = await localDataApi
          .from("user_roles")
          .insert({ user_id: row.auth_user_id, role });
        if (error) throw error;
        await writeClientAudit({
          action: "user.role_grant",
          recordId: row.auth_user_id,
          before: { roles: row.roles },
          after: { granted: role },
        });
        toast.success(`Peran ${role} diberikan`);
      }
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Gagal mengubah peran");
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive(row: ProfileRow) {
    const next = !row.is_active;
    const { error } = await localDataApi
      .from("profiles")
      .update({ is_active: next })
      .eq("id", row.id);
    if (error) {
      toast.error("Gagal mengubah status");
      return;
    }
    await writeClientAudit({
      action: next ? "user.activate" : "user.deactivate",
      recordId: row.auth_user_id,
      before: { is_active: row.is_active },
      after: { is_active: next },
    });
    toast.success(row.is_active ? "Akun dinonaktifkan" : "Akun diaktifkan");
    void load();
  }

  async function handleCreate(form: CreateForm) {
    setBusy("create");
    try {
      await callCreate({
        data: {
          email: form.email.trim(),
          password: form.password,
          full_name: form.full_name.trim(),
          rank: form.rank || null,
          unit: form.unit || null,
          roles: form.roles,
        },
      });
      toast.success("Akun berhasil dibuat");
      setCreateOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Gagal membuat akun");
    } finally {
      setBusy(null);
    }
  }

  async function handleEdit(form: { full_name: string; rank: string; unit: string }) {
    if (!editTarget) return;
    setBusy("edit");
    try {
      const { error } = await localDataApi
        .from("profiles")
        .update({
          full_name: form.full_name.trim(),
          rank: form.rank || null,
          unit: form.unit || null,
        })
        .eq("id", editTarget.id);
      if (error) throw error;
      await writeClientAudit({
        action: "user.update_profile",
        recordId: editTarget.auth_user_id,
        before: {
          full_name: editTarget.full_name,
          rank: editTarget.rank,
          unit: editTarget.unit,
        },
        after: form,
      });
      toast.success("Profil diperbarui");
      setEditTarget(null);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Gagal memperbarui");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy("delete");
    try {
      await callDelete({ data: { authUserId: deleteTarget.auth_user_id } });
      toast.success("Akun dihapus");
      setDeleteTarget(null);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Gagal menghapus");
    } finally {
      setBusy(null);
    }
  }

  async function handleResetPw(newPassword: string) {
    if (!pwTarget) return;
    setBusy("pw");
    try {
      await callResetPw({
        data: { authUserId: pwTarget.auth_user_id, newPassword },
      });
      toast.success("Password berhasil di-reset");
      setPwTarget(null);
    } catch (e: any) {
      toast.error(e.message ?? "Gagal reset password");
    } finally {
      setBusy(null);
    }
  }

  if (authLoading || (!isSuper && loading)) {
    return <div className="p-8 text-sm text-muted-foreground">Memuat…</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-accent" />
            Manajemen Pengguna
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola peran multi-level. Hanya <b>Super Admin</b> yang dapat memberi atau mencabut peran.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {rows.length} pengguna terdaftar
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              if (!confirm("Buat/sinkronisasi 17 akun uji coba (tester, admin, dokter subtim, peserta, casis, dst)? Akun yang sudah ada akan di-update.")) return;
              setBusy("seed");
              try {
                const res: any = await callSeed({});
                const ok = res?.results?.filter((r: any) => r.status !== "error").length ?? 0;
                const err = res?.results?.filter((r: any) => r.status === "error").length ?? 0;
                toast.success(`Seed selesai: ${ok} ok, ${err} error`);
                await load();
              } catch (e: any) {
                toast.error(e.message ?? "Gagal seed akun");
              } finally {
                setBusy(null);
              }
            }}
            disabled={busy === "seed"}
          >
            {busy === "seed" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
            Seed Akun Uji Coba
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAuditOpen(true)}>
            <History className="h-4 w-4 mr-1.5" />
            Audit Log
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1.5" />
            Tambah Akun
          </Button>
        </div>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="pt-6 grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto] items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, email, pangkat…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as Role | "all")}
          >
            <option value="all">Semua Peran</option>
            {ALL_ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
          <div className="flex items-center gap-1 text-xs">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-10 w-[140px]"
              title="Dibuat dari"
            />
            <span className="text-muted-foreground">→</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-10 w-[140px]"
              title="Dibuat sampai"
            />
          </div>
          <Button variant="outline" onClick={() => load()}>Muat Ulang</Button>
        </CardContent>
      </Card>

      {/* Legend / hierarchy */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Hierarki Peran</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {ROLE_GROUPS.map((g) => (
            <div key={g.title}>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{g.title}</div>
              <div className="space-y-1.5">
                {g.roles.map((r) => (
                  <div key={r.value} className="flex items-start gap-2 text-sm">
                    <Badge variant="secondary" className="font-mono text-[10px] mt-0.5">{r.value}</Badge>
                    <div className="min-w-0">
                      <div className="font-medium">{r.label}</div>
                      <div className="text-xs text-muted-foreground">{r.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Users list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Daftar Pengguna <span className="text-xs text-muted-foreground font-normal">({filtered.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Memuat…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Tidak ada pengguna.</div>
          ) : (
            <div className="space-y-3">
              {filtered.map((row) => (
                <div key={row.id} className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-semibold flex items-center gap-2">
                        {row.full_name}
                        {!row.is_active && <Badge variant="destructive" className="text-[10px]">Nonaktif</Badge>}
                        {row.roles.includes("super_admin") && (
                          <Badge className="bg-accent text-accent-foreground text-[10px]">SUPER</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{row.email}</div>
                      {(row.rank || row.unit) && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {[row.rank, row.unit].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Dibuat: {new Date(row.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => setEditTarget(row)}>
                        <Pencil className="h-3.5 w-3.5 mr-1.5" /> Ubah
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setSectionTarget(row)}>
                        <ListChecks className="h-3.5 w-3.5 mr-1.5" /> Section
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setPermTarget(row)}>
                        <Eye className="h-3.5 w-3.5 mr-1.5" /> Permissions
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setPwTarget(row)}>
                        <KeyRound className="h-3.5 w-3.5 mr-1.5" /> Password
                      </Button>
                      <Button
                        size="sm"
                        variant={row.is_active ? "outline" : "default"}
                        onClick={() => toggleActive(row)}
                      >
                        {row.is_active ? <ShieldOff className="h-3.5 w-3.5 mr-1.5" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />}
                        {row.is_active ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(row)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Hapus
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {ALL_ROLES.map((r) => {
                      const has = row.roles.includes(r.value);
                      const key = `${row.auth_user_id}:${r.value}`;
                      return (
                        <button
                          key={r.value}
                          type="button"
                          disabled={busy === key}
                          onClick={() => toggleRole(row, r.value)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition ${
                            has
                              ? "bg-accent text-accent-foreground border-accent"
                              : "bg-background text-muted-foreground border-border hover:border-accent/50"
                          } ${busy === key ? "opacity-50" : ""}`}
                          title={r.desc}
                        >
                          {has ? "✓ " : "+ "}{r.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        busy={busy === "create"}
      />
      <EditUserDialog
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSubmit={handleEdit}
        busy={busy === "edit"}
      />
      <ResetPwDialog
        target={pwTarget}
        onClose={() => setPwTarget(null)}
        onSubmit={handleResetPw}
        busy={busy === "pw"}
      />
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus akun ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Akun <b>{deleteTarget?.full_name}</b> ({deleteTarget?.email}) akan dihapus permanen
              beserta semua peran. Aksi ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={busy === "delete"}
            >
              {busy === "delete" && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AuditLogDialog
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        items={audit}
        rows={rows}
      />

      <SectionAssignmentDialog
        open={!!sectionTarget}
        onOpenChange={(o) => !o && setSectionTarget(null)}
        userId={sectionTarget?.auth_user_id ?? null}
        userLabel={sectionTarget?.full_name}
        onSaved={() => load()}
      />

      <EffectivePermissionsDialog
        open={!!permTarget}
        onOpenChange={(o) => !o && setPermTarget(null)}
        userId={permTarget?.auth_user_id ?? null}
        userLabel={permTarget?.full_name}
      />
    </div>
  );
}

type CreateForm = {
  email: string;
  password: string;
  full_name: string;
  rank: string;
  unit: string;
  roles: Role[];
};

function CreateUserDialog({
  open,
  onOpenChange,
  onSubmit,
  busy,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (f: CreateForm) => void;
  busy: boolean;
}) {
  const [form, setForm] = useState<CreateForm>({
    email: "",
    password: "",
    full_name: "",
    rank: "",
    unit: "",
    roles: ["viewer"],
  });

  useEffect(() => {
    if (open) {
      setForm({ email: "", password: "", full_name: "", rank: "", unit: "", roles: ["viewer"] });
    }
  }, [open]);

  function toggle(r: Role) {
    setForm((f) =>
      f.roles.includes(r) ? { ...f, roles: f.roles.filter((x) => x !== r) } : { ...f, roles: [...f.roles, r] },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Akun Pengguna</DialogTitle>
          <DialogDescription>
            Akun dibuat langsung dengan email terkonfirmasi. Pilih minimal satu peran.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Nama Lengkap *</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Password * (min 8)</Label>
              <Input
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Pangkat</Label>
              <Input value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} />
            </div>
            <div>
              <Label>Unit</Label>
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Peran *</Label>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto border rounded-md p-2">
              {ALL_ROLES.map((r) => (
                <label key={r.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={form.roles.includes(r.value)}
                    onCheckedChange={() => toggle(r.value)}
                  />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button
            disabled={
              busy ||
              !form.email ||
              !form.full_name ||
              form.password.length < 8 ||
              form.roles.length === 0
            }
            onClick={() => onSubmit(form)}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Buat Akun
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  target,
  onClose,
  onSubmit,
  busy,
}: {
  target: ProfileRow | null;
  onClose: () => void;
  onSubmit: (f: { full_name: string; rank: string; unit: string }) => void;
  busy: boolean;
}) {
  const [full_name, setName] = useState("");
  const [rank, setRank] = useState("");
  const [unit, setUnit] = useState("");

  useEffect(() => {
    if (target) {
      setName(target.full_name ?? "");
      setRank(target.rank ?? "");
      setUnit(target.unit ?? "");
    }
  }, [target]);

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ubah Profil Pengguna</DialogTitle>
          <DialogDescription>{target?.email}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Nama Lengkap</Label>
            <Input value={full_name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Pangkat</Label>
              <Input value={rank} onChange={(e) => setRank(e.target.value)} />
            </div>
            <div>
              <Label>Unit</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button disabled={busy || !full_name.trim()} onClick={() => onSubmit({ full_name, rank, unit })}>
            {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPwDialog({
  target,
  onClose,
  onSubmit,
  busy,
}: {
  target: ProfileRow | null;
  onClose: () => void;
  onSubmit: (pw: string) => void;
  busy: boolean;
}) {
  const [pw, setPw] = useState("");
  useEffect(() => { if (target) setPw(""); }, [target]);
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>{target?.email}</DialogDescription>
        </DialogHeader>
        <div>
          <Label>Password Baru (min 8)</Label>
          <Input type="text" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button disabled={busy || pw.length < 8} onClick={() => onSubmit(pw)}>
            {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AuditLogDialog({
  open,
  onClose,
  items,
  rows,
}: {
  open: boolean;
  onClose: () => void;
  items: AuditRow[];
  rows: ProfileRow[];
}) {
  const userMap = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => m.set(r.auth_user_id, r.full_name || r.email || r.auth_user_id));
    return m;
  }, [rows]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Audit Log Manajemen Pengguna
          </DialogTitle>
          <DialogDescription>100 aksi terakhir.</DialogDescription>
        </DialogHeader>
        {items.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Belum ada audit log.</div>
        ) : (
          <div className="space-y-2 text-sm">
            {items.map((a) => (
              <div key={a.id} className="border rounded-md p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Badge variant="outline" className="font-mono text-[10px]">{a.action}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Oleh: <b>{a.user_id ? userMap.get(a.user_id) ?? a.user_id.slice(0, 8) : "—"}</b>
                  {a.record_id && (
                    <> · Target: <b>{userMap.get(a.record_id) ?? a.record_id.slice(0, 8)}</b></>
                  )}
                </div>
                {(a.before_data || a.after_data) && (
                  <pre className="mt-2 text-[11px] bg-muted rounded p-2 overflow-x-auto">
                    {JSON.stringify({ before: a.before_data, after: a.after_data }, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
