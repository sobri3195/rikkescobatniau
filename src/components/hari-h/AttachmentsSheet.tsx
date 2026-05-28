import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Paperclip, Download, ExternalLink, FileText, ImageIcon, Loader2, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { exportAttachmentsZip } from "@/lib/export/attachments-zip";

type Att = { name?: string; path: string; type?: string; size?: number; uploaded_at?: string };
type Row = { status: string | null; updated_at: string | null; attachments_json: Att[] | null };

function isImage(a: Att) {
  const n = (a.name || a.path || "").toLowerCase();
  return /\.(jpe?g|png|webp|gif|bmp|heic)$/.test(n) || (a.type ?? "").startsWith("image/");
}

function StatusBadge({ s }: { s: string | null }) {
  const ok = ["Submitted", "Approved", "Locked", "Cleared"].includes(s ?? "");
  return (
    <Badge variant="outline" className={ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"}>
      {s ?? "Belum Diisi"}
    </Badge>
  );
}

function AttachmentItem({ att }: { att: Att }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function getUrl(): Promise<string | null> {
    if (url) return url;
    setLoading(true);
    const { data, error } = await supabase.storage.from("hari-h-attachments").createSignedUrl(att.path, 300);
    setLoading(false);
    if (error || !data?.signedUrl) {
      toast.error("Gagal membuat link file");
      return null;
    }
    setUrl(data.signedUrl);
    return data.signedUrl;
  }

  useEffect(() => {
    if (isImage(att)) void getUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [att.path]);

  async function open() {
    const u = await getUrl();
    if (u) window.open(u, "_blank", "noopener");
  }
  async function download() {
    const u = await getUrl();
    if (!u) return;
    const a = document.createElement("a");
    a.href = u;
    a.download = att.name || att.path.split("/").pop() || "file";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="border rounded-lg p-2 bg-white flex gap-3">
      <div className="w-20 h-20 shrink-0 rounded bg-slate-100 flex items-center justify-center overflow-hidden">
        {isImage(att) && url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={att.name || "lampiran"} className="w-full h-full object-cover cursor-zoom-in" onClick={open} />
        ) : isImage(att) ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        ) : (
          <FileText className="h-8 w-8 text-slate-400" />
        )}
      </div>
      <div className="flex-1 min-w-0 text-xs space-y-1">
        <div className="font-medium truncate" title={att.name || att.path}>
          {att.name || att.path.split("/").pop()}
        </div>
        <div className="text-muted-foreground">
          {att.size ? `${(att.size / 1024).toFixed(0)} KB` : ""} {att.uploaded_at ? `· ${new Date(att.uploaded_at).toLocaleString("id-ID")}` : ""}
        </div>
        <div className="flex gap-1 pt-1">
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={open} disabled={loading}>
            <ExternalLink className="h-3 w-3 mr-1" /> Buka
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={download} disabled={loading}>
            <Download className="h-3 w-3 mr-1" /> Unduh
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ row, kind }: { row: Row | null; kind: "EKG" | "Rontgen" }) {
  const atts = Array.isArray(row?.attachments_json) ? (row!.attachments_json as Att[]) : [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {kind === "EKG" ? <ImageIcon className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
          <span className="font-medium">{kind}</span>
          <StatusBadge s={row?.status ?? null} />
        </div>
        <span className="text-[11px] text-muted-foreground">{atts.length} file</span>
      </div>
      {atts.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-8 border border-dashed rounded">
          Belum ada lampiran {kind}.
        </div>
      ) : (
        <div className="space-y-2">
          {atts.map((a, i) => <AttachmentItem key={`${a.path}-${i}`} att={a} />)}
        </div>
      )}
    </div>
  );
}

export function AttachmentsSheet({ examId, candidateId, candidateName }: { examId: string; candidateId?: string; candidateName?: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ekg, setEkg] = useState<Row | null>(null);
  const [rad, setRad] = useState<Row | null>(null);
  const [zipping, setZipping] = useState(false);

  async function load() {
    setLoading(true);
    const [e, r] = await Promise.all([
      supabase.from("exam_cardiology").select("status, updated_at, attachments_json").eq("exam_id", examId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("exam_radiology").select("status, updated_at, attachments_json").eq("exam_id", examId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setEkg((e.data as Row) ?? null);
    setRad((r.data as Row) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, examId]);

  const totalCount = (ekg?.attachments_json?.length ?? 0) + (rad?.attachments_json?.length ?? 0);

  async function downloadZip() {
    if (!candidateId) return;
    setZipping(true);
    try {
      const res = await exportAttachmentsZip({ candidateIds: [candidateId], zipName: `lampiran-${candidateName || candidateId}.zip` });
      toast.success(`ZIP siap (${res.succeeded}/${res.total} file)`);
    } catch (e: any) {
      toast.error(e?.message || "Gagal membuat ZIP");
    } finally {
      setZipping(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Paperclip className="h-4 w-4 mr-2" /> Galeri Lampiran
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Galeri Lampiran Hari-H</SheetTitle>
          <SheetDescription className="text-xs">
            {candidateName ? `${candidateName} · ` : ""}EKG & Rontgen — file tersimpan di Lovable Cloud Storage (private).
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">Total {totalCount} lampiran</div>
          <Button size="sm" variant="outline" onClick={downloadZip} disabled={zipping || totalCount === 0 || !candidateId}>
            {zipping ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Package className="h-3 w-3 mr-1" />}
            Unduh ZIP
          </Button>
        </div>

        <Tabs defaultValue="ekg" className="mt-4">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="ekg">EKG ({ekg?.attachments_json?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="rad">Rontgen ({rad?.attachments_json?.length ?? 0})</TabsTrigger>
          </TabsList>
          <TabsContent value="ekg" className="mt-3">
            {loading ? <div className="py-8 text-center text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-1" />Memuat…</div> : <Section row={ekg} kind="EKG" />}
          </TabsContent>
          <TabsContent value="rad" className="mt-3">
            {loading ? <div className="py-8 text-center text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-1" />Memuat…</div> : <Section row={rad} kind="Rontgen" />}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}