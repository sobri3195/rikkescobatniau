import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { localDataApi } from "@/lib/localDataApi";
import { useAuth } from "@/lib/use-auth";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Search, ThumbsUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/help-center")({
  component: HelpCenterPage,
});

type Article = {
  id: string;
  title: string;
  slug: string;
  category: string;
  summary: string | null;
  tags_json: string[];
  status: string;
  role_visibility_json: string[];
  helpful_count: number;
  updated_at: string;
};

function HelpCenterPage() {
  const { roles } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const { data } = await localDataApi
        .from("help_articles")
        .select("id,title,slug,category,summary,tags_json,status,role_visibility_json,helpful_count,updated_at")
        .eq("status", "Published")
        .order("category", { ascending: true });
      setArticles((data as any) ?? []);
    })();
  }, []);

  const visible = useMemo(() => {
    const role = roles[0] ?? "viewer";
    return articles.filter((a) => {
      const vis = Array.isArray(a.role_visibility_json) ? a.role_visibility_json : [];
      if (!vis.includes(role) && !roles.includes("super_admin")) return false;
      if (cat !== "all" && a.category !== cat) return false;
      const needle = q.trim().toLowerCase();
      if (!needle) return true;
      return (
        a.title.toLowerCase().includes(needle) ||
        (a.summary ?? "").toLowerCase().includes(needle) ||
        (a.tags_json ?? []).some((t) => String(t).toLowerCase().includes(needle))
      );
    });
  }, [articles, q, cat, roles]);

  const categories = useMemo(
    () => Array.from(new Set(articles.map((a) => a.category))).sort(),
    [articles],
  );

  const popular = useMemo(
    () => [...visible].sort((a, b) => b.helpful_count - a.helpful_count).slice(0, 5),
    [visible],
  );

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" /> Help Center
        </h1>
        <p className="text-sm text-muted-foreground">
          Dokumentasi, panduan, dan jawaban pertanyaan umum sistem RIKKES.
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari dokumentasi…"
            className="pl-9"
          />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {popular.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-semibold mb-2 flex items-center gap-2">
              <ThumbsUp className="h-4 w-4" /> Artikel Populer
            </div>
            <div className="flex flex-wrap gap-2">
              {popular.map((a) => (
                <Link key={a.id} to="/help-center/$slug" params={{ slug: a.slug }} className="text-sm px-3 py-1 rounded-full bg-primary/10 hover:bg-primary/20">
                  {a.title}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {visible.map((a) => (
          <Link key={a.id} to="/help-center/$slug" params={{ slug: a.slug }}>
            <Card className="hover:border-primary transition cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{a.category}</Badge>
                      {(a.tags_json ?? []).slice(0, 3).map((t) => (
                        <Badge key={String(t)} variant="secondary" className="text-[10px]">{String(t)}</Badge>
                      ))}
                    </div>
                    <div className="font-semibold">{a.title}</div>
                    {a.summary && (
                      <div className="text-sm text-muted-foreground line-clamp-2 mt-1">{a.summary}</div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    👍 {a.helpful_count}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {visible.length === 0 && (
          <div className="text-sm text-muted-foreground p-8 text-center border rounded-md">
            Tidak ada artikel yang cocok.
          </div>
        )}
      </div>
    </div>
  );
}