import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { logAudit } from "@/lib/audit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Upload, FileSpreadsheet, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Loader2, Download, History, ExternalLink, Hash, Search } from "lucide-react";
import { toast } from "sonner";
import { parseNomorTesKesFile, buildKesTemplateCsv, type ParsedNomorTesRow } from "@/lib/import-nomor-tes/parse";
import { loadSelectionCandidatesForMatch, loadAttachmentCounts, matchRowsAgainstCandidates, type MatchedRow, type ExistingCandidate } from "@/lib/import-nomor-tes/match";

export const Route = createFileRoute("/_authenticated/import-nomor-tes")({
  component: ImportNomorTesPage,
});

type Selection = { id: string; name: string; year_label: string };

const CONFIDENCE_BADGE: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-700 border-emerald-200",
  medium: "bg-blue-100 text-blue-700 border-blue-200",
  low: "bg-amber-100 text-amber-700 border-amber-200",
  ambiguous: "bg-orange-100 text-orange-700 border-orange-200",
  not_found: "bg-rose-100 text-rose-700 border-rose-200",
};

const STATUS_BADGE: Record<string, string> = {
  ready: "bg-emerald-100 text-emerald-700",
  need_review: "bg-amber-100 text-amber-700",
  ambiguous: "bg-orange-100 text-orange-700",
  not_found: "bg-rose-100 text-rose-700",
  duplicate_kes: "bg-red-100 text-red-700",
  error: "bg-red-200 text-red-800",
  skipped: "bg-slate-200 text-slate-600",
};

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ImportNomorTesPage() {
  const { roles } = useAuth();
  const allowed = roles.includes("super_admin") || roles.includes("admin") || roles.includes("registrasi");
  const isSuperAdmin = roles.includes("super_admin");

  const [sels, setSels] = useState<Selection[]>([]);
  const [selId, setSelId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedNomorTesRow[]>([]);
  const [matched, setMatched] = useState<MatchedRow[]>([]);
  const [sheetUsed, setSheetUsed] = useState<string>("");

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [q, setQ] = useState("");

  // Options
  const [updateAdmin, setUpdateAdmin] = useState(true);    // bag/kls/pnd/no/sort_order
  const [fillMissingId, setFillMissingId] = useState(true); // birth_place/birth_date jika kosong
  const [createMissing, setCreateMissing] = useState(false);
  const [overrideDuplicate, setOverrideDuplicate] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAck, setConfirmAck] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ session_id: string; updated: number; skipped: number; errors: number } | null>(null);

  // History
  const [history, setHistory] = useState<Array<{ id: string; file_name: string; status: string; created_at: string; total_rows: number; updated_rows: number; error_rows: number }>>([]);

  // Bootstrap
  useEffect(() => {
    if (!allowed) return;
    (async () => {
      const { data } = await supabase.from("selections").select("id, name, year_label").order("year_label", { ascending: false });
      setSels((data ?? []) as Selection[]);
      await logAudit({ action: "open_import_nomor_tes", module: "Import Nomor Tes" });
      await loadHistory();
    })();
  }, [allowed]);

  async function loadHistory() {
    const { data } = await supabase
      .from("test_number_import_sessions" as never)
      .select("id, file_name, status, created_at, total_rows, updated_rows, error_rows")
      .order("created_at", { ascending: false })
      .limit(50);
    setHistory((data ?? []) as never);
  }

  async function handleParse() {
    if (!file || !selId) { toast.error("Pilih seleksi dan file dulu"); return; }
    setParsing(true);
    try {
      const { rows, sheet_used } = await parseNomorTesKesFile(file);
      setParsed(rows);
      setSheetUsed(sheet_used);
      await logAudit({ action: "parse_nomor_tes_file", module: "Import Nomor Tes", after: { file: file.name, sheet: sheet_used, total: rows.length } });
      // Match
      const candidates = await loadSelectionCandidatesForMatch(selId);
      const counts = await loadAttachmentCounts(candidates.map((c) => c.id));
      const m = matchRowsAgainstCandidates(rows, candidates, counts);
      setMatched(m);
      await logAudit({ action: "preview_import_nomor_tes", module: "Import Nomor Tes", after: { total: m.length } });
      toast.success(`Parsed ${rows.length} baris dari sheet "${sheet_used}".`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal parse file");
    } finally {
      setParsing(false);
    }
  }

  function setManualMatch(rowIdx: number, candidateId: string | "skip") {
    setMatched((prev) => prev.map((r, i) => {
      if (i !== rowIdx) return r;
      if (candidateId === "skip") return { ...r, status: "skipped", candidate: null };
      const cand = r.candidate_options.find((c) => c.id === candidateId) ?? null;
      if (!cand) return r;
      return { ...r, candidate: cand, confidence: "medium", status: "ready" };
    }));
    logAudit({ action: "manual_match_nomor_tes_row", module: "Import Nomor Tes", after: { rowIdx, candidateId } }).catch(() => {});
  }

  function bulkAction(kind: "skip_ambiguous" | "skip_not_found" | "auto_pick_first_ambiguous" | "promote_need_review" | "reset_skipped") {
    let n = 0;
    setMatched((prev) => prev.map((r) => {
      if (kind === "skip_ambiguous" && r.status === "ambiguous") { n++; return { ...r, status: "skipped", candidate: null }; }
      if (kind === "skip_not_found" && r.status === "not_found") { n++; return { ...r, status: "skipped", candidate: null }; }
      if (kind === "auto_pick_first_ambiguous" && r.status === "ambiguous" && r.candidate_options.length > 0) {
        n++; return { ...r, candidate: r.candidate_options[0], confidence: "medium", status: "ready" };
      }
      if (kind === "promote_need_review" && r.status === "need_review" && r.candidate) { n++; return { ...r, status: "ready" }; }
      if (kind === "reset_skipped" && r.status === "skipped") { n++; return { ...r, status: r.candidate ? "ready" : "not_found" }; }
      return r;
    }));
    logAudit({ action: `bulk_manual_match_${kind}`, module: "Import Nomor Tes", after: { affected: n } }).catch(() => {});
    if (n > 0) toast.success(`Bulk action diterapkan ke ${n} baris.`);
    else toast.info("Tidak ada baris yang cocok.");
  }

  const totals = useMemo(() => {
    const t = { total: matched.length, ready: 0, need_review: 0, ambiguous: 0, not_found: 0, duplicate_kes: 0, error: 0, skipped: 0 };
    matched.forEach((r) => { t[r.status] = (t[r.status] ?? 0) + 1; });
    return t;
  }, [matched]);

  const filtered = useMemo(() => {
    let xs = matched;
    if (filterStatus !== "all") xs = xs.filter((r) => r.status === filterStatus);
    const s = q.trim().toLowerCase();
    if (s) xs = xs.filter((r) => [r.full_name, r.kes, r.bag, r.kls, r.pnd, r.candidate?.full_name, r.candidate?.temporary_id, r.candidate?.test_number].some((v) => (v ?? "").toString().toLowerCase().includes(s)));
    return xs;
  }, [matched, filterStatus, q]);

  const toApply = useMemo(() =>
    matched.filter((r) => r.candidate && r.status === "ready" && (!r.conflict_other_kes_holder || (overrideDuplicate && isSuperAdmin)))
  , [matched, overrideDuplicate, isSuperAdmin]);

  const toCreate = useMemo(() =>
    createMissing ? matched.filter((r) => r.status === "not_found" && r.kes && r.full_name) : []
  , [createMissing, matched]);

  function downloadErrorReport() {
    const errs = matched.filter((r) => ["error", "ambiguous", "not_found", "duplicate_kes", "need_review"].includes(r.status));
    if (!errs.length) { toast.info("Tidak ada error/warning."); return; }
    const aoa = [
      ["source_row_number", "no", "bag", "kls", "kes", "pnd", "nama", "tpt_lhr", "tgl_lhr", "matched_candidate", "temporary_id", "old_test_number", "new_test_number", "match_confidence", "status", "error", "warning", "suggested_fix"],
      ...errs.map((r) => [
        r.source_row_number, r.no ?? "", r.bag ?? "", r.kls ?? "", r.kes, r.pnd ?? "",
        r.full_name, r.birth_place ?? "", r.birth_date ?? "",
        r.candidate?.full_name ?? "", r.candidate?.temporary_id ?? "",
        r.candidate?.test_number ?? "", r.kes, r.confidence, r.status,
        r.errors.join("; "), r.warnings.join("; "),
        r.status === "ambiguous" ? "Pilih kandidat manual di preview" :
        r.status === "not_found" ? "Verifikasi nama/tgl lahir, atau aktifkan Buat Peserta Baru" :
        r.status === "duplicate_kes" ? "Override hanya oleh Super Admin dengan alasan" : "",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Errors");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `import-nomor-tes-errors-${Date.now()}.xlsx`);
    logAudit({ action: "download_import_nomor_tes_error_report", module: "Import Nomor Tes" }).catch(() => {});
  }

  async function runImport() {
    if (!file || !selId) return;
    if (!confirmAck) { toast.error("Centang konfirmasi terlebih dahulu"); return; }
    if (toApply.length === 0 && toCreate.length === 0) { toast.error("Tidak ada baris yang siap diimpor"); return; }
    setRunning(true);
    const startedAt = new Date().toISOString();
    try {
      // 1) Create session
      const sessionPayload = {
        selection_id: selId,
        file_name: file.name,
        file_type: file.name.toLowerCase().endsWith(".csv") ? "csv" : "xlsx",
        source_format: "KES",
        total_rows: matched.length,
        matched_rows: matched.filter((r) => r.candidate).length,
        updated_rows: 0,
        skipped_rows: totals.skipped,
        error_rows: totals.error,
        ambiguous_rows: totals.ambiguous,
        not_found_rows: totals.not_found,
        status: "Running",
        options_json: { updateAdmin, fillMissingId, createMissing, overrideDuplicate, overrideReason },
        started_at: startedAt,
      };
      const sessIns = await supabase.from("test_number_import_sessions" as never).insert(sessionPayload as never).select("id").single();
      if (sessIns.error) throw sessIns.error;
      const session_id = (sessIns.data as never as { id: string }).id;
      await logAudit({ action: "confirm_import_nomor_tes", module: "Import Nomor Tes", record_id: session_id, after: sessionPayload });

      let updated = 0, errors = 0, skipped = 0;

      // 2) Apply updates
      for (const r of toApply) {
        if (!r.candidate) continue;
        const before = {
          old_test_number: r.candidate.test_number,
          old_test_number_status: r.candidate.test_number_status,
          old_temporary_id: r.candidate.temporary_id,
          old_hari_h_stage: r.candidate.hari_h_stage,
          old_radiology_initial_status: r.candidate.radiology_initial_status,
          old_ekg_initial_status: r.candidate.ekg_initial_status,
          old_progress_percentage: r.candidate.progress_percentage,
        };
        const patch: Record<string, unknown> = {
          test_number: r.kes,
          test_number_status: "Final",
          test_number_assigned_at: new Date().toISOString(),
          test_number_notes: `Import KES sesi ${session_id}`,
        };
        if (updateAdmin) {
          if (r.no != null) { patch.serial_number = r.no; patch.sort_order = r.no; }
          if (r.bag != null) patch.bag_number = r.bag;
          if (r.kls != null) patch.class_group = r.kls;
          if (r.pnd != null) patch.pnd_code = r.pnd;
        }
        if (fillMissingId) {
          if (r.birth_place && !r.candidate.birth_place) patch.birth_place = r.birth_place;
          if (r.birth_date && !r.candidate.birth_date) patch.birth_date = r.birth_date;
        }

        const upd = await supabase.from("candidates").update(patch as never).eq("id", r.candidate.id);
        if (upd.error) {
          errors += 1;
          await supabase.from("test_number_import_rows" as never).insert({
            session_id, source_row_number: r.source_row_number, candidate_id: r.candidate.id, exam_id: r.candidate.exam_id,
            old_test_number: r.candidate.test_number, new_test_number: r.kes,
            match_confidence: r.confidence, row_status: "error",
            raw_data_json: r as never, mapped_data_json: patch as never,
            error_messages_json: { error: upd.error.message } as never,
          } as never);
          await logAudit({ action: "import_nomor_tes_row_failed", module: "Import Nomor Tes", candidate_id: r.candidate.id, before: before as never, after: { error: upd.error.message } as never });
          continue;
        }
        updated += 1;
        await supabase.from("test_number_import_rows" as never).insert({
          session_id, source_row_number: r.source_row_number, candidate_id: r.candidate.id, exam_id: r.candidate.exam_id,
          old_test_number: r.candidate.test_number, new_test_number: r.kes,
          match_confidence: r.confidence, row_status: "updated",
          raw_data_json: r as never, mapped_data_json: patch as never,
        } as never);
        await logAudit({
          action: "update_candidate_nomor_tes", module: "Import Nomor Tes",
          candidate_id: r.candidate.id, record_id: r.candidate.id,
          before: before as never,
          after: {
            new_test_number: r.kes, new_test_number_status: "Final",
            temporary_id: r.candidate.temporary_id, hari_h_stage: r.candidate.hari_h_stage,
            radiology_initial_status: r.candidate.radiology_initial_status,
            ekg_initial_status: r.candidate.ekg_initial_status,
            progress_percentage: r.candidate.progress_percentage,
          } as never,
        });
        // Recompute progress (preserves Rontgen/EKG status)
        if (r.candidate.exam_id) {
          await supabase.rpc("compute_exam_progress" as never, { p_exam_id: r.candidate.exam_id } as never);
          await logAudit({ action: "recalculate_progress_after_nomor_tes_import", module: "Import Nomor Tes", candidate_id: r.candidate.id });
          await logAudit({ action: "preserve_existing_radiology_ekg_data", module: "Import Nomor Tes", candidate_id: r.candidate.id });
        }
      }

      // 3) Create missing candidates (optional)
      for (const r of toCreate) {
        const ins = await supabase.from("candidates").insert({
          selection_id: selId,
          full_name: r.full_name,
          birth_place: r.birth_place,
          birth_date: r.birth_date,
          test_number: r.kes,
          test_number_status: "Final",
          test_number_assigned_at: new Date().toISOString(),
          test_number_notes: `Import KES (created) sesi ${session_id}`,
          serial_number: r.no ?? null,
          sort_order: r.no ?? null,
          bag_number: r.bag ?? null,
          class_group: r.kls ?? null,
          pnd_code: r.pnd ?? null,
          registration_notes: r.ket ?? null,
        } as never).select("id").single();
        if (ins.error) {
          errors += 1;
          await supabase.from("test_number_import_rows" as never).insert({
            session_id, source_row_number: r.source_row_number, new_test_number: r.kes,
            match_confidence: "not_found", row_status: "error",
            raw_data_json: r as never, error_messages_json: { error: ins.error.message } as never,
          } as never);
          continue;
        }
        updated += 1;
        await supabase.from("test_number_import_rows" as never).insert({
          session_id, source_row_number: r.source_row_number,
          candidate_id: (ins.data as never as { id: string }).id,
          new_test_number: r.kes, match_confidence: "not_found", row_status: "created",
          raw_data_json: r as never,
        } as never);
      }

      skipped = matched.length - updated - errors;

      await supabase.from("test_number_import_sessions" as never).update({
        updated_rows: updated, error_rows: errors, skipped_rows: skipped,
        status: errors > 0 ? "Completed with Errors" : "Completed",
        completed_at: new Date().toISOString(),
      } as never).eq("id", session_id);

      await logAudit({ action: "import_nomor_tes_completed", module: "Import Nomor Tes", record_id: session_id, after: { updated, errors, skipped } });
      setResult({ session_id, updated, skipped, errors });
      toast.success(`Import selesai: ${updated} update, ${errors} error.`);
      setConfirmOpen(false);
      await loadHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import gagal");
    } finally {
      setRunning(false);
    }
  }

  if (!allowed) {
    return (
      <div className="p-8">
        <Card><CardContent className="p-6 text-sm">
          Akses ditolak. Modul Import Nomor Tes hanya untuk Super Admin / Admin / Registrasi.
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Hash className="h-6 w-6" /> Import Nomor Tes Final</h1>
          <p className="text-sm text-muted-foreground">
            Upload file <strong>KES</strong> (XLSX/CSV) untuk mengisi Nomor Tes final pada peserta yang sudah ada — Rontgen, EKG, attachment, exam, dan progress tetap utuh.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => downloadBlob(buildKesTemplateCsv(), "template-nomor-tes-kes.csv")}>
            <Download className="h-4 w-4 mr-2" /> Template CSV
          </Button>
        </div>
      </div>

      <Tabs defaultValue="wizard">
        <TabsList>
          <TabsTrigger value="wizard"><Upload className="h-4 w-4 mr-1" /> Upload & Preview</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-1" /> Riwayat Import</TabsTrigger>
        </TabsList>

        <TabsContent value="wizard" className="space-y-4">
          {/* Step 1: Selection + File */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">1. Pilih Seleksi & Upload File</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Seleksi target *</Label>
                <Select value={selId} onValueChange={setSelId}>
                  <SelectTrigger><SelectValue placeholder="Pilih seleksi…" /></SelectTrigger>
                  <SelectContent>
                    {sels.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} — {s.year_label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">File KES (.xlsx / .csv) *</Label>
                <Input type="file" accept=".xlsx,.xls,.csv"
                  onChange={(e) => { setFile(e.target.files?.[0] ?? null); setParsed([]); setMatched([]); setResult(null); }} />
              </div>
              <div className="flex items-end">
                <Button onClick={handleParse} disabled={!file || !selId || parsing} className="w-full">
                  {parsing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                  Parse & Cocokkan
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Summary & Options */}
          {matched.length > 0 && (
            <>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">2. Ringkasan & Opsi</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">Sheet: {sheetUsed}</Badge>
                    <Badge variant="outline">Total: {totals.total}</Badge>
                    <Badge className={STATUS_BADGE.ready}>Ready: {totals.ready}</Badge>
                    <Badge className={STATUS_BADGE.need_review}>Review: {totals.need_review}</Badge>
                    <Badge className={STATUS_BADGE.ambiguous}>Ambiguous: {totals.ambiguous}</Badge>
                    <Badge className={STATUS_BADGE.not_found}>Not Found: {totals.not_found}</Badge>
                    <Badge className={STATUS_BADGE.duplicate_kes}>Duplikat KES: {totals.duplicate_kes}</Badge>
                    <Badge className={STATUS_BADGE.error}>Error: {totals.error}</Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <label className="flex items-center gap-2">
                      <Switch checked={updateAdmin} onCheckedChange={setUpdateAdmin} />
                      <span>Update urutan & administratif (NO, BAG, KLS, PND)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <Switch checked={fillMissingId} onCheckedChange={setFillMissingId} />
                      <span>Isi TPT/TGL Lahir jika peserta belum punya</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <Switch checked={createMissing} onCheckedChange={setCreateMissing} />
                      <span>Buat peserta baru untuk row Not Found</span>
                    </label>
                    {isSuperAdmin && (
                      <label className="flex items-center gap-2">
                        <Switch checked={overrideDuplicate} onCheckedChange={setOverrideDuplicate} />
                        <span className="text-rose-700">Override Nomor Tes duplikat (Super Admin)</span>
                      </label>
                    )}
                  </div>
                  {overrideDuplicate && (
                    <Input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Alasan override duplikat (wajib)" />
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                    <Button variant="outline" onClick={downloadErrorReport}><Download className="h-4 w-4 mr-2" /> Download Error Report</Button>
                    <div className="flex flex-wrap items-center gap-1 ml-auto">
                      <span className="text-[11px] text-muted-foreground mr-1">Bulk:</span>
                      <Button size="sm" variant="outline" onClick={() => bulkAction("auto_pick_first_ambiguous")} disabled={totals.ambiguous === 0}>
                        Auto-pick Ambiguous ({totals.ambiguous})
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => bulkAction("skip_ambiguous")} disabled={totals.ambiguous === 0}>
                        Skip Ambiguous
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => bulkAction("skip_not_found")} disabled={totals.not_found === 0}>
                        Skip Not Found ({totals.not_found})
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => bulkAction("promote_need_review")} disabled={totals.need_review === 0}>
                        Tandai Need Review → Ready ({totals.need_review})
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => bulkAction("reset_skipped")} disabled={totals.skipped === 0}>
                        Reset Skipped ({totals.skipped})
                      </Button>
                    </div>
                    <Button
                      onClick={() => { setConfirmAck(false); setConfirmOpen(true); }}
                      disabled={toApply.length === 0 && toCreate.length === 0}>
                      <ShieldCheck className="h-4 w-4 mr-2" /> Jalankan Import ({toApply.length + toCreate.length})
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Step 3: Preview Table */}
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">3. Preview Before / After</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input className="pl-7 h-8 w-56" placeholder="Cari nama/KES…" value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Status</SelectItem>
                        <SelectItem value="ready">Ready</SelectItem>
                        <SelectItem value="need_review">Need Review</SelectItem>
                        <SelectItem value="ambiguous">Ambiguous</SelectItem>
                        <SelectItem value="not_found">Not Found</SelectItem>
                        <SelectItem value="duplicate_kes">Duplikat KES</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="text-left p-2">Status</th>
                          <th className="text-left p-2">Conf</th>
                          <th className="text-left p-2">Row</th>
                          <th className="text-left p-2">NO/BAG/KLS</th>
                          <th className="text-left p-2">KES Baru</th>
                          <th className="text-left p-2">Nama Excel</th>
                          <th className="text-left p-2">TPT / TGL LHR</th>
                          <th className="text-left p-2">Candidate / Temp ID</th>
                          <th className="text-left p-2">No Test Lama</th>
                          <th className="text-left p-2">Stage</th>
                          <th className="text-left p-2">RO / EKG</th>
                          <th className="text-left p-2">Progress</th>
                          <th className="text-left p-2">Pesan</th>
                          <th className="text-left p-2">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((r) => {
                          const idx = matched.indexOf(r);
                          const hasMedical = !!(r.candidate?.radiology_initial_status && r.candidate.radiology_initial_status !== "Belum Diisi") || !!(r.candidate?.ekg_initial_status && r.candidate.ekg_initial_status !== "Belum Diisi") || r.rad_attachments_count > 0 || r.ekg_attachments_count > 0;
                          return (
                            <tr key={`${r.source_row_number}-${idx}`} className="border-t hover:bg-accent/30">
                              <td className="p-2"><Badge className={STATUS_BADGE[r.status]}>{r.status}</Badge></td>
                              <td className="p-2"><Badge variant="outline" className={CONFIDENCE_BADGE[r.confidence]}>{r.confidence}</Badge></td>
                              <td className="p-2 font-mono">{r.source_row_number}</td>
                              <td className="p-2 font-mono">{r.no ?? "—"}/{r.bag ?? "—"}/{r.kls ?? "—"}</td>
                              <td className="p-2 font-mono font-semibold">{r.kes}</td>
                              <td className="p-2">{r.full_name}</td>
                              <td className="p-2">{r.birth_place ?? "—"} / {r.birth_date ?? "—"}</td>
                              <td className="p-2">
                                {r.candidate ? (
                                  <div>
                                    <div>{r.candidate.full_name}</div>
                                    <div className="text-muted-foreground font-mono text-[10px]">{r.candidate.temporary_id ?? "—"}</div>
                                  </div>
                                ) : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="p-2 font-mono">{r.candidate?.test_number ?? "—"}</td>
                              <td className="p-2">{r.candidate?.hari_h_stage ?? "—"}</td>
                              <td className="p-2">
                                <div>RO: {r.candidate?.radiology_initial_status ?? "—"} ({r.rad_attachments_count})</div>
                                <div>EKG: {r.candidate?.ekg_initial_status ?? "—"} ({r.ekg_attachments_count})</div>
                                {hasMedical && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-[10px] mt-1">Data RO/EKG dipertahankan</Badge>}
                              </td>
                              <td className="p-2">{r.candidate?.progress_percentage ?? "—"}%</td>
                              <td className="p-2">
                                {r.errors.length > 0 && <div className="text-rose-700">{r.errors.join("; ")}</div>}
                                {r.warnings.length > 0 && <div className="text-amber-700">{r.warnings.join("; ")}</div>}
                                {r.conflict_other_kes_holder && <div className="text-rose-700">KES dipakai: {r.conflict_other_kes_holder.full_name}</div>}
                              </td>
                              <td className="p-2">
                                {r.status === "ambiguous" && r.candidate_options.length > 0 && (
                                  <Select onValueChange={(v) => setManualMatch(idx, v as never)}>
                                    <SelectTrigger className="h-7 w-44 text-[11px]"><SelectValue placeholder="Pilih candidate…" /></SelectTrigger>
                                    <SelectContent>
                                      {r.candidate_options.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                          {c.full_name} {c.birth_date ? `(${c.birth_date})` : ""}
                                        </SelectItem>
                                      ))}
                                      <SelectItem value="skip">— Skip baris ini —</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                                {r.candidate?.exam_id && (
                                  <Button asChild size="sm" variant="ghost" className="h-7 text-[11px]">
                                    <Link to="/rikkes/$id" params={{ id: r.candidate.exam_id ?? r.candidate.id }} search={{ from: "import-nomor-tes", candidateId: r.candidate.id, selectionId: r.candidate.selection_id }}>
                                      <ExternalLink className="h-3 w-3 mr-1" /> Detail
                                    </Link>
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {filtered.length === 0 && (
                          <tr><td colSpan={14} className="p-6 text-center text-muted-foreground">Tidak ada baris cocok filter.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {result && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" /> Import selesai
                </div>
                <div className="text-sm">Updated: <strong>{result.updated}</strong> • Skipped: <strong>{result.skipped}</strong> • Errors: <strong>{result.errors}</strong></div>
                <div className="text-xs text-muted-foreground">Session ID: <code>{result.session_id}</code></div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Riwayat Import Nomor Tes</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs">
                    <tr>
                      <th className="text-left p-2">Waktu</th>
                      <th className="text-left p-2">File</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-right p-2">Total</th>
                      <th className="text-right p-2">Updated</th>
                      <th className="text-right p-2">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id} className="border-t">
                        <td className="p-2 text-xs">{new Date(h.created_at).toLocaleString("id-ID")}</td>
                        <td className="p-2">{h.file_name}</td>
                        <td className="p-2"><Badge variant="outline">{h.status}</Badge></td>
                        <td className="p-2 text-right">{h.total_rows}</td>
                        <td className="p-2 text-right text-emerald-700 font-semibold">{h.updated_rows}</td>
                        <td className="p-2 text-right text-rose-700">{h.error_rows}</td>
                      </tr>
                    ))}
                    {history.length === 0 && (
                      <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Belum ada riwayat.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" /> Konfirmasi Import Nomor Tes
            </DialogTitle>
            <DialogDescription>
              Pastikan ringkasan di bawah sudah sesuai. Aksi ini akan mengupdate Nomor Tes pada peserta yang sudah ada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div>Total baris file: <strong>{totals.total}</strong></div>
            <div>Siap update Nomor Tes: <strong className="text-emerald-700">{toApply.length}</strong></div>
            {createMissing && <div>Akan dibuat peserta baru: <strong>{toCreate.length}</strong></div>}
            <div>Perlu review (low confidence): <strong>{totals.need_review}</strong></div>
            <div>Ambiguous: <strong>{totals.ambiguous}</strong></div>
            <div>Not Found: <strong>{totals.not_found}</strong></div>
            <div>Duplikat KES: <strong>{totals.duplicate_kes}</strong></div>
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2">
              ✓ Data Rontgen, EKG, attachment, exam, section, stage, dan progress yang sudah ada <strong>akan dipertahankan</strong>.
            </div>
            <label className="flex items-start gap-2 pt-2 cursor-pointer">
              <Checkbox checked={confirmAck} onCheckedChange={(b) => setConfirmAck(!!b)} className="mt-0.5" />
              <span className="text-xs">
                Saya memahami bahwa sistem hanya akan mengupdate Nomor Tes dan data administratif yang dipilih,
                tanpa menghapus Rontgen, EKG, attachment gambar, exam, section, stage, dan progress yang sudah ada.
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={running}>Batal</Button>
            <Button onClick={runImport} disabled={!confirmAck || running}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              Jalankan Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}