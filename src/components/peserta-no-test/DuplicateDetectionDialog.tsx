import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, GitMerge, Users, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { mergeCandidates } from "@/lib/peserta-no-test/merge.functions";

type CandRow = {
  id: string;
  full_name: string;
  nrp_nip: string | null;
  birth_date: string | null;
  test_number: string | null;
  temporary_id: string | null;
  rank: string | null;
  unit_position: string | null;
};

type Group = { key: string; reason: string; members: CandRow[] };

function normName(s: string | null): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function DuplicateDetectionDialog({
  open,
  onOpenChange,
  onMerged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onMerged: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CandRow[]>([]);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [loserId, setLoserId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const merge = useServerFn(mergeCandidates);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("candidates")
      .select("id, full_name, nrp_nip, birth_date, test_number, temporary_id, rank, unit_position")
      .is("deleted_at", null)
      .limit(2000)
      .then(({ data }) => {
        setRows((data ?? []) as CandRow[]);
        setLoading(false);
      });
  }, [open]);

  const groups = useMemo<Group[]>(() => {
    const byNameDob = new Map<string, CandRow[]>();
    const byNrp = new Map<string, CandRow[]>();
    for (const r of rows) {
      const nameKey = `${normName(r.full_name)}|${r.birth_date ?? ""}`;
      if (normName(r.full_name) && r.birth_date) {
        const arr = byNameDob.get(nameKey) ?? [];
        arr.push(r);
        byNameDob.set(nameKey, arr);
      }
      const nrp = (r.nrp_nip ?? "").trim();
      if (nrp) {
        const arr = byNrp.get(nrp) ?? [];
        arr.push(r);
        byNrp.set(nrp, arr);
      }
    }
    const out: Group[] = [];
    byNameDob.forEach((members, key) => {
      if (members.length > 1)
        out.push({ key: `name:${key}`, reason: "Nama + Tgl Lahir sama", members });
    });
    byNrp.forEach((members, key) => {
      if (members.length > 1)
        out.push({ key: `nrp:${key}`, reason: `NRP/NIP sama (${key})`, members });
    });
    return out.sort((a, b) => b.members.length - a.members.length);
  }, [rows]);

  const activeGroup = useMemo(() => {
    if (!winnerId && !loserId) return null;
    return groups.find((g) =>
      g.members.some((m) => m.id === winnerId) ||
      g.members.some((m) => m.id === loserId),
    ) ?? null;
  }, [groups, winnerId, loserId]);

  async function doMerge() {
    if (!winnerId || !loserId) { toast.error("Pilih pemenang dan duplikat"); return; }
    if (winnerId === loserId) { toast.error("Pilih dua peserta berbeda"); return; }
    if (reason.trim().length < 3) { toast.error("Alasan merge wajib diisi"); return; }
    setBusy(true);
    try {
      await merge({ data: { winnerId, loserId, reason: reason.trim() } });
      toast.success("Merge berhasil — loser di-soft-delete & dicatat di audit");
      setWinnerId(null); setLoserId(null); setReason("");
      onMerged();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal merge");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Potensi Duplikasi Peserta
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="p-8 text-center text-slate-500">
            <Loader2 className="h-5 w-5 inline animate-spin mr-2" />Memuat…
          </div>
        ) : groups.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            Tidak ditemukan kandidat duplikat (berdasar Nama+Tgl Lahir atau NRP/NIP).
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-xs flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              <AlertTriangle className="h-4 w-4" />
              Ditemukan {groups.length} grup potensi duplikasi. Pilih satu pemenang (winner) dan satu duplikat (loser).
            </div>
            <div className="space-y-3">
              {groups.slice(0, 20).map((g) => (
                <div key={g.key} className="border rounded-lg p-3 bg-white">
                  <div className="text-xs font-semibold text-slate-700 mb-2">
                    {g.reason} <Badge variant="outline" className="ml-2">{g.members.length} peserta</Badge>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="text-left">Nama</th>
                        <th className="text-left">NRP/NIP</th>
                        <th className="text-left">Tgl Lahir</th>
                        <th className="text-left">No Test / TMP</th>
                        <th className="text-left">Satuan</th>
                        <th className="text-center w-20">Winner</th>
                        <th className="text-center w-20">Loser</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.members.map((m) => (
                        <tr key={m.id} className="border-t">
                          <td className="py-1">{m.full_name}</td>
                          <td>{m.nrp_nip ?? "—"}</td>
                          <td>{m.birth_date ?? "—"}</td>
                          <td className="font-mono">{m.test_number ?? m.temporary_id ?? "—"}</td>
                          <td>{m.unit_position ?? "—"}</td>
                          <td className="text-center">
                            <input
                              type="radio"
                              name={`winner-${g.key}`}
                              checked={winnerId === m.id}
                              onChange={() => { setWinnerId(m.id); if (loserId === m.id) setLoserId(null); }}
                            />
                          </td>
                          <td className="text-center">
                            <input
                              type="radio"
                              name={`loser-${g.key}`}
                              checked={loserId === m.id}
                              onChange={() => { setLoserId(m.id); if (winnerId === m.id) setWinnerId(null); }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              {groups.length > 20 && (
                <div className="text-xs text-slate-500">Menampilkan 20 grup pertama dari {groups.length}.</div>
              )}
            </div>

            {(winnerId || loserId) && activeGroup && (
              <div className="border rounded-lg p-3 bg-slate-50 space-y-2">
                {winnerId && loserId && (() => {
                  const w = activeGroup.members.find((m) => m.id === winnerId);
                  const l = activeGroup.members.find((m) => m.id === loserId);
                  if (!w || !l) return null;
                  const fields: { k: keyof CandRow; label: string }[] = [
                    { k: "full_name", label: "Nama" },
                    { k: "nrp_nip", label: "NRP/NIP" },
                    { k: "birth_date", label: "Tgl Lahir" },
                    { k: "rank", label: "Pangkat" },
                    { k: "unit_position", label: "Satuan" },
                    { k: "test_number", label: "No Test" },
                    { k: "temporary_id", label: "TMP ID" },
                  ];
                  return (
                    <div className="rounded border border-slate-200 bg-white overflow-hidden">
                      <div className="px-2 py-1 text-[11px] font-semibold bg-slate-100 text-slate-700">
                        Preview Diff (Winner akan dipertahankan, Loser akan di-soft-delete)
                      </div>
                      <table className="w-full text-xs">
                        <thead className="text-slate-500">
                          <tr>
                            <th className="text-left px-2 py-1 w-28">Field</th>
                            <th className="text-left px-2 py-1 bg-emerald-50">Winner (kept)</th>
                            <th className="text-left px-2 py-1 bg-rose-50">Loser (deleted)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fields.map((f) => {
                            const wv = (w[f.k] ?? "") as string;
                            const lv = (l[f.k] ?? "") as string;
                            const diff = String(wv) !== String(lv);
                            return (
                              <tr key={f.k as string} className={`border-t ${diff ? "bg-amber-50/60" : ""}`}>
                                <td className="px-2 py-1 font-medium text-slate-600">{f.label}</td>
                                <td className="px-2 py-1">{wv || <span className="text-slate-400">—</span>}</td>
                                <td className="px-2 py-1">{lv || <span className="text-slate-400">—</span>}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div className="px-2 py-1 text-[10px] text-slate-500 bg-slate-50 border-t">
                        Baris kuning = nilai berbeda. Field kosong di winner akan otomatis diisi dari loser oleh server fn.
                      </div>
                    </div>
                  );
                })()}
                <Label className="text-xs">Alasan merge (wajib, masuk audit log)</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Contoh: Duplikat input registrasi ganda — data dokter pendamping konfirmasi 1 orang."
                  maxLength={500}
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Tutup</Button>
          <Button onClick={doMerge} disabled={busy || !winnerId || !loserId}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <GitMerge className="h-4 w-4 mr-2" />}
            Gabungkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}