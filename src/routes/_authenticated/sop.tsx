import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { localDataApi } from "@/lib/localDataApi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sop")({
  component: SOPListPage,
});

function SOPListPage() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await localDataApi
        .from("sop_documents")
        .select("id,sop_code,title,category,status,version,effective_date,objective")
        .order("sop_code");
      setItems(data ?? []);
    })();
  }, []);
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><ScrollText className="h-6 w-6"/> SOP Operasional</h1>
      <p className="text-sm text-muted-foreground">Standar prosedur operasional sistem RIKKES.</p>
      <div className="grid gap-3">
        {items.map((s) => (
          <Link key={s.id} to="/sop/$id" params={{ id: s.id }}>
            <Card className="hover:border-primary transition cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline">{s.sop_code}</Badge>
                  <Badge variant="secondary">{s.category}</Badge>
                  <Badge variant={s.status === "Published" ? "default" : "outline"}>{s.status}</Badge>
                  <span className="text-xs text-muted-foreground">v{s.version}</span>
                </div>
                <div className="font-semibold">{s.title}</div>
                {s.objective && <div className="text-sm text-muted-foreground line-clamp-2 mt-1">{s.objective}</div>}
              </CardContent>
            </Card>
          </Link>
        ))}
        {items.length === 0 && <div className="text-sm text-muted-foreground p-8 text-center border rounded-md">Belum ada SOP.</div>}
      </div>
    </div>
  );
}