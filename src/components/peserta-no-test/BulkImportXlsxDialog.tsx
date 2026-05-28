import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/local-supabase-shim";
import { createSelection, listActiveSelections } from "@/lib/selectionService";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileUp, AlertTriangle, CheckCircle2, FileDown, ArrowRight, ArrowLeft } from "lucide-react";
import {
  parseSeskoauCandidateListWorkbook,
  buildErrorReportXlsx,
  type ImportedCandidateRow,
  type SeskoauParseResult,
} from "@/lib/peserta-no-test/seskoau-xlsx-parser";

type NoTestOption = "blank" | "use_bag" | "use_no_urt" | "use_pok_bag";
type DuplicateOption = "skip" | "create_warning";

export function BulkImportXlsxDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onImported?: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<SeskoauParseResult | null>(null);
  const [selections, setSelections] = useState<{ id: string; name: string }[]>([]);
  const [selectionId, setSelectionId] = useState<string>("");
  const [newSelectionName, setNewSelectionName] = useState<string>("");
  const [createNew, setCreateNew] = useState<boolean>(false);
  const [noTestOpt, setNoTestOpt] = useState<NoTestOption>("blank");
  const [dupOpt, setDupOpt] = useState<DuplicateOption>("skip");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; failed: number; skipped: number; errors: string[] } | null>(null);

  useEffect(() => {
    if (!open) return;
    listActiveSelections().then((data) => {
      setSelections((data ?? []) as any);
    });
    logAudit({ action: "open_bulk_import_xlsx", module: "Bulk Import Peserta" }).catch(() => {});
  }, [open]);

  // Reset on close
  useEffect(() => {
    if (open) return;
    setStep(1); setFile(null); setParsed(null); setSelectionId(""); setNewSelectionName("");
    setCreateNew(false); setNoTestOpt("blank"); setDupOpt("skip"); setSearch(""); setStatusFilter("");
    setExcluded(new Set()); setResult(null);
  }, [open]);

  async function handleParse() {
    if (!file) { toast.error("Pilih file XLSX terlebih dahulu"); return; }
    setParsing(true);
    try {
      await logAudit({ action: "upload_candidate_xlsx", module: "Bulk Import Peserta", after: { file_name: file.name } });
      const res = await parseSeskoauCandidateListWorkbook(file);
      setParsed(res);
      if (res.detected_selection_name && !selectionId) {
        setNewSelectionName(`${res.detected_selection_name} ${res.detected_year_label ?? ""}`.trim());
      }
      await logAudit({
        action: "parse_candidate_xlsx",
        module: "Bulk Import Peserta",
        after: { source_format: res.source_format, sheet: res.sheet_name, totals: res.totals },
      });
      toast.success(`${res.totals.total} baris peserta terdeteksi dari sheet "${res.sheet_name}"`);
      setStep(2);
    } catch (e: any) {
      toast.error("Gagal parse XLSX: " + (e?.message ?? "unknown"));
    } finally {
      setParsing(false);
    }
  }

  const filteredRows = useMemo(() => {
    if (!parsed) return [];
    const q = search.trim().toLowerCase();
    return parsed.rows.filter((r) => {
      if (statusFilter && r.validation_status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.full_name.toLowerCase().includes(q) ||
        (r.nrp_nip ?? "").toLowerCase().includes(q) ||
        (r.pok_group ?? "").toLowerCase().includes(q) ||
        (r.bag_number ?? "").toLowerCase().includes(q)
      );
    });
  }, [parsed, search, statusFilter]);

  function computeTestNumber(r: ImportedCandidateRow): string | null {
    if (noTestOpt === "blank") return null;
    if (noTestOpt === "use_bag") return r.bag_number ?? null;
    if (noTestOpt === "use_no_urt") return r.no_urt ?? null;
    if (noTestOpt === "use_pok_bag") return r.pok_group && r.bag_number ? `${r.pok_group.replace(/\s+/g, "")}-${r.bag_number}` : null;
    return null;
  }

  async function ensureSelection(): Promise<string | null> {
    if (createNew) {
      if (!newSelectionName.trim()) { toast.error("Nama seleksi baru wajib"); return null; }
      const created = await createSelection({ name: newSelectionName.trim(), status: "active" } as any);
      return (created as any).id;
    }
    if (!selectionId) { toast.error("Pilih seleksi tujuan"); return null; }
    return selectionId;
  }

  async function handleImport() {
    if (!parsed) return;
    const selId = await ensureSelection();
    if (!selId) return;

    // Mismatch warning
    const sel = selections.find((s) => s.id === selId);
    if (parsed.detected_selection_name && sel && !sel.name.toUpperCase().includes(parsed.detected_selection_name.toUpperCase())) {
      const ok = window.confirm(
        `Judul file terdeteksi "${parsed.detected_selection_name} ${parsed.detected_year_label ?? ""}", ` +
        `tetapi seleksi tujuan "${sel.name}" berbeda. Tetap lanjut?`,
      );
      if (!ok) return;
    }

    setImporting(true);
    await logAudit({ action: "confirm_candidate_import", module: "Bulk Import Peserta", after: { selection_id: selId, total: parsed.rows.length } });

    try {
      // Preload existing for duplicate check (selection-scoped)
      const { data: existing } = await supabase
        .from("candidates")
        .select("nrp_nip,full_name,birth_date,bag_number,serial_number,test_number")
        .eq("selection_id", selId)
        .is("deleted_at", null);
      const exNrp = new Set((existing ?? []).map((r: any) => (r.nrp_nip ?? "").trim()).filter(Boolean));
      const exTn = new Set((existing ?? []).map((r: any) => (r.test_number ?? "").trim()).filter(Boolean));

      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;

      let inserted = 0;
      let failed = 0;
      let skipped = 0;
      const errors: string[] = [];

      // Create import session for rollback tracking
      const { data: sessionRow } = await supabase
        .from("import_sessions")
        .insert({
          selection_id: selId,
          file_name: file?.name ?? `bulk_seskoau_${new Date().toISOString().slice(0, 19)}.xlsx`,
          import_type: "no_test_xlsx",
          import_strategy: "seskoau_workbook",
          total_rows: parsed.rows.length,
          status: "Processing",
          started_by: uid,
          started_at: new Date().toISOString(),
        } as never)
        .select("id")
        .single();
      const sessionId = (sessionRow as any)?.id ?? null;

      const candidates: any[] = [];
      for (const r of parsed.rows) {
        if (excluded.has(r.source_row_number)) { skipped++; continue; }
        if (r.validation_status === "Error") { skipped++; continue; }

        const isDup =
          (r.nrp_nip && exNrp.has(r.nrp_nip.trim())) ||
          (r.no_urt && (existing ?? []).some((x: any) => String(x.serial_number) === r.no_urt));
        if (isDup && dupOpt === "skip") { skipped++; continue; }

        let tn = computeTestNumber(r);
        if (tn && exTn.has(tn)) {
          // collision: fall back to null + warning
          tn = null;
          errors.push(`Baris ${r.source_row_number}: No Test "${computeTestNumber(r)}" sudah dipakai — dikosongkan`);
        }

        candidates.push({
          selection_id: selId,
          serial_number: r.no_urt ? Number(r.no_urt) || null : null,
          bag_number: r.bag_number,
          group_name: r.pok_group,
          full_name: r.full_name,
          rank: r.rank,
          corps: r.corps,
          nrp_nip: r.nrp_nip,
          dikma_diktuk: r.dikma_diktuk,
          generation: r.generation,
          unit_position: r.unit_position,
          tmt_jabatan: r.tmt_jabatan,
          birth_date: r.birth_date,
          age_text: r.age_text,
          registration_notes: r.notes,
          combined_identity: r.combined_identity,
          test_number: tn,
          test_number_status: tn ? "Final" : "Belum Ada",
          test_number_assigned_at: tn ? new Date().toISOString() : null,
          test_number_assigned_by: tn ? uid : null,
          status: "Aktif",
          gender: "L",
          source_import_session_id: sessionId,
        });
      }

      // Batched insert (trigger auto-creates exam + sections)
      for (let i = 0; i < candidates.length; i += 50) {
        const chunk = candidates.slice(i, i + 50);
        const { data, error } = await supabase.from("candidates").insert(chunk as never).select("id");
        if (error) {
          failed += chunk.length;
          errors.push(`Batch ${i / 50 + 1}: ${error.message}`);
          await logAudit({ action: "import_candidate_row_failed", module: "Bulk Import Peserta", after: { batch: i / 50 + 1, error: error.message } });
        } else {
          inserted += data?.length ?? 0;
        }
      }

      if (sessionId) {
        await supabase.from("import_sessions").update({
          success_rows: inserted,
          failed_rows: failed,
          skipped_rows: skipped,
          status: failed === 0 ? "Completed" : (inserted > 0 ? "Completed with Errors" : "Error"),
          completed_at: new Date().toISOString(),
        } as never).eq("id", sessionId);
      }

      await logAudit({
        action: "bulk_import_candidate_completed",
        module: "Bulk Import Peserta",
        after: { selection_id: selId, inserted, failed, skipped, total: parsed.rows.length, import_session_id: sessionId },
      });

      setResult({ inserted, failed, skipped, errors });
      setStep(4);
      toast.success(`Import selesai: ${inserted} peserta dibuat, ${skipped} dilewati, ${failed} gagal`);
      onImported?.();
    } catch (e: any) {
      toast.error("Import gagal: " + (e?.message ?? "unknown"));
    } finally {
      setImporting(false);
    }
  }

  function downloadErrorReport() {
    if (!parsed) return;
    const blob = buildErrorReportXlsx(parsed.rows.filter((r) => r.validation_errors.length || r.validation_warnings.length));
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `import_errors_${Date.now()}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    logAudit({ action: "download_candidate_import_error_report", module: "Bulk Import Peserta" }).catch(() => {});
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" /> Bulk Import Peserta dari XLSX (SESKOAU)
          </DialogTitle>
          <DialogDescription>
            Format yang didukung: "Daftar Kelompok" SESKOAU dengan baris POK A/B/C sebagai pemisah kelompok.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs">
          {["1. Upload", "2. Preview & Opsi", "3. Konfirmasi", "4. Selesai"].map((label, i) => {
            const n = (i + 1) as 1 | 2 | 3 | 4;
            return (
              <Badge key={n} variant={step === n ? "default" : step > n ? "secondary" : "outline"}>{label}</Badge>
            );
          })}
        </div>

        {/* STEP 1 — upload */}
        {step === 1 && (
          <div className="space-y-3">
            <Label>File XLSX</Label>
            <Input ref={fileRef} type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Alert>
              <AlertDescription className="text-xs">
                Sistem akan mendeteksi sheet <b>Daftar Kelompok</b> dan kolom NAMA/PANGKAT/KORPS/NRP, JABATAN, TGL LAHIR.
                Baris <b>POK A/B/C</b> dipakai sebagai group_name, bukan peserta. BAG <b>tidak</b> otomatis menjadi No Test.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* STEP 2 — preview + options */}
        {step === 2 && parsed && (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div className="space-y-2 border rounded p-3">
                <div className="font-semibold text-xs uppercase text-slate-600">Deteksi File</div>
                <div className="text-xs">Sheet: <b>{parsed.sheet_name}</b></div>
                <div className="text-xs">Format: <b>{parsed.source_format}</b></div>
                {parsed.detected_title && <div className="text-xs">Judul: {parsed.detected_title}</div>}
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Badge className="bg-slate-100 text-slate-800">Total: {parsed.totals.total}</Badge>
                  <Badge className="bg-emerald-100 text-emerald-800">Ready: {parsed.totals.ready}</Badge>
                  <Badge className="bg-amber-100 text-amber-800">Warning: {parsed.totals.warning}</Badge>
                  <Badge className="bg-red-100 text-red-800">Error: {parsed.totals.error}</Badge>
                </div>
              </div>
              <div className="space-y-2 border rounded p-3">
                <div className="font-semibold text-xs uppercase text-slate-600">Seleksi Tujuan</div>
                <label className="flex items-center gap-2 text-xs">
                  <input type="radio" checked={!createNew} onChange={() => setCreateNew(false)} /> Gunakan existing
                </label>
                <select
                  className="w-full text-sm border rounded px-2 py-1"
                  disabled={createNew}
                  value={selectionId}
                  onChange={(e) => setSelectionId(e.target.value)}
                >
                  <option value="">— pilih seleksi —</option>
                  {selections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <label className="flex items-center gap-2 text-xs">
                  <input type="radio" checked={createNew} onChange={() => setCreateNew(true)} /> Buat seleksi baru dari judul
                </label>
                <Input
                  disabled={!createNew}
                  value={newSelectionName}
                  onChange={(e) => setNewSelectionName(e.target.value)}
                  placeholder="Nama seleksi baru"
                />
              </div>
              <div className="space-y-2 border rounded p-3">
                <div className="font-semibold text-xs uppercase text-slate-600">No Test Handling</div>
                {([
                  ["blank", "Kosongkan No Test, buat Temporary ID (DEFAULT)"],
                  ["use_bag", "Gunakan BAG sebagai No Test"],
                  ["use_no_urt", "Gunakan NO URT sebagai No Test"],
                  ["use_pok_bag", "Kombinasi POK + BAG"],
                ] as const).map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 text-xs">
                    <input type="radio" checked={noTestOpt === k} onChange={() => setNoTestOpt(k)} /> {l}
                  </label>
                ))}
                {noTestOpt !== "blank" && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-3 w-3" />
                    <AlertDescription className="text-[11px]">
                      Disarankan tetap kosong. BAG/NO URT sebaiknya bukan No Test final.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <div className="space-y-2 border rounded p-3">
                <div className="font-semibold text-xs uppercase text-slate-600">Duplicate Handling</div>
                <label className="flex items-center gap-2 text-xs">
                  <input type="radio" checked={dupOpt === "skip"} onChange={() => setDupOpt("skip")} /> Skip duplicate (DEFAULT)
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input type="radio" checked={dupOpt === "create_warning"} onChange={() => setDupOpt("create_warning")} /> Buat tetap, dengan warning
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Input placeholder="Cari nama / NRP / POK / BAG…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
              <select className="text-xs border rounded px-2 py-1" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Semua status</option>
                <option value="Ready">Ready</option>
                <option value="Warning">Warning</option>
                <option value="Error">Error</option>
              </select>
              <Button size="sm" variant="outline" onClick={downloadErrorReport}>
                <FileDown className="h-3 w-3 mr-1" /> Error Report
              </Button>
              <div className="ml-auto text-xs text-slate-500">{filteredRows.length} dari {parsed.totals.total}</div>
            </div>

            <ScrollArea className="flex-1 border rounded">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="p-1 border w-8"></th>
                    <th className="p-1 border w-14">Status</th>
                    <th className="p-1 border w-10">Row</th>
                    <th className="p-1 border w-10">URT</th>
                    <th className="p-1 border w-10">BAG</th>
                    <th className="p-1 border w-14">POK</th>
                    <th className="p-1 border text-left">Nama</th>
                    <th className="p-1 border">Pangkat</th>
                    <th className="p-1 border">Korps</th>
                    <th className="p-1 border">NRP</th>
                    <th className="p-1 border">Dikma</th>
                    <th className="p-1 border text-left">Jabatan</th>
                    <th className="p-1 border">TMT</th>
                    <th className="p-1 border">Lahir</th>
                    <th className="p-1 border">Usia</th>
                    <th className="p-1 border text-left">Warning/Error</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => {
                    const isExcluded = excluded.has(r.source_row_number);
                    return (
                      <tr key={r.source_row_number} className={`border-t ${isExcluded ? "opacity-40 line-through" : r.validation_status === "Error" ? "bg-red-50" : r.validation_status === "Warning" ? "bg-amber-50" : ""}`}>
                        <td className="p-1 border text-center">
                          <input type="checkbox" checked={!isExcluded} onChange={() => {
                            const next = new Set(excluded);
                            if (isExcluded) next.delete(r.source_row_number); else next.add(r.source_row_number);
                            setExcluded(next);
                          }} />
                        </td>
                        <td className="p-1 border text-center">
                          <Badge variant={r.validation_status === "Ready" ? "default" : "outline"} className="text-[10px]">{r.validation_status}</Badge>
                        </td>
                        <td className="p-1 border text-center">{r.source_row_number}</td>
                        <td className="p-1 border text-center">{r.no_urt}</td>
                        <td className="p-1 border text-center">{r.bag_number}</td>
                        <td className="p-1 border text-center">{r.pok_group}</td>
                        <td className="p-1 border">{r.full_name}</td>
                        <td className="p-1 border">{r.rank}</td>
                        <td className="p-1 border">{r.corps}</td>
                        <td className="p-1 border font-mono">{r.nrp_nip}</td>
                        <td className="p-1 border">{r.dikma_diktuk}</td>
                        <td className="p-1 border">{r.unit_position}</td>
                        <td className="p-1 border">{r.tmt_jabatan}</td>
                        <td className="p-1 border">{r.birth_date}</td>
                        <td className="p-1 border">{r.age_text}</td>
                        <td className="p-1 border text-[10px] text-red-700">
                          {r.validation_errors.join("; ")}
                          {r.validation_errors.length > 0 && r.validation_warnings.length > 0 && " | "}
                          <span className="text-amber-700">{r.validation_warnings.join("; ")}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}

        {/* STEP 3 — confirm */}
        {step === 3 && parsed && (
          <div className="space-y-3">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Akan diimport <b>{parsed.rows.filter((r) => !excluded.has(r.source_row_number) && r.validation_status !== "Error").length}</b> peserta.
                Setiap peserta akan otomatis mendapat <b>Temporary ID</b>, <b>exam</b>, dan <b>21 section</b>. Stage Hari-H akan dimulai dari <b>Menunggu Rontgen & EKG</b>.
              </AlertDescription>
            </Alert>
            <div className="text-xs grid grid-cols-2 gap-2">
              <div>Total terdeteksi: <b>{parsed.totals.total}</b></div>
              <div>Error (di-skip): <b>{parsed.totals.error}</b></div>
              <div>Warning: <b>{parsed.totals.warning}</b></div>
              <div>Excluded manual: <b>{excluded.size}</b></div>
              <div>No Test mode: <b>{noTestOpt}</b></div>
              <div>Duplicate handling: <b>{dupOpt}</b></div>
            </div>
          </div>
        )}

        {/* STEP 4 — result */}
        {step === 4 && result && (
          <div className="space-y-3">
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
              <AlertDescription>
                Import selesai. <b>{result.inserted}</b> peserta dibuat, <b>{result.skipped}</b> dilewati, <b>{result.failed}</b> gagal.
              </AlertDescription>
            </Alert>
            {result.errors.length > 0 && (
              <div className="border rounded p-2 max-h-40 overflow-y-auto text-xs">
                {result.errors.map((e, i) => <div key={i} className="text-red-700">{e}</div>)}
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={downloadErrorReport}>Download Error Report</Button>
              <Button variant="outline" size="sm" onClick={() => { setStep(1); setFile(null); setParsed(null); setResult(null); setExcluded(new Set()); }}>
                Import File Lagi
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          {step > 1 && step < 4 && (
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as any)} disabled={importing || parsing}>
              <ArrowLeft className="h-3 w-3 mr-1" /> Kembali
            </Button>
          )}
          {step === 1 && (
            <Button onClick={handleParse} disabled={!file || parsing}>
              {parsing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-1" />}
              Parse File
            </Button>
          )}
          {step === 2 && (
            <Button onClick={() => setStep(3)} disabled={!parsed}>
              Lanjut <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 3 && (
            <Button onClick={handleImport} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Konfirmasi & Import
            </Button>
          )}
          {step === 4 && (
            <Button onClick={() => onOpenChange(false)}>Selesai</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}