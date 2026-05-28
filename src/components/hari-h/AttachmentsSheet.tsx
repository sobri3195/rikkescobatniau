import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Paperclip, FileText, Loader2 } from "lucide-react";
import { getCardiologyByExamIdLocal } from "@/lib/services/cardiologyService";
import { getRadiologyByExamIdLocal } from "@/lib/services/radiologyService";

type Att = { name?: string; path: string; type?: string; size?: number; uploaded_at?: string };
type Row = { status: string | null; updated_at: string | null; attachments_json: Att[] | null };

function StatusBadge({ s }: { s: string | null }) {
  const ok = ["Submitted", "Approved", "Locked", "Cleared"].includes(s ?? "");
  return <Badge variant="outline" className={ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"}>{s ?? "Belum Diisi"}</Badge>;
}

function Section({ row, kind }: { row: Row | null; kind: "EKG" | "Rontgen" }) {
  const atts = Array.isArray(row?.attachments_json) ? (row!.attachments_json as Att[]) : [];
  return <div className="space-y-3"><div className="flex items-center justify-between text-sm"><div className="flex items-center gap-2"><span className="font-medium">{kind}</span><StatusBadge s={row?.status ?? null} /></div><span className="text-[11px] text-muted-foreground">{atts.length} file</span></div>{atts.length===0 ? <div className="text-xs text-muted-foreground text-center py-8 border border-dashed rounded">Belum ada lampiran {kind}.</div> : <div className="space-y-2">{atts.map((a,i)=><div key={`${a.path}-${i}`} className="border rounded-lg p-2 bg-white text-xs"><div className="font-medium truncate">{a.name || a.path.split('/').pop()}</div><div className="text-muted-foreground">{a.size ? `${(a.size / 1024).toFixed(0)} KB` : ""}</div></div>)}</div>}</div>;
}

export function AttachmentsSheet({ examId, candidateName }: { examId: string; candidateId?: string; candidateName?: string }) {
  const [open, setOpen] = useState(false); const [loading, setLoading] = useState(false);
  const [ekg, setEkg] = useState<Row | null>(null); const [rad, setRad] = useState<Row | null>(null);
  async function load() { setLoading(true); setEkg((getCardiologyByExamIdLocal(examId) as Row) ?? null); setRad((getRadiologyByExamIdLocal(examId) as Row) ?? null); setLoading(false); }
  useEffect(() => { if (open) void load(); }, [open, examId]);
  return <Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><Button variant="outline"><Paperclip className="h-4 w-4 mr-2" /> Galeri Lampiran</Button></SheetTrigger><SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto"><SheetHeader><SheetTitle>Galeri Lampiran Hari-H</SheetTitle><SheetDescription className="text-xs">{candidateName ? `${candidateName} · ` : ""}EKG & Rontgen — file tersimpan di localDb.</SheetDescription></SheetHeader><Tabs defaultValue="ekg" className="mt-4"><TabsList className="grid grid-cols-2 w-full"><TabsTrigger value="ekg">EKG ({ekg?.attachments_json?.length ?? 0})</TabsTrigger><TabsTrigger value="rad">Rontgen ({rad?.attachments_json?.length ?? 0})</TabsTrigger></TabsList><TabsContent value="ekg" className="mt-3">{loading ? <div className="py-8 text-center text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-1" />Memuat…</div> : <Section row={ekg} kind="EKG" />}</TabsContent><TabsContent value="rad" className="mt-3">{loading ? <div className="py-8 text-center text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-1" />Memuat…</div> : <Section row={rad} kind="Rontgen" />}</TabsContent></Tabs></SheetContent></Sheet>;
}
