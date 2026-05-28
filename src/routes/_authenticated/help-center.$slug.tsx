import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { localDataApi } from "@/lib/localDataApi";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import { DocMarkdown } from "@/components/docs/DocMarkdown";
import { FeedbackWidget } from "@/components/docs/FeedbackWidget";
import { AckButton } from "@/components/docs/AckButton";

export const Route = createFileRoute("/_authenticated/help-center/$slug")({
  component: ArticlePage,
});

function ArticlePage() {
  const { slug } = useParams({ from: "/_authenticated/help-center/$slug" });
  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await localDataApi
        .from("help_articles")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      setArticle(data);
      setLoading(false);
    })();
  }, [slug]);

  if (loading) return <div className="p-6 text-muted-foreground">Memuat…</div>;
  if (!article) return <div className="p-6">Artikel tidak ditemukan.</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <Link to="/help-center" className="text-sm text-muted-foreground inline-flex items-center hover:text-primary">
        <ChevronLeft className="h-4 w-4 mr-1" /> Kembali ke Help Center
      </Link>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{article.category}</Badge>
          <Badge variant={article.status === "Published" ? "default" : "secondary"}>{article.status}</Badge>
          <span className="text-xs text-muted-foreground">v{article.version}</span>
        </div>
        <h1 className="text-3xl font-bold">{article.title}</h1>
        {article.summary && (
          <p className="text-muted-foreground">{article.summary}</p>
        )}
      </div>
      <Card>
        <CardContent className="p-6">
          <DocMarkdown>{article.content_markdown}</DocMarkdown>
        </CardContent>
      </Card>
      <FeedbackWidget articleId={article.id} />
      <AckButton
        documentType="help_article"
        documentId={article.id}
        version={article.version}
        label="Saya telah membaca artikel ini"
      />
    </div>
  );
}