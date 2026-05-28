import { ReactNode } from "react";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useAuth } from "@/lib/use-auth";

interface CanProps {
  permission?: string;
  anyOf?: string[];
  section?: string;
  sectionAction?: "can_view" | "can_create" | "can_update" | "can_submit" | "can_approve" | "can_request_revision" | "can_upload" | "can_export";
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Conditionally render children based on user permissions.
 * - permission: single permission key
 * - anyOf: render if user has any of the keys
 * - section + sectionAction: render if user has that section action
 */
export function Can({ permission, anyOf, section, sectionAction = "can_view", fallback = null, children }: CanProps) {
  const { loading, has, hasAny, hasSection } = usePermissions();
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes("super_admin") || roles.includes("tester");
  if (isSuperAdmin) return <>{children}</>;
  if (loading) return null;
  let allowed = true;
  if (permission) allowed = allowed && has(permission);
  if (anyOf && anyOf.length) allowed = allowed && hasAny(anyOf);
  if (section) allowed = allowed && hasSection(section, sectionAction);
  return allowed ? <>{children}</> : <>{fallback}</>;
}
