import { createServerFn } from "@/shims/tanstack-react-start";
import { requireSupabaseAuth } from "@/lib/local-auth-middleware";
import { supabaseAdmin } from "@/lib/local-supabase-shim.server";
import { z } from "zod";

const ALL_ROLES = [
  "super_admin",
  "admin",
  "kepala_sub_tim",
  "dokter",
  "dokter_spesialis",
  "dokter_gigi",
  "radiologi",
  "lab",
  "tester",
  "registrasi",
  "viewer",
] as const;

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["super_admin", "tester"])
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Gagal verifikasi peran");
  if (!data) throw new Error("Hanya Super Admin / Tester yang dapat melakukan aksi ini");
}

async function writeAudit(args: {
  userId: string;
  action: string;
  recordId?: string;
  before?: any;
  after?: any;
}) {
  await supabaseAdmin.from("audit_logs").insert({
    user_id: args.userId,
    action: args.action,
    module: "user_management",
    record_id: args.recordId ?? null,
    before_data: args.before ?? null,
    after_data: args.after ?? null,
  });
}

export const createUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().email().max(255),
        password: z.string().min(8).max(128),
        full_name: z.string().min(1).max(255),
        rank: z.string().max(100).optional().nullable(),
        unit: z.string().max(255).optional().nullable(),
        roles: z.array(z.enum(ALL_ROLES)).min(1).max(11),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message ?? "Gagal membuat akun");
    }
    const newUserId = created.data.user.id;

    // handle_new_user trigger creates a profile + default viewer role. Upsert overrides.
    await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          auth_user_id: newUserId,
          full_name: data.full_name,
          email: data.email,
          rank: data.rank ?? null,
          unit: data.unit ?? null,
          is_active: true,
        },
        { onConflict: "auth_user_id" },
      );

    // Reset roles to requested set
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    await supabaseAdmin
      .from("user_roles")
      .insert(data.roles.map((role) => ({ user_id: newUserId, role })));

    await writeAudit({
      userId: context.userId,
      action: "user.create",
      recordId: newUserId,
      after: { email: data.email, full_name: data.full_name, roles: data.roles },
    });

    return { ok: true, userId: newUserId };
  });

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ authUserId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    if (data.authUserId === context.userId) {
      throw new Error("Tidak dapat menghapus akun sendiri");
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("auth_user_id", data.authUserId)
      .maybeSingle();

    const del = await supabaseAdmin.auth.admin.deleteUser(data.authUserId);
    if (del.error) throw new Error(del.error.message);

    await writeAudit({
      userId: context.userId,
      action: "user.delete",
      recordId: data.authUserId,
      before: profile ?? { auth_user_id: data.authUserId },
    });

    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        authUserId: z.string().uuid(),
        newPassword: z.string().min(8).max(128),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const upd = await supabaseAdmin.auth.admin.updateUserById(data.authUserId, {
      password: data.newPassword,
    });
    if (upd.error) throw new Error(upd.error.message);
    await writeAudit({
      userId: context.userId,
      action: "user.password_reset",
      recordId: data.authUserId,
    });
    return { ok: true };
  });