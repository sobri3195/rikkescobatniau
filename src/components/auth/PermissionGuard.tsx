import { ReactNode, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useAuth } from "@/lib/use-auth";

interface Props {
  permission?: string;
  anyOf?: string[];
  section?: string;
  sectionAction?: "can_view" | "can_update" | "can_submit" | "can_approve" | "can_upload" | "can_export";
  module?: string;
  children: ReactNode;
}

export function PermissionGuard({ permission, anyOf, section, sectionAction = "can_view", module, children }: Props) {
  const { loading, has, hasAny, hasSection, logDenied } = usePermissions();
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes("super_admin") || roles.includes("tester");
  const navigate = useNavigate();

  useEffect(() => {
    if (isSuperAdmin) return;
    if (loading) return;
    let allowed = true;
    if (permission) allowed = allowed && has(permission);
    if (anyOf && anyOf.length) allowed = allowed && hasAny(anyOf);
    if (section) allowed = allowed && hasSection(section, sectionAction);
    if (!allowed) {
      const key = permission ?? (anyOf?.join("|") ?? `section:${section}:${sectionAction}`);
      void logDenied(key, module, "route_access_denied");
      navigate({ to: "/403", search: { from: window.location.pathname, key } as any });
    }
  }, [isSuperAdmin, loading, permission, anyOf, section, sectionAction, module]);

  if (isSuperAdmin) return <>{children}</>;
  if (loading) return <div className="p-8 text-sm text-muted-foreground">Memeriksa akses…</div>;

  let allowed = true;
  if (permission) allowed = allowed && has(permission);
  if (anyOf && anyOf.length) allowed = allowed && hasAny(anyOf);
  if (section) allowed = allowed && hasSection(section, sectionAction);
  if (!allowed) return null;
  return <>{children}</>;
}
