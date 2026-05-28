import { useEffect, useState } from "react";
import { supabase } from "@/lib/local-supabase-shim";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ASSIGNABLE_SECTIONS, SECTION_ACTIONS } from "@/lib/permissions/keys";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { clearPermissionCache } from "@/lib/permissions/use-permissions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
  userLabel?: string;
  onSaved?: () => void;
}

type Row = Record<string, Record<string, boolean>>;

export function SectionAssignmentDialog({ open, onOpenChange, userId, userLabel, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<Row>({});

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    void (async () => {
      const { data } = await supabase
        .from("user_section_assignments")
        .select("section_key, can_view, can_create, can_update, can_submit, can_approve, can_request_revision, can_upload, can_export, is_active")
        .eq("user_id", userId);
      const m: Row = {};
      (data ?? []).forEach((r: any) => {
        if (!r.is_active) return;
        m[r.section_key] = {
          view: !!r.can_view, create: !!r.can_create, update: !!r.can_update,
          submit: !!r.can_submit, approve: !!r.can_approve, request_revision: !!r.can_request_revision,
          upload: !!r.can_upload, export: !!r.can_export,
        };
      });
      setState(m);
      setLoading(false);
    })();
  }, [open, userId]);

  function toggle(section: string, action: string) {
    setState((prev) => {
      const row = { ...(prev[section] ?? {}) };
      row[action] = !row[action];
      if (action !== "view" && row[action]) row.view = true; // auto-enable view
      return { ...prev, [section]: row };
    });
  }

  async function save() {
    if (!userId) return;
    setSaving(true);
    try {
      // Wipe + reinsert (simpler than diff)
      await supabase.from("user_section_assignments").delete().eq("user_id", userId);
      const payload = Object.entries(state)
        .filter(([, actions]) => Object.values(actions).some(Boolean))
        .map(([section_key, a]) => {
          const sec = ASSIGNABLE_SECTIONS.find((s) => s.key === section_key);
          return {
            user_id: userId,
            section_key,
            section_name: sec?.name ?? section_key,
            can_view: !!a.view, can_create: !!a.create, can_update: !!a.update,
            can_submit: !!a.submit, can_approve: !!a.approve, can_request_revision: !!a.request_revision,
            can_upload: !!a.upload, can_export: !!a.export,
            is_active: true,
          };
        });
      if (payload.length) {
        const { error } = await supabase.from("user_section_assignments").insert(payload);
        if (error) throw error;
      }
      await supabase.from("audit_logs").insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        action: "update_user_section_assignment",
        module: "user_management",
        record_id: userId,
        after_data: payload as any,
      });
      clearPermissionCache();
      toast.success("Assignment section disimpan");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Assignment Section</DialogTitle>
          <DialogDescription>
            {userLabel ? <>Atur akses per section untuk <b>{userLabel}</b>.</> : "Atur akses per section."}
            {" "}Menyalakan <b>create/update/submit/dst</b> otomatis ikut menyalakan <b>view</b>.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Memuat…
          </div>
        ) : (
          <div className="overflow-auto max-h-[60vh] border rounded">
            <table className="text-xs w-full">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-medium">Section</th>
                  {SECTION_ACTIONS.map((a) => (
                    <th key={a} className="p-2 font-medium capitalize">{a.replace("_", " ")}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ASSIGNABLE_SECTIONS.map((s) => (
                  <tr key={s.key} className="border-t hover:bg-muted/20">
                    <td className="p-2">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{s.key}</div>
                    </td>
                    {SECTION_ACTIONS.map((a) => (
                      <td key={a} className="p-2 text-center">
                        <Checkbox
                          checked={!!state[s.key]?.[a]}
                          onCheckedChange={() => toggle(s.key, a)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
