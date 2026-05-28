import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Search, Pencil, Upload, FileSpreadsheet, FileText, Plus, Trash2, RotateCcw,
  Activity, Radio, ExternalLink, FilterX, GitMerge, ArrowUpDown,
} from "lucide-react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/lib/use-auth";
import { Can } from "@/components/auth/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { NoTestBadge } from "@/components/app/NoTestBadge";
import { AssignTestNumberDialog } from "@/components/app/AssignTestNumberDialog";
import { BulkUpdateDialog } from "@/components/peserta-no-test/BulkUpdateDialog";
import { BulkImportCsvDialog } from "@/components/peserta-no-test/BulkImportCsvDialog";
import { BulkImportXlsxDialog } from "@/components/peserta-no-test/BulkImportXlsxDialog";
import { CreateNoTestCandidateDialog } from "@/components/peserta-no-test/CreateNoTestCandidateDialog";
import { EditNoTestCandidateDialog, type EditCandidate } from "@/components/peserta-no-test/EditNoTestCandidateDialog";
import { DeleteCandidateDialog } from "@/components/peserta-no-test/DeleteCandidateDialog";
import { RestoreCandidateDialog } from "@/components/peserta-no-test/RestoreCandidateDialog";
import { SummaryCards, type SummaryStats } from "@/components/peserta-no-test/SummaryCards";
import { DuplicateDetectionDialog } from "@/components/peserta-no-test/DuplicateDetectionDialog";
import { BulkAssignSeriesDialog } from "@/components/peserta-no-test/BulkAssignSeriesDialog";
import { useRealtimeDuplicateAlerts } from "@/lib/peserta-no-test/use-realtime-duplicates";
import { QuickSupportingModal } from "@/components/hari-h/QuickSupportingModal";
import { exportLaporanXlsx, exportLaporanPdf } from "@/lib/peserta-no-test/laporan-export";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { STAGE_BADGE, INIT_STATUS_BADGE, type HariHStage } from "@/lib/hari-h-stage";
import { listCandidatesWithoutTestNumberLocal } from "@/lib/services/candidateService";
import { listSelectionsLocal } from "@/lib/localDb";

export const Route = createFileRoute("/_authenticated/peserta-tanpa-no-test")({
  component: PesertaTanpaNoTestPage,
});

type Row = {
  id: string;
  full_name: string;
  temporary_id: string | null;
  test_number: string | null;
  test_number_status: string;
  nrp_nip: string | null;
  rank: string | null;
  unit_position: string | null;
  pok_korp: string | null;
  panda: string | null;
  group_name: string | null;
  gender: string | null;
  birth_place: string | null;
  birth_date: string | null;
  phone: string | null;
  address: string | null;
  registration_notes: string | null;
  selection_id: string;
  selection_name?: string;
  created_at: string;
  deleted_at: string | null;
  delete_reason: string | null;
  exam_id: string | null;
  hari_h_stage: HariHStage | null;
  ekg_initial_status: string;
  radiology_initial_status: string;
  bag_number: string | null;
  class_group: string | null;
  pnd_code: string | null;
  serial_number: number | null;
};

function PesertaTanpaNoTestPage() {
  const { roles } = useAuth();
  const { has, hasAny } = usePermissions();
  const canWrite = hasAny([PERMISSIONS.NO_TEST_UPDATE, PERMISSIONS.NO_TEST_BULK_UPDATE, PERMISSIONS.NO_TEST_CREATE]);
  const canDelete = has(PERMISSIONS.NO_TEST_DELETE);
  const [rows, setRows] = useState<Row[]>([]);
  const [selections, setSelections] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [assignFor, setAssignFor] = useState<Row | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importXlsxOpen, setImportXlsxOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editFor, setEditFor] = useState<EditCandidate | null>(null);
  const [deleteFor, setDeleteFor] = useState<Row | null>(null);
  const [restoreFor, setRestoreFor] = useState<Row | null>(null);
  const [quickModal, setQuickModal] = useState<{ mode: "ekg" | "radiology"; examId: string; candidateId: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [sortKey, setSortKey] = useState<"created_at" | "kes" | "no" | "kls" | "bag" | "pnd" | "name">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useRealtimeDuplicateAlerts({
    enabled: canWrite,
    onAlert: () => setDupOpen(true),
  });

  // Filters
  const [fSelection, setFSelection] = useState<string>("");
  const [fNoTestStatus, setFNoTestStatus] = useState<string>("");
  const [fStage, setFStage] = useState<string>("");
  const [fRo, setFRo] = useState<string>("");
  const [fEkg, setFEkg] = useState<string>("");
  const [fDateFrom, setFDateFrom] = useState<string>("");
  const [fDateTo, setFDateTo] = useState<string>("");
  const [showDeleted, setShowDeleted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = listCandidatesWithoutTestNumberLocal({ showDeleted });
    const mapped: Row[] = (data as any[]).map((r) => ({
      id: r.id, full_name: r.full_name, temporary_id: r.temporary_id ?? null, test_number: r.test_number ?? null,
      test_number_status: r.test_number_status ?? "pending", nrp_nip: r.nrp_nip ?? null, rank: r.rank ?? null,
      unit_position: r.unit_position ?? null, pok_korp: r.pok_korp ?? null, panda: r.panda ?? null, group_name: r.group_name ?? null,
      gender: r.gender ?? null, birth_place: r.birth_place ?? null, birth_date: r.birth_date ?? null, phone: r.phone ?? null, address: r.address ?? null, registration_notes: r.registration_notes ?? null,
      selection_id: r.selection_id, selection_name: r.selection_name, created_at: r.created_at, deleted_at: r.deleted_at ?? null, delete_reason: r.delete_reason ?? null,
      exam_id: r.exam_id ?? null, hari_h_stage: (r.hari_h_stage ?? null) as HariHStage | null, ekg_initial_status: r.ekg_initial_status ?? "Belum", radiology_initial_status: r.radiology_initial_status ?? "Belum",
      bag_number: r.bag_number ?? null, class_group: r.class_group ?? null, pnd_code: r.pnd_code ?? null, serial_number: r.serial_number ?? null,
    }));
    setRows(mapped);
    setLoading(false);
  }, [showDeleted]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const data = listSelectionsLocal() as any[];
    setSelections(data.map((s) => ({ id: s.id, name: s.selection_name ?? s.name ?? "-" })));
  }, []);

  async function doExport(kind: "xlsx" | "pdf") {
    setExporting(true);
    try {
      const n = kind === "xlsx" ? await exportLaporanXlsx() : await exportLaporanPdf();
      toast.success(`Laporan ${kind.toUpperCase()} berisi ${n} peserta`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal ekspor");
    } finally {
      setExporting(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const xs = rows.filter((r) => {
      if (q && !(
        r.full_name?.toLowerCase().includes(q) ||
        r.temporary_id?.toLowerCase().includes(q) ||
        r.nrp_nip?.toLowerCase().includes(q) ||
        r.unit_position?.toLowerCase().includes(q)
      )) return false;
      if (fSelection && r.selection_id !== fSelection) return false;
      if (fNoTestStatus && r.test_number_status !== fNoTestStatus) return false;
      if (fStage && (r.hari_h_stage ?? "") !== fStage) return false;
      if (fRo && r.radiology_initial_status !== fRo) return false;
      if (fEkg && r.ekg_initial_status !== fEkg) return false;
      if (fDateFrom && new Date(r.created_at) < new Date(fDateFrom)) return false;
      if (fDateTo && new Date(r.created_at) > new Date(fDateTo + "T23:59:59")) return false;
      return true;
    });
    const keyOf = (r: Row): string | number => {
      switch (sortKey) {
        case "kes": return r.test_number ?? "";
        case "no": return r.serial_number ?? Number.MAX_SAFE_INTEGER;
        case "kls": return r.class_group ?? "";
        case "bag": return r.bag_number ?? "";
        case "pnd": return r.pnd_code ?? "";
        case "name": return r.full_name ?? "";
        case "created_at": default: return r.created_at;
      }
    };
    const sorted = [...xs].sort((a, b) => {
      const av = keyOf(a); const bv = keyOf(b);
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      const cmp = String(av).localeCompare(String(bv), "id", { numeric: true, sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [rows, search, fSelection, fNoTestStatus, fStage, fRo, fEkg, fDateFrom, fDateTo, sortKey, sortDir]);

  function toggleSort(k: typeof sortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "created_at" ? "desc" : "asc"); }
  }

  const stats: SummaryStats = useMemo(() => {
    const active = filtered.filter((r) => !r.deleted_at);
    return {
      total: active.length,
      menungguRontgen: active.filter((r) => r.radiology_initial_status !== "Cleared").length,
      menungguEkg: active.filter((r) => r.ekg_initial_status !== "Cleared").length,
      rontgenSelesai: active.filter((r) => r.radiology_initial_status === "Cleared").length,
      ekgSelesai: active.filter((r) => r.ekg_initial_status === "Cleared").length,
      siapScreening: active.filter((r) =>
        r.radiology_initial_status === "Cleared" && r.ekg_initial_status === "Cleared",
      ).length,
      perluVerifikasi: active.filter((r) => r.test_number_status === "Perlu Verifikasi").length,
    };
  }, [filtered]);

  function resetFilters() {
    setSearch(""); setFSelection(""); setFNoTestStatus(""); setFStage("");
    setFRo(""); setFEkg(""); setFDateFrom(""); setFDateTo("");
  }

  function openQuick(mode: "ekg" | "radiology", r: Row) {
    if (!r.exam_id) { toast.error("Exam belum tersedia. Refresh sebentar."); return; }
    logAudit({
      action: mode === "ekg" ? "open_ekg_from_no_test_module" : "open_radiology_from_no_test_module",
      module: "peserta_tanpa_no_test",
      candidate_id: r.id,
      exam_id: r.exam_id,
    });
    setQuickModal({ mode, examId: r.exam_id, candidateId: r.id });
  }

  function openBulkAssign() {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (ids.length === 0) { toast.error("Pilih minimal 1 peserta"); return; }
    setBulkAssignOpen(true);
  }

  const bulkAssignTargets = useMemo(
    () => rows.filter((r) => selected[r.id]).map((r) => ({
      id: r.id, full_name: r.full_name, temporary_id: r.temporary_id, test_number: r.test_number,
    })),
    [rows, selected],
  );

  return (
    <div className="p-6 lg:p-8 space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Peserta Tanpa No Test</h1>
          <p className="text-sm text-slate-600 mt-1">
            Kelola peserta yang belum memiliki No Test final dan arahkan ke pemeriksaan awal Rontgen / EKG.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canWrite && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Tambah Peserta Tanpa No Test
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={exporting}>
                {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />}
                Export Laporan
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => doExport("xlsx")}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> XLSX
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => doExport("pdf")}>
                <FileText className="h-4 w-4 mr-2" /> PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Can permission={PERMISSIONS.NO_TEST_BULK_UPDATE}>
            <Button variant="outline" onClick={() => setBulkOpen(true)}>
              <Upload className="h-4 w-4 mr-1" /> Bulk Update (XLSX)
            </Button>
          </Can>
          <Can permission={PERMISSIONS.NO_TEST_CREATE}>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileUp className="h-4 w-4 mr-1" /> Bulk Import (CSV)
            </Button>
          </Can>
          <Can permission={PERMISSIONS.CANDIDATE_BULK_IMPORT_XLSX}>
            <Button variant="default" onClick={() => setImportXlsxOpen(true)}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Bulk Import XLSX (SESKOAU)
            </Button>
          </Can>
          <Can permission={PERMISSIONS.NO_TEST_BULK_UPDATE}>
            <Button variant="outline" onClick={openBulkAssign} disabled={busy || Object.values(selected).every((v) => !v)}>
              Bulk Assign Seri
            </Button>
          </Can>
          <Can permission={PERMISSIONS.NO_TEST_MERGE}>
            <Button variant="outline" onClick={() => setDupOpen(true)}>
              <GitMerge className="h-4 w-4 mr-1" /> Deteksi Duplikat
            </Button>
          </Can>
        </div>
      </div>

      <SummaryCards stats={stats} />

      <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-2">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input className="pl-9" placeholder="Cari nama / TMP-ID / NRP / satuan…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Sel value={fSelection} onChange={setFSelection} placeholder="Semua Seleksi"
               options={selections.map((s) => ({ value: s.id, label: s.name }))} />
          <Sel value={fNoTestStatus} onChange={setFNoTestStatus} placeholder="Semua Status No Test"
               options={["Belum Ada","Sementara","Final","Perlu Verifikasi"].map((v) => ({ value: v, label: v }))} />
          <Sel value={fStage} onChange={setFStage} placeholder="Semua Stage"
               options={["Registrasi Awal","Menunggu Rontgen & EKG","Menunggu Rontgen","Menunggu EKG","Penunjang Awal Lengkap","Screening Hari-H","Pemeriksaan Subtim","Review","Finalized"].map((v) => ({ value: v, label: v }))} />
          <Sel value={fRo} onChange={setFRo} placeholder="Semua Status RO"
               options={["Belum Diisi","Draft","Cleared"].map((v) => ({ value: v, label: v }))} />
          <Sel value={fEkg} onChange={setFEkg} placeholder="Semua Status EKG"
               options={["Belum Diisi","Draft","Cleared"].map((v) => ({ value: v, label: v }))} />
          <Input type="date" value={fDateFrom} onChange={(e) => setFDateFrom(e.target.value)} placeholder="Dari" />
          <Input type="date" value={fDateTo} onChange={(e) => setFDateTo(e.target.value)} placeholder="Sampai" />
          <label className="flex items-center gap-2 text-xs text-slate-600 px-2">
            <Checkbox checked={showDeleted} onCheckedChange={(c) => setShowDeleted(!!c)} />
            Tampilkan terhapus
          </label>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <FilterX className="h-4 w-4 mr-1" /> Reset
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-500"><Loader2 className="h-5 w-5 inline animate-spin mr-2" />Memuat…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Tidak ada peserta yang cocok dengan filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs uppercase text-slate-600">
                  <th className="p-3 w-10"></th>
                  <th className="p-3"><SortBtn label="Peserta" k="name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></th>
                  <th className="p-3">TMP ID</th>
                  <th className="p-3"><SortBtn label="KES" k="kes" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></th>
                  <th className="p-3"><SortBtn label="NO" k="no" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></th>
                  <th className="p-3"><SortBtn label="KLS" k="kls" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></th>
                  <th className="p-3"><SortBtn label="BAG" k="bag" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></th>
                  <th className="p-3"><SortBtn label="PND" k="pnd" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></th>
                  <th className="p-3">Seleksi</th>
                  <th className="p-3">Status No Test</th>
                  <th className="p-3">Stage Hari-H</th>
                  <th className="p-3">Rontgen</th>
                  <th className="p-3">EKG</th>
                  <th className="p-3"><SortBtn label="Tgl Reg." k="created_at" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} /></th>
                  <th className="p-3 w-72">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className={`border-t border-slate-200 hover:bg-slate-50 ${r.deleted_at ? "opacity-60" : ""}`}>
                    <td className="p-3">
                      <Checkbox
                        checked={!!selected[r.id]}
                        onCheckedChange={(c) => setSelected({ ...selected, [r.id]: !!c })}
                        disabled={!!r.deleted_at}
                      />
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-800">
                        {r.full_name}
                        {r.deleted_at && <Badge variant="outline" className="ml-2 text-[10px] bg-rose-50 text-rose-700 border-rose-200">DIHAPUS</Badge>}
                      </div>
                      <div className="text-xs text-slate-500">{r.rank ?? "—"} · {r.nrp_nip ?? "—"} · {r.unit_position ?? "—"}</div>
                    </td>
                    <td className="p-3 font-mono text-xs text-slate-700">{r.temporary_id ?? "—"}</td>
                    <td className="p-3 font-mono text-xs text-slate-700">{r.test_number ?? "—"}</td>
                    <td className="p-3 font-mono text-xs text-slate-700">{r.serial_number ?? "—"}</td>
                    <td className="p-3 font-mono text-xs text-slate-700">{r.class_group ?? "—"}</td>
                    <td className="p-3 font-mono text-xs text-slate-700">{r.bag_number ?? "—"}</td>
                    <td className="p-3 font-mono text-xs text-slate-700">{r.pnd_code ?? "—"}</td>
                    <td className="p-3 text-slate-600 text-xs">{r.selection_name ?? "—"}</td>
                    <td className="p-3">
                      <NoTestBadge
                        testNumber={r.test_number}
                        temporaryId={r.temporary_id}
                        status={r.test_number_status}
                        showLabel={false}
                      />
                    </td>
                    <td className="p-3">
                      {r.hari_h_stage ? (
                        <Badge variant="outline" className={`text-[11px] ${STAGE_BADGE[r.hari_h_stage] ?? ""}`}>{r.hari_h_stage}</Badge>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={`text-[11px] ${INIT_STATUS_BADGE[r.radiology_initial_status as never] ?? ""}`}>
                        {r.radiology_initial_status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={`text-[11px] ${INIT_STATUS_BADGE[r.ekg_initial_status as never] ?? ""}`}>
                        {r.ekg_initial_status}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs text-slate-500">{new Date(r.created_at).toLocaleDateString("id-ID")}</td>
                    <td className="p-3">
                      {r.deleted_at ? (
                        canDelete && (
                          <Button size="sm" variant="outline" onClick={() => setRestoreFor(r)} disabled={busy}>
                            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                          </Button>
                        )
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-[11px]">
                            <Link to="/rikkes/$id" params={{ id: r.exam_id ?? r.id }} search={{ from: "peserta-tanpa-no-test", candidateId: r.id, selectionId: r.selection_id }}>
                              <ExternalLink className="h-3 w-3 mr-1" /> Buka
                            </Link>
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]"
                            onClick={() => openQuick("radiology", r)}>
                            <Radio className="h-3 w-3 mr-1" /> RO
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]"
                            onClick={() => openQuick("ekg", r)}>
                            <Activity className="h-3 w-3 mr-1" /> EKG
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]"
                            onClick={() => setAssignFor(r)}>
                            <Pencil className="h-3 w-3 mr-1" /> No Test
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]"
                            onClick={() => setEditFor({
                              id: r.id, temporary_id: r.temporary_id, full_name: r.full_name,
                              gender: r.gender, rank: r.rank, nrp_nip: r.nrp_nip, unit_position: r.unit_position,
                              pok_korp: r.pok_korp, panda: r.panda, group_name: r.group_name,
                              birth_place: r.birth_place, birth_date: r.birth_date, phone: r.phone,
                              address: r.address, registration_notes: r.registration_notes,
                            })}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-rose-700"
                            onClick={() => setDeleteFor(r)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AssignTestNumberDialog
        open={!!assignFor}
        onOpenChange={(v) => { if (!v) setAssignFor(null); }}
        candidate={assignFor ? {
          id: assignFor.id,
          full_name: assignFor.full_name,
          temporary_id: assignFor.temporary_id,
          test_number: assignFor.test_number,
          selection_id: assignFor.selection_id,
        } : null}
        onSaved={load}
      />

      <BulkUpdateDialog open={bulkOpen} onOpenChange={setBulkOpen} onApplied={load} />

      <BulkImportCsvDialog open={importOpen} onOpenChange={setImportOpen} onImported={load} />
      <BulkImportXlsxDialog open={importXlsxOpen} onOpenChange={setImportXlsxOpen} onImported={load} />

      <CreateNoTestCandidateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />

      <EditNoTestCandidateDialog
        open={!!editFor}
        onOpenChange={(v) => { if (!v) setEditFor(null); }}
        candidate={editFor}
        onSaved={load}
      />

      <DeleteCandidateDialog
        open={!!deleteFor}
        onOpenChange={(v) => { if (!v) setDeleteFor(null); }}
        candidate={deleteFor ? { id: deleteFor.id, full_name: deleteFor.full_name, temporary_id: deleteFor.temporary_id } : null}
        onDone={load}
      />

      {quickModal && (
        <QuickSupportingModal
          open={true}
          onOpenChange={(v) => !v && setQuickModal(null)}
          mode={quickModal.mode}
          examId={quickModal.examId}
          candidateId={quickModal.candidateId}
          onSaved={load}
        />
      )}

      <DuplicateDetectionDialog open={dupOpen} onOpenChange={setDupOpen} onMerged={load} />
      <BulkAssignSeriesDialog
        open={bulkAssignOpen}
        onOpenChange={setBulkAssignOpen}
        targets={bulkAssignTargets}
        onDone={async () => { setSelected({}); await load(); }}
      />

      <RestoreCandidateDialog
        open={!!restoreFor}
        onOpenChange={(v) => { if (!v) setRestoreFor(null); }}
        candidate={restoreFor ? { id: restoreFor.id, full_name: restoreFor.full_name, temporary_id: restoreFor.temporary_id, delete_reason: restoreFor.delete_reason } : null}
        onDone={load}
      />
    </div>
  );
}

function Sel({
  value, onChange, options, placeholder,
}: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string }) {
  return (
    <select
      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function SortBtn<K extends string>({
  label, k, sortKey, sortDir, onClick,
}: { label: string; k: K; sortKey: string; sortDir: "asc" | "desc"; onClick: (k: K) => void }) {
  const active = sortKey === k;
  return (
    <button
      type="button"
      onClick={() => onClick(k)}
      className={`inline-flex items-center gap-1 hover:text-slate-900 ${active ? "text-slate-900 font-semibold" : ""}`}
    >
      {label}
      <ArrowUpDown className={`h-3 w-3 ${active ? "opacity-100" : "opacity-40"}`} />
      {active && <span className="text-[10px]">{sortDir === "asc" ? "↑" : "↓"}</span>}
    </button>
  );
}