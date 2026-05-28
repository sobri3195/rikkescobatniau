import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
  userLabel?: string;
}

export function EffectivePermissionsDialog({ open, onOpenChange, userId, userLabel }: Props) {
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [perms, setPerms] = useState<string[]>([]);
  const [wildcard, setWildcard] = useState(false);
  const [sections, setSections] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    void (async () => {
      const [{ data: ur }, { data: assigns }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("user_section_assignments")
          .select("section_key, section_name, can_view, can_create, can_update, can_submit, can_approve, can_upload, can_export, is_active")
          .eq("user_id", userId).eq("is_active", true),
      ]);
      const rs = (ur ?? []).map((r: any) => r.role as string);
      setRoles(rs);
      setSections(assigns ?? []);
      const { data: rp } = await supabase
        .from("role_permissions")
        .select("permission_key, allowed")
        .in("role", rs.length ? (rs as any) : ["viewer"]);
      const list = (rp ?? []).filter((r: any) => r.allowed).map((r: any) => r.permission_key);
      setWildcard(list.includes("*") || rs.includes("super_admin") || rs.includes("tester"));
      setPerms(Array.from(new Set(list.filter((k) => k !== "*"))).sort());
      setLoading(false);
    })();
  }, [open, userId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Effective Permissions</DialogTitle>
          <DialogDescription>
            {userLabel ? <>Akses efektif untuk <b>{userLabel}</b>.</> : "Akses efektif user."}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="py-8 text-center text-sm"><Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Memuat…</div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-auto">
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">Roles</div>
              <div className="flex flex-wrap gap-1">
                {roles.length ? roles.map((r) => <Badge key={r} variant="secondary" className="font-mono text-[10px]">{r}</Badge>)
                  : <span className="text-xs text-muted-foreground">Tidak ada role</span>}
              </div>
            </div>
            {wildcard && (
              <div className="rounded bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
                <b>Wildcard aktif (*).</b> User ini punya akses ke <b>semua</b> permission.
              </div>
            )}
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">Permission Keys ({perms.length})</div>
              <div className="flex flex-wrap gap-1">
                {perms.length ? perms.map((p) => <Badge key={p} variant="outline" className="font-mono text-[10px]">{p}</Badge>)
                  : <span className="text-xs text-muted-foreground">Tidak ada permission</span>}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">Section Assignments ({sections.length})</div>
              {sections.length ? (
                <div className="border rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2">Section</th>
                        <th className="p-2">View</th><th className="p-2">Update</th><th className="p-2">Submit</th>
                        <th className="p-2">Approve</th><th className="p-2">Upload</th><th className="p-2">Export</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sections.map((s: any) => (
                        <tr key={s.section_key} className="border-t">
                          <td className="p-2">{s.section_name ?? s.section_key}</td>
                          {(["can_view","can_update","can_submit","can_approve","can_upload","can_export"] as const).map((k) => (
                            <td key={k} className="p-2 text-center">{s[k] ? "✓" : "—"}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <span className="text-xs text-muted-foreground">Tidak ada assignment khusus</span>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
