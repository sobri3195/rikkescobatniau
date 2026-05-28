import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/local-supabase-shim";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import { DocMarkdown } from "@/components/docs/DocMarkdown";
import { AckButton } from "@/components/docs/AckButton";

export const Route = createFileRoute("/_authenticated/sop/$id")({
  component: SOPDetail,
});

function SOPDetail() {
  const { id } = useParams({ from: "/_authenticated/sop/$id" });
  const [s, setS] = useState<any>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("sop_documents").select("*").eq("id", id).maybeSingle();
      setS(data);
    })();
  }, [id]);
  if (!s) return <div className="p-6 text-muted-foreground">Memuat…</div>;
  const checklist: Array<{ label: string }> = Array.isArray(s.checklist_json) ? s.checklist_json : [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <Link to="/sop" className="text-sm text-muted-foreground inline-flex items-center hover:text-primary">
        <ChevronLeft className="h-4 w-4 mr-1" /> Kembali ke SOP
      </Link>
      <div className="flex items-center gap-2">
        <Badge variant="outline">{s.sop_code}</Badge>
        <Badge variant="secondary">{s.category}</Badge>
        <Badge variant={s.status === "Published" ? "default" : "outline"}>{s.status}</Badge>
        <span className="text-xs text-muted-foreground">v{s.version}</span>
      </div>
      <h1 className="text-3xl font-bold">{s.title}</h1>

      <Card><CardContent className="p-5 space-y-3 text-sm">
        {s.objective && (<div><div className="font-semibold mb-1">Tujuan</div><div>{s.objective}</div></div>)}
        {s.scope && (<div><div className="font-semibold mb-1">Ruang Lingkup</div><div>{s.scope}</div></div>)}
        {s.prerequisites && (<div><div className="font-semibold mb-1">Prasyarat</div><div>{s.prerequisites}</div></div>)}
      </CardContent></Card>

      <Card><CardContent className="p-5">
        <div className="font-semibold mb-2">Langkah Kerja</div>
        <DocMarkdown>{s.procedure_markdown}</DocMarkdown>
      </CardContent></Card>

      {checklist.length > 0 && (
        <Card><CardContent className="p-5">
          <div className="font-semibold mb-2">Checklist</div>
          <ul className="space-y-1 text-sm">
            {checklist.map((c, i) => (
              <li key={i} className="flex gap-2"><span className="text-muted-foreground">☐</span>{c.label}</li>
            ))}
          </ul>
        </CardContent></Card>
      )}

      <div className="grid md:grid-cols-3 gap-3 text-sm">
        {s.expected_output && <Card><CardContent className="p-4"><div className="font-semibold mb-1">Output</div><div className="text-muted-foreground">{s.expected_output}</div></CardContent></Card>}
        {s.troubleshooting && <Card><CardContent className="p-4"><div className="font-semibold mb-1">Troubleshooting</div><div className="text-muted-foreground whitespace-pre-line">{s.troubleshooting}</div></CardContent></Card>}
        {s.security_notes && <Card><CardContent className="p-4"><div className="font-semibold mb-1">Catatan Keamanan</div><div className="text-muted-foreground">{s.security_notes}</div></CardContent></Card>}
      </div>

      <AckButton
        documentType="sop"
        documentId={s.id}
        documentCode={s.sop_code}
        version={s.version}
        label="Saya telah membaca dan memahami SOP ini"
        auditAction="acknowledge_sop"
      />
    </div>
  );
}