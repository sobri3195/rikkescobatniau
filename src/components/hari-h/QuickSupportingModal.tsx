import { useEffect, useState } from "react";
import { nowIso } from "@/lib/localDb";
import { upsertCardiologyLocal, getCardiologyByExamIdLocal } from "@/lib/services/cardiologyService";
import { upsertRadiologyLocal, getRadiologyByExamIdLocal } from "@/lib/services/radiologyService";
import { createDefaultExamSectionsLocal, updateSectionLocal } from "@/lib/services/examSectionService";
import { getExamDetailLocal, recalcExamProgressLocal, updateExamLocal } from "@/lib/services/examService";
import { addAuditLogLocal } from "@/lib/services/auditService";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Trash2, FileText, Image as ImageIcon, Loader2, Camera } from "lucide-react";

type Mode = "ekg" | "radiology";
type Attachment = { name: string; path: string; size: number; type: string; uploaded_at: string };

const CONFIG = {
  ekg: {
    title: "Input Cepat EKG",
    sectionKey: "ekg",
    types: ["EKG", "Ergometri", "Lainnya"],
    clearNote: "EKG sudah diperiksa dan dinyatakan clear.",
    moduleName: "hari_h_ekg",
  },
  radiology: {
    title: "Input Cepat Rontgen / Radiologi",
    sectionKey: "radiology",
    types: ["Thorax", "Lainnya"],
    clearNote: "Rontgen sudah diperiksa dan dinyatakan clear.",
    moduleName: "hari_h_radiology",
  },
} as const;

export function QuickSupportingModal({
  open,
  onOpenChange,
  mode,
  examId,
  candidateId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: Mode;
  examId: string;
  candidateId: string;
  onSaved?: () => void;
}) {
  const cfg = CONFIG[mode];
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rowId, setRowId] = useState<string | null>(null);
  const [examType, setExamType] = useState<string>(cfg.types[0]);
  const [examinedOn, setExaminedOn] = useState<string>(new Date().toISOString().slice(0, 10));
  const [examination, setExamination] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [qualification, setQualification] = useState<string>("");
  const [status, setStatus] = useState<string>("Draft");
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const isRadiology = mode === "radiology";
  const showAttachmentSection = !isRadiology || qualification === "K2";
  const isAttachmentRequired = isRadiology ? qualification === "K2" : true;
  const hasCamera =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function";

  function handleQualificationChange(next: string) {
    if (
      isRadiology &&
      next !== "K2" &&
      qualification === "K2" &&
      attachments.length > 0
    ) {
      const ok = window.confirm(
        "Kualifikasi bukan K2. Lampiran yang sudah dipilih akan dihapus. Lanjutkan?",
      );
      if (!ok) return;
      setAttachments([]);
    }
    setQualification(next);
  }

  useEffect(() => {
    if (!open || !examId) return;
    (async () => {
      const d: any = mode === "radiology" ? getRadiologyByExamIdLocal(examId) : getCardiologyByExamIdLocal(examId);
      if (d) {
        setRowId(d.id);
        setExamType(d.examination_type ?? cfg.types[0]);
        setExaminedOn(d.examined_on ?? new Date().toISOString().slice(0, 10));
        setExamination(d.examination ?? "");
        setConclusion(d.conclusion ?? "");
        setQualification(d.qualification_u ?? "");
        setStatus(d.status ?? "Draft");
        setAttachments(Array.isArray(d.attachments_json) ? d.attachments_json : []);
      } else {
        setRowId(null);
        setExamType(cfg.types[0]);
        setExaminedOn(new Date().toISOString().slice(0, 10));
        setExamination("");
        setConclusion("");
        setQualification("");
        setStatus("Draft");
        setAttachments([]);
      }
    })();
  }, [open, examId, mode]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const added: Attachment[] = Array.from(files).map((file) => ({
      name: file.name,
      path: `${examId}/${mode}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${file.name}`,
      size: file.size,
      type: file.type,
      uploaded_at: nowIso(),
    }));
    setAttachments((prev) => [...prev, ...added]);
    toast.success(`${added.length} file ditambahkan ke localDb`);
  }

  async function removeAttachment(idx: number) {
    const att = attachments[idx];
    if (!att) return;
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  async function persist(nextStatus: string) {
    setLoading(true);
    try {
      const exam = getExamDetailLocal(examId) as any;
      const payload: any = {
        exam_id: examId,
        candidate_id: candidateId,
        selection_id: exam?.selection_id ?? null,
        examination_type: examType,
        examined_on: examinedOn,
        examination,
        conclusion,
        qualification_u: qualification || null,
        qualification: qualification || "",
        status: nextStatus,
        attachments_json: attachments,
        examined_at: nextStatus !== "Draft" ? nowIso() : null,
      };
      const saved: any = mode === "radiology" ? upsertRadiologyLocal(payload) : upsertCardiologyLocal(payload);
      setRowId(saved.id);
      createDefaultExamSectionsLocal(examId, candidateId, exam?.selection_id ?? "");
      updateSectionLocal(examId, mode === "radiology" ? "rontgen" : "ekg", {
        section_status: nextStatus === "Draft" ? "Draft" : "Submitted",
        submitted_at: nextStatus === "Draft" ? null : nowIso(),
        form_data_json: payload,
        findings: conclusion || null,
        classification: qualification || null,
      });
      updateExamLocal(examId, mode === "radiology" ? { radiology_initial_status: nextStatus } : { ekg_initial_status: nextStatus });
      recalcExamProgressLocal(examId);
      addAuditLogLocal(`save_${mode}_local`, { exam_id: examId, candidate_id: candidateId, after_data_json: { status: nextStatus } });
      toast.success(
        nextStatus === "Cleared"
          ? "Ditandai Cleared"
          : nextStatus === "Submitted"
          ? "Berhasil disubmit"
          : "Draft tersimpan",
      );
      setStatus(nextStatus);
      onSaved?.();
      if (nextStatus !== "Draft") onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Gagal menyimpan");
    } finally {
      setLoading(false);
    }
  }

  async function handleClear() {
    if (!conclusion.trim()) setConclusion(cfg.clearNote);
    await persist("Cleared");
  }

  async function handleSubmit() {
    if (isAttachmentRequired && attachments.length === 0) {
      toast.error(
        isRadiology
          ? "Lampiran gambar wajib diunggah untuk kualifikasi K2."
          : "Minimal upload 1 file",
      );
      return;
    }
    if (!conclusion.trim()) {
      toast.error("Kesimpulan wajib diisi");
      return;
    }
    // For non-K2 radiology, strip attachment metadata from payload
    if (isRadiology && qualification !== "K2" && attachments.length > 0) {
      setAttachments([]);
    }
    await persist("Submitted");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {cfg.title}
            <Badge variant="outline" className="ml-2">{status}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Jenis Pemeriksaan</Label>
              <Select value={examType} onValueChange={setExamType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cfg.types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tanggal Pemeriksaan</Label>
              <Input type="date" value={examinedOn} onChange={(e) => setExaminedOn(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Pemeriksaan / Deskripsi</Label>
            <Textarea rows={2} value={examination} onChange={(e) => setExamination(e.target.value)} />
          </div>

          <div>
            <Label>Kesimpulan</Label>
            <Textarea rows={3} value={conclusion} onChange={(e) => setConclusion(e.target.value)}
              placeholder={cfg.clearNote} />
          </div>

          <div>
            <Label>Kualifikasi</Label>
            <Select
              value={qualification || "__none"}
              onValueChange={(v) => handleQualificationChange(v === "__none" ? "" : v)}
            >
              <SelectTrigger><SelectValue placeholder="Pilih kualifikasi" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— Belum —</SelectItem>
                {["B", "C", "K1", "K2", "TH", "Belum Lengkap"].map((q) => (
                  <SelectItem key={q} value={q}>{q}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showAttachmentSection ? (
          <div className="space-y-2">
            {isRadiology && (
              <div className="text-xs font-medium text-foreground">
                Lampiran Pemeriksaan Rontgen / Radiologi
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label>Lampiran File ({attachments.length})</Label>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/jpg,image/png,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      handleUpload(e.target.files);
                      e.target.value = "";
                    }}
                    disabled={uploading}
                  />
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border bg-background hover:bg-accent">
                    {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    Upload Gambar
                  </span>
                </label>
                {isRadiology && (
                  hasCamera ? (
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          handleUpload(e.target.files);
                          e.target.value = "";
                        }}
                        disabled={uploading}
                      />
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border bg-background hover:bg-accent">
                        <Camera className="h-3 w-3" />
                        Ambil Foto Kamera
                      </span>
                    </label>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Kamera tidak tersedia, silakan upload gambar.
                    </span>
                  )
                )}
              </div>
            </div>
            {attachments.length === 0 ? (
              <div className="text-xs text-muted-foreground border border-dashed rounded-md p-4 text-center">
                Belum ada file. Mendukung JPG, PNG, PDF (maks 5 MB).
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {attachments.map((a, i) => (
                  <AttachmentPreview key={i} att={a} onRemove={() => removeAttachment(i)} />
                ))}
              </div>
            )}
            {isRadiology && qualification === "K2" && attachments.length === 0 && (
              <p className="text-xs text-destructive">
                Lampiran gambar wajib diunggah untuk kualifikasi K2.
              </p>
            )}
          </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Kembali</Button>
          <Button variant="secondary" onClick={() => persist("Draft")} disabled={loading}>
            Simpan Draft
          </Button>
          <Button variant="outline" onClick={handleClear} disabled={loading}>
            Tandai Cleared
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || (isAttachmentRequired && attachments.length === 0)}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AttachmentPreview({ att, onRemove }: { att: Attachment; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = att.type.startsWith("image/");
  useEffect(() => {
    let cancelled = false;
    if (!isImage) return;
    (async () => {
      const { data } = await localDataApi.storage
        .from("hari-h-attachments")
        .createSignedUrl(att.path, 300);
      if (!cancelled) setUrl(data?.signedUrl ?? null);
    })();
    return () => { cancelled = true; };
  }, [att.path, isImage]);
  return (
    <div className="flex items-center gap-2 p-2 border rounded-md text-xs">
      {isImage ? (
        url ? (
          <img src={url} alt={att.name} className="h-10 w-10 object-cover rounded shrink-0" />
        ) : (
          <ImageIcon className="h-4 w-4 shrink-0" />
        )
      ) : (
        <FileText className="h-4 w-4 shrink-0" />
      )}
      <span className="truncate flex-1">{att.name}</span>
      <button onClick={onRemove} className="text-destructive hover:opacity-70">
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}
