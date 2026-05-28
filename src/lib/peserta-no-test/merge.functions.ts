import { createServerFn } from "@/shims/tanstack-react-start";
import { z } from "zod";
import { requireLocalAuth } from "@/lib/local-auth-middleware";
import { localAdminApi } from "@/lib/localDataApi.server";

const MergeInput = z.object({
  winnerId: z.string().uuid(),
  loserId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
  patch: z
    .object({
      full_name: z.string().trim().min(1).max(255).optional(),
      nrp_nip: z.string().trim().max(64).nullable().optional(),
      birth_date: z.string().trim().max(32).nullable().optional(),
      birth_place: z.string().trim().max(255).nullable().optional(),
      rank: z.string().trim().max(64).nullable().optional(),
      unit_position: z.string().trim().max(255).nullable().optional(),
      pok_korp: z.string().trim().max(64).nullable().optional(),
      panda: z.string().trim().max(64).nullable().optional(),
      phone: z.string().trim().max(64).nullable().optional(),
      address: z.string().trim().max(500).nullable().optional(),
    })
    .partial()
    .optional(),
});

export const mergeCandidates = createServerFn({ method: "POST" })
  .middleware([requireLocalAuth])
  .inputValidator((input) => MergeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (data.winnerId === data.loserId) {
      throw new Error("Pemenang dan loser tidak boleh sama");
    }
    // Verify role via service-role client
    const { data: roles, error: rolesErr } = await localAdminApi
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (rolesErr) throw new Error(rolesErr.message);
    const allowed = (roles ?? []).some((r) => ["super_admin", "admin"].includes(String(r.role)));
    if (!allowed) throw new Error("Hanya admin/super_admin yang bisa merge");

    const [{ data: winner }, { data: loser }] = await Promise.all([
      localAdminApi.from("candidates").select("*").eq("id", data.winnerId).single(),
      localAdminApi.from("candidates").select("*").eq("id", data.loserId).single(),
    ]);
    if (!winner || !loser) throw new Error("Salah satu peserta tidak ditemukan");
    if (winner.deleted_at) throw new Error("Pemenang sudah terhapus");
    if (loser.deleted_at) throw new Error("Loser sudah terhapus");

    // Apply patch to winner (only non-empty fields)
    const patch = data.patch ?? {};
    const cleanPatch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      cleanPatch[k] = v;
    }
    let winnerAfter = winner;
    if (Object.keys(cleanPatch).length > 0) {
      const { data: upd, error: updErr } = await localAdminApi
        .from("candidates")
        .update(cleanPatch as never)
        .eq("id", data.winnerId)
        .select("*")
        .single();
      if (updErr) throw new Error(updErr.message);
      winnerAfter = upd ?? winner;
    }

    // Soft-delete loser
    const { error: delErr } = await localAdminApi
      .from("candidates")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        delete_reason: `Merged into ${data.winnerId} — ${data.reason}`,
      })
      .eq("id", data.loserId);
    if (delErr) throw new Error(delErr.message);

    // Log to candidate_merge_logs
    const { error: logErr } = await localAdminApi.from("candidate_merge_logs").insert({
      primary_candidate_id: data.winnerId,
      duplicate_candidate_id: data.loserId,
      merged_by: userId,
      merge_reason: data.reason,
      before_data: { winner, loser },
      after_data: { winner: winnerAfter },
    });
    if (logErr) throw new Error(logErr.message);

    // App-level audit
    await localAdminApi.from("audit_logs").insert({
      user_id: userId,
      action: "merge_candidates",
      module: "peserta_tanpa_no_test",
      record_id: data.winnerId,
      candidate_id: data.winnerId,
      before_data: { winner, loser },
      after_data: { winner: winnerAfter, loser_soft_deleted: true },
    });

    return { ok: true, winnerId: data.winnerId, loserId: data.loserId };
  });
