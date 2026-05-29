import { useEffect, useRef } from "react";
import { localDataApi } from "@/lib/localDataApi";
import { toast } from "sonner";

type CandSnapshot = {
  id: string;
  full_name: string | null;
  birth_date: string | null;
  nrp_nip: string | null;
};

function normName(s: string | null) {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Listen to candidate INSERT events; whenever a new row matches an existing
 * candidate by (name + dob) or NRP/NIP, surface a toast so registrasi/admin
 * notice the potential duplicate immediately.
 */
export function useRealtimeDuplicateAlerts(opts: { enabled: boolean; onAlert?: () => void }) {
  const cacheRef = useRef<{ byNameDob: Map<string, CandSnapshot>; byNrp: Map<string, CandSnapshot> }>({
    byNameDob: new Map(),
    byNrp: new Map(),
  });
  const lastNotifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!opts.enabled) return;
    let cancelled = false;

    (async () => {
      const { data } = await localDataApi
        .from("candidates")
        .select("id, full_name, birth_date, nrp_nip")
        .is("deleted_at", null)
        .limit(5000);
      if (cancelled || !data) return;
      const { byNameDob, byNrp } = cacheRef.current;
      byNameDob.clear(); byNrp.clear();
      for (const r of data as CandSnapshot[]) {
        if (r.full_name && r.birth_date) byNameDob.set(`${normName(r.full_name)}|${r.birth_date}`, r);
        if (r.nrp_nip) byNrp.set(r.nrp_nip.trim(), r);
      }
    })();

    const channel = localDataApi
      .channel("candidates-duplicate-watch")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "candidates" },
        (payload) => {
          const r = payload.new as CandSnapshot;
          if (!r?.id || lastNotifiedRef.current.has(r.id)) return;

          const { byNameDob, byNrp } = cacheRef.current;
          let matched: { reason: string; other: CandSnapshot } | null = null;

          if (r.full_name && r.birth_date) {
            const key = `${normName(r.full_name)}|${r.birth_date}`;
            const hit = byNameDob.get(key);
            if (hit && hit.id !== r.id) matched = { reason: "Nama + Tgl Lahir sama", other: hit };
            else byNameDob.set(key, r);
          }
          if (!matched && r.nrp_nip) {
            const k = r.nrp_nip.trim();
            const hit = byNrp.get(k);
            if (hit && hit.id !== r.id) matched = { reason: `NRP/NIP sama (${k})`, other: hit };
            else byNrp.set(k, r);
          }

          if (matched) {
            lastNotifiedRef.current.add(r.id);
            toast.warning("Potensi duplikat terdeteksi", {
              description: `${r.full_name ?? "Peserta baru"} — ${matched.reason}. Periksa di "Deteksi Duplikat".`,
              duration: 8000,
              action: opts.onAlert ? { label: "Buka", onClick: () => opts.onAlert?.() } : undefined,
            });
          }
        },
      )
      .subscribe();

    return () => { cancelled = true; localDataApi.removeChannel(channel); };
  }, [opts.enabled, opts.onAlert]);
}