import { useState } from "react";
import { supabase } from "@/lib/local-supabase-shim";
import { Button } from "@/components/ui/button";
import { Upload, X, FileCheck } from "lucide-react";
import { toast } from "sonner";

export function EvidenceUploader({
  value,
  onChange,
  folder = "general",
}: {
  value?: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const path = `${u.user?.id ?? "anon"}/${folder}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from("qa-evidence")
        .upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("qa-evidence").getPublicUrl(path);
      // Bucket is private; use signed URL
      const { data: signed } = await supabase.storage
        .from("qa-evidence")
        .createSignedUrl(path, 60 * 60 * 24 * 30);
      onChange(signed?.signedUrl ?? data.publicUrl);
      toast.success("Evidence terupload");
    } catch (err: any) {
      toast.error(err.message ?? "Upload gagal");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <FileCheck className="h-4 w-4 text-green-600" />
        <a href={value} target="_blank" rel="noreferrer" className="underline truncate max-w-xs">
          Evidence terlampir
        </a>
        <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <label className="inline-flex items-center gap-2 text-xs cursor-pointer text-muted-foreground hover:text-foreground">
      <input type="file" className="hidden" onChange={handleFile} disabled={uploading} />
      <Upload className="h-4 w-4" />
      {uploading ? "Uploading..." : "Upload evidence"}
    </label>
  );
}