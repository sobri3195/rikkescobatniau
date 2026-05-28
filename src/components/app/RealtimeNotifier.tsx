import { useEffect } from "react";
import { localDataApi } from "@/lib/localDataApi";
import { toast } from "sonner";
import { useAuth } from "@/lib/use-auth";

/**
 * Global realtime listener. Mount once inside AppShell.
 * Fires toasts when:
 *  - new bypass request comes in (admin/kepala_sub_tim get alert)
 *  - exam_sections anamnesa cleared (so subtim knows peserta siap)
 */
export function RealtimeNotifier() {
  const { roles } = useAuth();

  useEffect(() => {
    const canReviewBypass = roles.some((r) => ["super_admin", "admin", "kepala_sub_tim"].includes(r));
    const isSubteam = roles.some((r) =>
      ["dokter", "dokter_spesialis", "dokter_gigi", "radiologi", "lab", "kepala_sub_tim"].includes(r),
    );

    const channels: any[] = [];

    if (canReviewBypass) {
      const ch = localDataApi
        .channel("rt-bypass-audit")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "bypass_audit" },
          (payload: any) => {
            const r = payload.new ?? {};
            toast.warning(`Bypass baru: ${r.bypass_type ?? "-"}`, {
              description: r.reason ? `"${String(r.reason).slice(0, 80)}"` : undefined,
              action: { label: "Review", onClick: () => (window.location.href = "/bypass-review") },
            });
          },
        )
        .subscribe();
      channels.push(ch);
    }

    if (isSubteam) {
      const ch = localDataApi
        .channel("rt-section-clear")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "exam_sections", filter: "anamnesis_status=eq.Clear" },
          (payload: any) => {
            const newRow = payload.new ?? {};
            const oldRow = payload.old ?? {};
            if (newRow.anamnesis_status === "Clear" && oldRow.anamnesis_status !== "Clear") {
              toast.success("Peserta lulus screening anamnesa", {
                description: `Section: ${newRow.section_name ?? newRow.section_key ?? "-"}`,
              });
            }
          },
        )
        .subscribe();
      channels.push(ch);
    }

    return () => {
      channels.forEach((c) => localDataApi.removeChannel(c));
    };
  }, [roles.join(",")]);

  return null;
}