import { createServerFn } from "@/shims/tanstack-react-start";
import { z } from "zod";
import { requireLocalAuth } from "@/lib/local-auth-middleware";
import { localAdminApi } from "@/lib/localDataApi.server";

const STORAGE_BUCKETS = ["hari-h-attachments", "qa-evidence"] as const;

function extractStoragePath(url: string, bucket: string): string | null {
  if (!url) return null;
  // Match localDataApi public/sign URLs: /storage/v1/object/(public|sign)/<bucket>/<path>
  const re = new RegExp(`/storage/v1/object/(?:public|sign|authenticated)/${bucket}/([^?#]+)`);
  const m = url.match(re);
  if (m) return decodeURIComponent(m[1]);
  // Raw key (no scheme)
  if (!/^https?:\/\//i.test(url) && url.startsWith(`${bucket}/`)) {
    return url.slice(bucket.length + 1);
  }
  return null;
}

export const deletePersonnel = createServerFn({ method: "POST" })
  .middleware([requireLocalAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        candidateId: z.string().uuid(),
        reason: z.string().trim().min(3).max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { localDataApi, userId } = context;

    // Server-side role enforcement (defense in depth — RPC also checks).
    const { data: rolesData, error: roleErr } = await localDataApi
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (roleErr) throw new Error(roleErr.message);
    const roles = (rolesData ?? []).map((r: any) => r.role as string);
    if (!roles.includes("super_admin") && !roles.includes("tester")) {
      throw new Error("Hanya super_admin yang dapat menghapus peserta secara permanen");
    }

    // Collect storage paths BEFORE deletion (best-effort).
    const storagePaths: Record<string, string[]> = {};
    for (const bucket of STORAGE_BUCKETS) storagePaths[bucket] = [];

    const [{ data: atts }, { data: exps }] = await Promise.all([
      localAdminApi
        .from("medical_attachments")
        .select("file_url")
        .eq("candidate_id", data.candidateId),
      localAdminApi
        .from("document_exports")
        .select("file_url")
        .eq("candidate_id", data.candidateId),
    ]);
    for (const row of [...(atts ?? []), ...(exps ?? [])]) {
      const url = (row as any).file_url as string | null;
      if (!url) continue;
      for (const bucket of STORAGE_BUCKETS) {
        const path = extractStoragePath(url, bucket);
        if (path) storagePaths[bucket].push(path);
      }
    }

    // Atomic DB delete via SECURITY DEFINER RPC (also re-checks role + writes audit).
    const { data: rpcRes, error: rpcErr } = await localDataApi.rpc("delete_personnel_cascade", {
      _candidate_id: data.candidateId,
      _reason: data.reason,
    });
    if (rpcErr) throw new Error(rpcErr.message);

    // Best-effort storage cleanup (after DB commit).
    const storageResult: Record<string, { removed: number; error?: string }> = {};
    for (const bucket of STORAGE_BUCKETS) {
      const paths = Array.from(new Set(storagePaths[bucket]));
      if (paths.length === 0) continue;
      const { error: stErr } = await localAdminApi.storage.from(bucket).remove(paths);
      storageResult[bucket] = stErr
        ? { removed: 0, error: stErr.message }
        : { removed: paths.length };
    }

    return { ok: true, rpc: rpcRes, storage: storageResult };
  });
