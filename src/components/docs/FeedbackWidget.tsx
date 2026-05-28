import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export function FeedbackWidget({ articleId }: { articleId: string }) {
  const [choice, setChoice] = useState<boolean | null>(null);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(isHelpful: boolean, withText: boolean) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("help_article_feedback").insert({
      article_id: articleId,
      user_id: u.user?.id ?? null,
      is_helpful: isHelpful,
      feedback_text: withText ? text.trim() || null : null,
    });
    if (error) return toast.error(error.message);
    // increment counter (best-effort, no atomic needed here)
    const col = isHelpful ? "helpful_count" : "not_helpful_count";
    const { data: art } = await supabase
      .from("help_articles")
      .select(col)
      .eq("id", articleId)
      .single();
    if (art) {
      const next = ((art as any)[col] ?? 0) + 1;
      const patch = (
        isHelpful ? { helpful_count: next } : { not_helpful_count: next }
      ) as { helpful_count?: number; not_helpful_count?: number };
      await supabase.from("help_articles").update(patch).eq("id", articleId);
    }
    setSent(true);
    toast.success("Terima kasih atas feedback Anda");
    await logAudit({
      action: "submit_help_feedback",
      module: "documentation",
      record_id: articleId,
    });
  }

  if (sent) {
    return (
      <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
        Terima kasih, feedback telah dikirim.
      </div>
    );
  }

  return (
    <div className="rounded-md border p-4 space-y-3 bg-card">
      <div className="text-sm font-medium">Apakah artikel ini berguna?</div>
      {choice === null && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setChoice(true); submit(true, false); }}>
            <ThumbsUp className="h-4 w-4 mr-2" /> Berguna
          </Button>
          <Button variant="outline" size="sm" onClick={() => setChoice(false)}>
            <ThumbsDown className="h-4 w-4 mr-2" /> Tidak Berguna
          </Button>
        </div>
      )}
      {choice === false && (
        <div className="space-y-2">
          <Textarea
            placeholder="Apa yang kurang dari artikel ini?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
          />
          <Button size="sm" onClick={() => submit(false, true)}>Kirim Feedback</Button>
        </div>
      )}
    </div>
  );
}