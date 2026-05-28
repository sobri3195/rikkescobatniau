import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { listActiveSelections } from "@/lib/selectionService";
import {
  detectWorkbookSheets,
  mergeAndValidate,
  parseAbsenSheet,
  parseAplikasiSheet,
  parseResumeCasisSheet,
  readWorkbook,
  type PreviewRow,
} from "@/lib/import/rikkes-xlsx-import";
import { executeImport } from "@/lib/import/execute-import";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { generateId, getDb, nowIso, saveDb } from "@/lib/localDb";

export const Route = createFileRoute("/_authenticated/import-data")({
  component: ImportDataPage,
});

type Step = 1 | 2 | 3 | 4 | 5;

function ImportDataPage() {
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [detected, setDetected] = useState<ReturnType<typeof detectWorkbookSheets> | null>(null);
  const wbRef = useRef<Awaited<ReturnType<typeof readWorkbook>> | null>(null);
  const [selections, setSelections] = useState<{ id: string; name: string; year_label: string }[]>(
    [],
  );
  const [selectionId, setSelectionId] = useState<string>("");
  const [importAbsen, setImportAbsen] = useState(true);
  const [importAplikasi, setImportAplikasi] = useState(true);
  const [importResume, setImportResume] = useState(true);
  const [duplicateAction, setDuplicateAction] = useState<"skip" | "update" | "create_new">("skip");
  const [recalculate, setRecalculate] = useState(true);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [filter, setFilter] = useState<"all" | "Ready" | "Warning" | "Error">("all");
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [resultSummary, setResultSummary] = useState<{
    success: number;
    failed: number;
    skipped: number;
    warnings: number;
  } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    listActiveSelections().then((data) => setSelections((data as any) || []));
  }, []);

  async function handleFileChosen(f: File) {
    setFile(f);
    setParsing(true);
    try {
      const wb = await readWorkbook(f);
      wbRef.current = wb;
      const d = detectWorkbookSheets(wb);
      setDetected(d);
      setImportAbsen(d.hasAbsen);
      setImportAplikasi(d.hasAplikasi);
      setImportResume(d.hasResumeCasis);
      await logAudit({
        action: "import_file_uploaded",
        module: "Import Data",
        after: { name: f.name, size: f.size, sheets: d.sheets.map((s) => s.name) },
      });
    } catch (e) {
      toast.error(`Gagal membaca file: ${e instanceof Error ? e.message : e}`);
    } finally {
      setParsing(false);
    }
  }

  function buildPreview() {
    const wb = wbRef.current;
    if (!wb || !detected) return;
    const absenSheet = detected.sheets.find((s) => s.kind === "absen");
    const apSheet = detected.sheets.find((s) => s.kind === "aplikasi");
    const resumeSheet = detected.sheets.find((s) => s.kind === "resume_casis");
    const absen = importAbsen && absenSheet ? parseAbsenSheet(wb.Sheets[absenSheet.name]) : [];
    const aplikasi = importAplikasi && apSheet ? parseAplikasiSheet(wb.Sheets[apSheet.name]) : [];
    const resume =
      importResume && resumeSheet ? parseResumeCasisSheet(wb.Sheets[resumeSheet.name]) : [];
    setPreview(mergeAndValidate({ absen, aplikasi, resume }));
  }

  const filteredPreview = useMemo(
    () =>
      preview.filter((r) => {
        if (filter !== "all" && r.status !== filter) return false;
        if (
          search &&
          !`${r.test_number} ${r.full_name} ${r.combined_identity ?? ""}`
            .toLowerCase()
            .includes(search.toLowerCase())
        )
          return false;
        return true;
      }),
    [preview, filter, search],
  );

  const counts = useMemo(
    () => ({
      total: preview.length,
      ready: preview.filter((r) => r.status === "Ready").length,
      warning: preview.filter((r) => r.status === "Warning").length,
      error: preview.filter((r) => r.status === "Error").length,
    }),
    [preview],
  );

  async function runImport() {
    if (!selectionId || !file) return;
    setImporting(true);
    try {
      const db = getDb() as any;
      db.import_sessions = db.import_sessions ?? [];
      const sess = {
        id: generateId("ims"),
        selection_id: selectionId,
        file_name: file.name,
        file_size: file.size,
        import_type: "workbook_rikkes",
        import_strategy: importAplikasi ? "candidates_plus_results" : "candidates_only",
        status: "Importing",
        started_at: new Date().toISOString(),
        detected_sheets_json: JSON.parse(JSON.stringify(detected?.sheets || [])),
        options_json: { importAbsen, importAplikasi, importResume, duplicateAction, recalculate },
        created_at: nowIso(),
      };
      db.import_sessions.push(sess);
      saveDb(db);
      setSessionId(sess.id);
      await logAudit({ action: "import_started", module: "Import Data", record_id: sess.id });
      setProgress({
        done: 0,
        total: preview.filter((r) => !r.excluded && r.status !== "Error").length,
      });
      const res = await executeImport(
        preview,
        { selectionId, sessionId: sess.id, duplicateAction, recalculate },
        (done, total) => setProgress({ done, total }),
      );
      setResultSummary(res);
      setStep(5);
      toast.success(`Import selesai: ${res.success} sukses, ${res.failed} gagal`);
    } catch (e) {
      toast.error(`Import gagal: ${e instanceof Error ? e.message : e}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Import Data Workbook RIKKES</h1>
        <p className="text-sm text-muted-foreground">
          Migrasikan workbook RIKKES lama (.xlsx) ke LocalDB. Semua hasil import melalui preview,
          validasi, dan audit log.
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs flex-wrap">
        {(
          [
            [1, "Upload"],
            [2, "Seleksi & Strategi"],
            [3, "Preview & Validasi"],
            [4, "Konfirmasi"],
            [5, "Hasil"],
          ] as const
        ).map(([n, label]) => (
          <div
            key={n}
            className={`px-3 py-1.5 rounded-full border ${step === n ? "bg-primary text-primary-foreground border-primary" : "bg-muted"}`}
          >
            {n}. {label}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card className="p-6 space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              Import XLSX dapat mengubah banyak data sekaligus. Pastikan file sudah benar sebelum
              melanjutkan.
            </div>
          </div>
          <Label>Pilih file workbook (.xlsx)</Label>
          <Input
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileChosen(f);
            }}
          />
          {parsing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Membaca workbook…
            </div>
          )}
          {file && detected && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4" />
                <span className="font-medium">{file.name}</span>
                <span className="text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
              <div>
                <div className="text-sm font-medium mb-2">Sheet terdeteksi:</div>
                <div className="flex flex-wrap gap-2">
                  {detected.sheets.map((s) => (
                    <Badge key={s.name} variant={s.kind === "unknown" ? "outline" : "default"}>
                      {s.name}{" "}
                      {s.kind !== "unknown" && <span className="ml-1 opacity-70">[{s.kind}]</span>}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button onClick={() => setStep(2)}>
                Lanjut <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </Card>
      )}

      {step === 2 && (
        <Card className="p-6 space-y-4">
          <div>
            <Label>Seleksi tujuan</Label>
            <Select value={selectionId} onValueChange={setSelectionId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih seleksi" />
              </SelectTrigger>
              <SelectContent>
                {selections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} — {s.year_label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Sheet yang akan diimport</Label>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={importAbsen}
                  onCheckedChange={(v) => setImportAbsen(!!v)}
                  disabled={!detected?.hasAbsen}
                />{" "}
                Absen perkelas
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={importAplikasi}
                  onCheckedChange={(v) => setImportAplikasi(!!v)}
                  disabled={!detected?.hasAplikasi}
                />{" "}
                APLIKASI
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={importResume}
                  onCheckedChange={(v) => setImportResume(!!v)}
                  disabled={!detected?.hasResumeCasis}
                />{" "}
                RESUME CASIS
              </label>
            </div>
          </div>
          <div>
            <Label>Jika peserta sudah ada di seleksi ini</Label>
            <Select value={duplicateAction} onValueChange={(v) => setDuplicateAction(v as never)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skip">Skip — abaikan duplikat</SelectItem>
                <SelectItem value="update">Update — perbarui existing</SelectItem>
                <SelectItem value="create_new">Create new — buat baru</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={recalculate} onCheckedChange={(v) => setRecalculate(!!v)} />{" "}
            Recalculate hasil bila tidak konsisten
          </label>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
            </Button>
            <Button
              disabled={!selectionId}
              onClick={() => {
                buildPreview();
                setStep(3);
              }}
            >
              Buat Preview <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-4 space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <Stat label="Total" value={counts.total} />
            <Stat label="Ready" value={counts.ready} tone="green" />
            <Stat label="Warning" value={counts.warning} tone="amber" />
            <Stat label="Error" value={counts.error} tone="red" />
          </div>
          <div className="flex gap-2 items-center">
            <Input
              placeholder="Cari nama / no test…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={filter} onValueChange={(v) => setFilter(v as never)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="Ready">Ready</SelectItem>
                <SelectItem value="Warning">Warning</SelectItem>
                <SelectItem value="Error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-auto border rounded max-h-[500px]">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>
                  {[
                    "Status",
                    "No",
                    "No Test",
                    "Nama",
                    "Pok",
                    "TB/BB",
                    "IMT",
                    "KESUM",
                    "KESWA",
                    "Hasil",
                    "Nilai",
                    "Sumber",
                    "Catatan",
                    "Skip",
                  ].map((h) => (
                    <th key={h} className="p-2 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPreview.map((r) => (
                  <tr key={r.key} className="border-t hover:bg-muted/30">
                    <td className="p-2">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="p-2">{r.serial_number ?? "—"}</td>
                    <td className="p-2 font-mono">{r.test_number}</td>
                    <td className="p-2">{r.full_name || r.combined_identity}</td>
                    <td className="p-2">{r.pok_korp ?? "—"}</td>
                    <td className="p-2">
                      {r.height_cm ?? "—"}/{r.weight_kg ?? "—"}
                    </td>
                    <td className="p-2">{r.bmi ?? r.bmi_calc ?? "—"}</td>
                    <td className="p-2">{r.kesum_classification ?? "—"}</td>
                    <td className="p-2">{r.keswa_status ?? "—"}</td>
                    <td className="p-2">{r.final_result ?? "—"}</td>
                    <td className="p-2">{r.final_score ?? "—"}</td>
                    <td className="p-2 text-muted-foreground">{r.sourceSheets.join(",")}</td>
                    <td className="p-2 text-[11px]">
                      {r.errors.map((e, i) => (
                        <div key={`e${i}`} className="text-red-600">
                          • {e}
                        </div>
                      ))}
                      {r.warnings.map((w, i) => (
                        <div key={`w${i}`} className="text-amber-600">
                          • {w}
                        </div>
                      ))}
                    </td>
                    <td className="p-2">
                      <Checkbox
                        checked={!!r.excluded}
                        onCheckedChange={(v) =>
                          setPreview((prev) =>
                            prev.map((p) => (p.key === r.key ? { ...p, excluded: !!v } : p)),
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
            </Button>
            <Button onClick={() => setStep(4)} disabled={counts.total === 0}>
              Lanjut Konfirmasi <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card className="p-6 space-y-4">
          <h2 className="font-semibold">Konfirmasi Import</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat
              label="Akan diimport"
              value={preview.filter((r) => !r.excluded && r.status !== "Error").length}
              tone="green"
            />
            <Stat label="Excluded" value={preview.filter((r) => r.excluded).length} tone="muted" />
            <Stat label="Error (skip)" value={counts.error} tone="red" />
            <Stat label="Warning" value={counts.warning} tone="amber" />
          </div>
          <div className="text-sm">
            <div>
              File: <b>{file?.name}</b>
            </div>
            <div>
              Seleksi: <b>{selections.find((s) => s.id === selectionId)?.name}</b>
            </div>
            <div>
              Strategi duplikat: <b>{duplicateAction}</b>
            </div>
          </div>
          {importing && (
            <div className="text-sm">
              <Loader2 className="inline h-4 w-4 animate-spin mr-1" /> Importing {progress.done}/
              {progress.total}…
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(3)} disabled={importing}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
            </Button>
            <Button onClick={runImport} disabled={importing}>
              {importing ? "Importing…" : "Mulai Import"}
            </Button>
          </div>
        </Card>
      )}

      {step === 5 && resultSummary && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <h2 className="font-semibold">Import Selesai</h2>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Stat label="Sukses" value={resultSummary.success} tone="green" />
            <Stat label="Warning" value={resultSummary.warnings} tone="amber" />
            <Stat label="Gagal" value={resultSummary.failed} tone="red" />
            <Stat label="Skipped" value={resultSummary.skipped} tone="muted" />
          </div>
          {sessionId && (
            <div className="text-xs text-muted-foreground">
              Session ID: <code>{sessionId}</code>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setStep(1);
                setFile(null);
                setPreview([]);
                setResultSummary(null);
                wbRef.current = null;
                setDetected(null);
              }}
            >
              Import file lain
            </Button>
            <Button asChild>
              <a href="/import-history">Lihat History</a>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "amber" | "red" | "muted";
}) {
  const cls =
    tone === "green"
      ? "bg-green-50 text-green-900 border-green-200"
      : tone === "amber"
        ? "bg-amber-50 text-amber-900 border-amber-200"
        : tone === "red"
          ? "bg-red-50 text-red-900 border-red-200"
          : tone === "muted"
            ? "bg-muted text-muted-foreground"
            : "bg-card";
  return (
    <div className={`rounded-md border p-3 ${cls}`}>
      <div className="text-[11px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: PreviewRow["status"] }) {
  if (status === "Error")
    return (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3 mr-1" />
        Error
      </Badge>
    );
  if (status === "Warning")
    return (
      <Badge className="bg-amber-500">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Warn
      </Badge>
    );
  if (status === "Duplicate") return <Badge variant="outline">Duplicate</Badge>;
  return (
    <Badge className="bg-green-600">
      <CheckCircle2 className="h-3 w-3 mr-1" />
      Ready
    </Badge>
  );
}
