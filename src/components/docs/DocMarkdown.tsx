import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function DocMarkdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:leading-relaxed prose-li:my-1 prose-table:text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children || ""}</ReactMarkdown>
    </div>
  );
}