import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/local-supabase-shim";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Rocket } from "lucide-react";
import { AckButton } from "@/components/docs/AckButton";

export const Route = createFileRoute("/_authenticated/release-notes")({
  component: ReleaseNotesPage,
});

function ReleaseNotesPage() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("release_notes")
        .select("*")
        .eq("status", "Published")
        .order("release_date", { ascending: false });
      setItems(data ?? []);
    })();
  }, []);
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Rocket className="h-6 w-6"/> Release Notes</h1>
      <p className="text-sm text-muted-foreground">Riwayat versi & perubahan sistem RIKKES.</p>
      <div className="space-y-3">
        {items.map((r) => {
          const ch = (r.changes_json ?? {}) as any;
          return (
            <Card key={r.id}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge>{r.version}</Badge>
                  <span className="text-xs text-muted-foreground">{r.release_date}</span>
                </div>
                <div className="text-lg font-semibold">{r.title}</div>
                {r.summary && <p className="text-sm text-muted-foreground">{r.summary}</p>}
                {Array.isArray(ch.new_features) && ch.new_features.length > 0 && (
                  <Section title="Fitur Baru" items={ch.new_features} />
                )}
                {Array.isArray(ch.improvements) && ch.improvements.length > 0 && (
                  <Section title="Peningkatan" items={ch.improvements} />
                )}
                {Array.isArray(ch.bug_fixes) && ch.bug_fixes.length > 0 && (
                  <Section title="Bug Fix" items={ch.bug_fixes} />
                )}
                {Array.isArray(ch.breaking_changes) && ch.breaking_changes.length > 0 && (
                  <Section title="Breaking Changes" items={ch.breaking_changes} />
                )}
                {Array.isArray(r.known_issues_json) && r.known_issues_json.length > 0 && (
                  <Section title="Known Issues" items={r.known_issues_json} />
                )}
                <AckButton
                  documentType="release_note"
                  documentId={r.id}
                  documentCode={r.version}
                  label="Tandai sudah dibaca"
                  auditAction="mark_release_note_read"
                />
              </CardContent>
            </Card>
          );
        })}
        {items.length === 0 && (
          <div className="text-sm text-muted-foreground p-8 text-center border rounded-md">Belum ada release note.</div>
        )}
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-sm font-semibold mb-1">{title}</div>
      <ul className="text-sm list-disc list-inside space-y-0.5 text-muted-foreground">
        {items.map((i, idx) => <li key={idx}>{i}</li>)}
      </ul>
    </div>
  );
}