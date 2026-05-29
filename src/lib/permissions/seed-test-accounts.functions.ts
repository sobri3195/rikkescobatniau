import { createServerFn } from "@/shims/tanstack-react-start";
import { requireLocalAuth } from "@/lib/local-auth-middleware";
import { localAdminApi } from "@/lib/localDataApi.server";

const ACCOUNTS: {
  email: string;
  password: string;
  full_name: string;
  roles: string[];
  sections?: { key: string; name: string; actions: string[] }[];
}[] = [
  {
    email: "tester@rikkes.test",
    password: "Tester#2026!",
    full_name: "Tester QA",
    roles: ["tester", "super_admin"],
  },
  {
    email: "admin@rikkes.test",
    password: "Admin#2026!",
    full_name: "Admin Operasional",
    roles: ["admin"],
  },
  {
    email: "kepala@rikkes.test",
    password: "Kepala#2026!",
    full_name: "Kepala Sub Tim",
    roles: ["kepala_sub_tim"],
  },
  {
    email: "registrasi@rikkes.test",
    password: "Registrasi#2026!",
    full_name: "Tim Registrasi",
    roles: ["registrasi"],
  },
  {
    email: "dokter@rikkes.test",
    password: "Dokter#2026!",
    full_name: "Dokter Umum",
    roles: ["dokter"],
  },
  {
    email: "spesialis@rikkes.test",
    password: "Spesialis#2026!",
    full_name: "Dokter Spesialis Umum",
    roles: ["dokter_spesialis", "dokter"],
  },
  {
    email: "tht@rikkes.test",
    password: "Tht#2026!",
    full_name: "Subtim THT",
    roles: ["dokter_spesialis", "dokter"],
    sections: [{ key: "tht", name: "THT", actions: ["view", "update", "submit", "upload"] }],
  },
  {
    email: "mata@rikkes.test",
    password: "Mata#2026!",
    full_name: "Subtim Mata",
    roles: ["dokter_spesialis", "dokter"],
    sections: [
      { key: "mata_umum", name: "Mata Umum", actions: ["view", "update", "submit"] },
      { key: "mata_visus", name: "Mata Lihat/Visus", actions: ["view", "update", "submit"] },
    ],
  },
  {
    email: "bedah@rikkes.test",
    password: "Bedah#2026!",
    full_name: "Subtim Bedah",
    roles: ["dokter_spesialis", "dokter"],
    sections: [{ key: "bedah", name: "Bedah", actions: ["view", "update", "submit"] }],
  },
  {
    email: "neuro@rikkes.test",
    password: "Neuro#2026!",
    full_name: "Subtim Neurologi",
    roles: ["dokter_spesialis", "dokter"],
    sections: [{ key: "neurologi", name: "Neurologi", actions: ["view", "update", "submit"] }],
  },
  {
    email: "jantung@rikkes.test",
    password: "Jantung#2026!",
    full_name: "Subtim Jantung/EKG",
    roles: ["dokter_spesialis", "dokter"],
    sections: [
      {
        key: "jantung_ekg",
        name: "Jantung / EKG",
        actions: ["view", "update", "submit", "upload"],
      },
    ],
  },
  {
    email: "gigi@rikkes.test",
    password: "Gigi#2026!",
    full_name: "Subtim Gigi",
    roles: ["dokter_gigi", "dokter"],
    sections: [{ key: "gilut", name: "Gigi / Odontogram", actions: ["view", "update", "submit"] }],
  },
  {
    email: "radiologi@rikkes.test",
    password: "Radiologi#2026!",
    full_name: "Subtim Radiologi",
    roles: ["radiologi", "dokter"],
    sections: [
      {
        key: "radiology",
        name: "Radiologi / Rontgen",
        actions: ["view", "update", "submit", "upload"],
      },
      { key: "usg", name: "USG", actions: ["view", "update", "submit"] },
    ],
  },
  {
    email: "lab@rikkes.test",
    password: "Lab#2026!",
    full_name: "Subtim Laboratorium",
    roles: ["lab", "dokter"],
    sections: [
      {
        key: "laboratorium",
        name: "Laboratorium",
        actions: ["view", "update", "submit", "upload"],
      },
    ],
  },
  {
    email: "viewer@rikkes.test",
    password: "Viewer#2026!",
    full_name: "Viewer Read-Only",
    roles: ["viewer"],
  },
  {
    email: "peserta@rikkes.test",
    password: "Peserta#2026!",
    full_name: "Peserta Uji Coba",
    roles: ["peserta"],
  },
  {
    email: "casis@rikkes.test",
    password: "Casis#2026!",
    full_name: "Casis Uji Coba",
    roles: ["casis"],
  },
];

async function isSuperAdmin(userId: string) {
  const { data } = await localAdminApi
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  return !!data;
}

export const seedTestAccounts = createServerFn({ method: "POST" })
  .middleware([requireLocalAuth])
  .handler(async ({ context }) => {
    if (!(await isSuperAdmin(context.userId))) {
      throw new Error("Hanya Super Admin yang boleh seed akun uji coba");
    }

    const results: { email: string; status: "created" | "exists" | "error"; message?: string }[] =
      [];

    for (const acc of ACCOUNTS) {
      try {
        const { data: existing } = await localAdminApi
          .from("profiles")
          .select("auth_user_id")
          .eq("email", acc.email)
          .maybeSingle();

        let userId: string | null = existing?.auth_user_id ?? null;

        if (!userId) {
          const created = await localAdminApi.auth.admin.createUser({
            email: acc.email,
            password: acc.password,
            email_confirm: true,
            user_metadata: { full_name: acc.full_name, is_test_account: true },
          });
          if (created.error || !created.data.user) {
            results.push({
              email: acc.email,
              status: "error",
              message: created.error?.message ?? "create failed",
            });
            continue;
          }
          userId = created.data.user.id;
        }

        await localAdminApi.from("profiles").upsert(
          {
            auth_user_id: userId,
            full_name: acc.full_name,
            email: acc.email,
            is_active: true,
            is_test_account: true,
            assigned_sections: (acc.sections ?? []).map((s) => s.key) as any,
          },
          { onConflict: "auth_user_id" },
        );

        await localAdminApi.from("user_roles").delete().eq("user_id", userId);
        await localAdminApi
          .from("user_roles")
          .insert(acc.roles.map((role) => ({ user_id: userId!, role: role as any })));

        if (acc.sections?.length) {
          await localAdminApi.from("user_section_assignments").delete().eq("user_id", userId);
          await localAdminApi.from("user_section_assignments").insert(
            acc.sections.map((s) => ({
              user_id: userId!,
              section_key: s.key,
              section_name: s.name,
              can_view: s.actions.includes("view"),
              can_create: s.actions.includes("create"),
              can_update: s.actions.includes("update"),
              can_submit: s.actions.includes("submit"),
              can_approve: s.actions.includes("approve"),
              can_request_revision: s.actions.includes("request_revision"),
              can_upload: s.actions.includes("upload"),
              can_export: s.actions.includes("export"),
              is_active: true,
            })),
          );
        }

        results.push({ email: acc.email, status: existing ? "exists" : "created" });
      } catch (e: any) {
        results.push({ email: acc.email, status: "error", message: e?.message ?? "unknown" });
      }
    }

    await localAdminApi.from("audit_logs").insert({
      user_id: context.userId,
      action: "seed_test_accounts",
      module: "user_management",
      after_data: results as any,
    });

    return { results };
  });
