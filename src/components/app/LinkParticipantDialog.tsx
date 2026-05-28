import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link2, Unlink, Search, CheckCircle2 } from "lucide-react";
import { logAudit } from "@/lib/audit";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidateId: string;
  candidateName: string;
  candidateNrpNip?: string | null;
  currentLinkedUserId?: string | null;
  onChanged?: () => void;
}

type ProfileRow = {
  auth_user_id: string;
  full_name: string;
  email: string | null;
  nrp_nip: string | null;
  roles: string[];
};

export function LinkParticipantDialog({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  candidateNrpNip,
  currentLinkedUserId,
  onChanged,
}: Props) {
  const [query, setQuery] = useState(candidateNrpNip ?? "");
  const [results, setResults] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linkedProfile, setLinkedProfile] = useState<ProfileRow | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery(candidateNrpNip ?? "");
    void loadLinked();
    if (candidateNrpNip) void search(candidateNrpNip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentLinkedUserId]);

  async function loadLinked() {
    if (!currentLinkedUserId) {
      setLinkedProfile(null);
      return;
    }
    const { data: p } = await supabase
      .from("profiles")
      .select("auth_user_id, full_name, email, nrp_nip")
      .eq("auth_user_id", currentLinkedUserId)
      .maybeSingle();
    if (!p) {
      setLinkedProfile(null);
      return;
    }
    const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", currentLinkedUserId);
    setLinkedProfile({ ...(p as any), roles: (r ?? []).map((x: any) => x.role) });
  }

  async function search(q: string) {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      // Only show users with peserta/casis role
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["peserta", "casis"]);
      const eligibleIds = Array.from(new Set((roleRows ?? []).map((r: any) => r.user_id)));
      if (eligibleIds.length === 0) {
        setResults([]);
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("auth_user_id, full_name, email, nrp_nip")
        .in("auth_user_id", eligibleIds)
        .or(`full_name.ilike.%${term}%,email.ilike.%${term}%,nrp_nip.ilike.%${term}%`)
        .limit(20);
      const rolesByUser = new Map<string, string[]>();
      for (const r of roleRows ?? []) {
        const arr = rolesByUser.get((r as any).user_id) ?? [];
        arr.push((r as any).role);
        rolesByUser.set((r as any).user_id, arr);
      }
      setResults(
        (profs ?? []).map((p: any) => ({
          auth_user_id: p.auth_user_id,
          full_name: p.full_name,
          email: p.email,
          nrp_nip: p.nrp_nip,
          roles: rolesByUser.get(p.auth_user_id) ?? [],
        })),
      );
    } finally {
      setLoading(false);
    }
  }

  async function link(userId: string) {
    setSaving(true);
    try {
      // Ensure no other candidate is already linked to this user
      const { data: existing } = await supabase
        .from("candidates")
        .select("id, full_name")
        .eq("linked_user_id", userId)
        .neq("id", candidateId)
        .maybeSingle();
      if (existing) {
        toast.error(`Akun ini sudah tertaut ke peserta lain: ${(existing as any).full_name}`);
        return;
      }
      const { error } = await supabase
        .from("candidates")
        .update({ linked_user_id: userId })
        .eq("id", candidateId);
      if (error) throw error;
      await logAudit({
        action: "link_participant_account",
        module: "candidates",
        record_id: candidateId,
        candidate_id: candidateId,
        after: { linked_user_id: userId } as any,
      });
      toast.success("Akun peserta berhasil ditautkan");
      onChanged?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal menautkan akun");
    } finally {
      setSaving(false);
    }
  }

  async function unlink() {
    if (!confirm("Lepaskan tautan akun peserta dari kandidat ini?")) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("candidates")
        .update({ linked_user_id: null })
        .eq("id", candidateId);
      if (error) throw error;
      await logAudit({
        action: "unlink_participant_account",
        module: "candidates",
        record_id: candidateId,
        candidate_id: candidateId,
      });
      toast.success("Tautan dilepaskan");
      setLinkedProfile(null);
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Gagal melepas tautan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Tautkan Akun Peserta
          </DialogTitle>
          <DialogDescription>
            Hubungkan kandidat <strong>{candidateName}</strong>
            {candidateNrpNip ? <> (NRP/NIP {candidateNrpNip})</> : null} dengan akun login peserta agar
            ia dapat mengisi anamnesis sendiri.
          </DialogDescription>
        </DialogHeader>

        {linkedProfile && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <div className="font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Saat ini tertaut ke: {linkedProfile.full_name}
              </div>
              <div className="text-xs text-muted-foreground">
                {linkedProfile.email ?? "(no email)"} · NRP/NIP: {linkedProfile.nrp_nip ?? "—"}
              </div>
              <div className="flex gap-1 mt-1">
                {linkedProfile.roles.map((r) => (
                  <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>
                ))}
              </div>
            </div>
            <Button size="sm" variant="destructive" onClick={unlink} disabled={saving}>
              <Unlink className="h-3 w-3 mr-1" /> Lepas
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="h-3 w-3 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Cari nama, email, atau NRP/NIP..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search(query)}
                className="pl-8"
              />
            </div>
            <Button onClick={() => search(query)} disabled={loading}>
              {loading ? "Mencari..." : "Cari"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Hanya menampilkan akun dengan role <code>peserta</code> atau <code>casis</code>.
          </p>
        </div>

        <div className="max-h-80 overflow-y-auto rounded-lg border divide-y">
          {results.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {query.trim().length < 2 ? "Ketik minimal 2 karakter untuk mencari." : "Tidak ada akun cocok."}
            </div>
          )}
          {results.map((p) => {
            const isCurrent = p.auth_user_id === currentLinkedUserId;
            const nrpMatch =
              candidateNrpNip && p.nrp_nip && p.nrp_nip.trim() === candidateNrpNip.trim();
            return (
              <div key={p.auth_user_id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">
                    {p.full_name}{" "}
                    {nrpMatch && (
                      <Badge variant="outline" className="ml-1 text-[10px] border-green-500 text-green-700">
                        NRP cocok
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {p.email ?? "(no email)"} · NRP/NIP: {p.nrp_nip ?? "—"}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {p.roles.map((r) => (
                      <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>
                    ))}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent || saving}
                  onClick={() => link(p.auth_user_id)}
                >
                  {isCurrent ? "Sudah tertaut" : (<><Link2 className="h-3 w-3 mr-1" /> Tautkan</>)}
                </Button>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}