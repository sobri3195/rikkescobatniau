import { useEffect, useState, useCallback } from "react";
import { isLocalMode } from "@/lib/storage-mode";
import { listRolePermissions, listSectionAssignments } from "@/lib/services/permissionService";
import { useAuth } from "@/lib/use-auth";

interface PermissionState {
  loading: boolean;
  roles: string[];
  allowedKeys: Set<string>;
  hasWildcard: boolean;
  sections: Record<string, {
    can_view: boolean;
    can_create: boolean;
    can_update: boolean;
    can_submit: boolean;
    can_approve: boolean;
    can_request_revision: boolean;
    can_upload: boolean;
    can_export: boolean;
  }>;
}

const cache = new Map<string, PermissionState>();

export function usePermissions() {
  const { user, roles, loading: authLoading } = useAuth();
  const [state, setState] = useState<PermissionState>({
    loading: true,
    roles: [],
    allowedKeys: new Set(),
    hasWildcard: false,
    sections: {},
  });

  const load = useCallback(async () => {
    if (!user) {
      setState({ loading: false, roles: [], allowedKeys: new Set(), hasWildcard: false, sections: {} });
      return;
    }
    const cached = cache.get(user.id);
    if (cached) {
      setState(cached);
      return;
    }
    const rolePerms = isLocalMode ? [] : await listRolePermissions(roles.length ? roles : ["viewer"]);
    const assigns = await listSectionAssignments(user.id);
    const allowed = new Set<string>();
    let wildcard = false;
    (rolePerms ?? []).forEach((r: any) => {
      if (!r.allowed) return;
      if (r.permission_key === "*") wildcard = true;
      else allowed.add(r.permission_key);
    });
    if (roles.includes("super_admin") || roles.includes("tester")) wildcard = true;

    const sections: PermissionState["sections"] = {};
    (assigns ?? []).forEach((a: any) => {
      sections[a.section_key] = {
        can_view: !!a.can_view,
        can_create: !!a.can_create,
        can_update: !!a.can_update,
        can_submit: !!a.can_submit,
        can_approve: !!a.can_approve,
        can_request_revision: !!a.can_request_revision,
        can_upload: !!a.can_upload,
        can_export: !!a.can_export,
      };
    });
    const next: PermissionState = { loading: false, roles, allowedKeys: allowed, hasWildcard: wildcard, sections };
    cache.set(user.id, next);
    setState(next);
  }, [user, roles]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  const has = useCallback(
    (key: string) => state.hasWildcard || state.allowedKeys.has(key),
    [state],
  );

  const hasAny = useCallback(
    (keys: string[]) => state.hasWildcard || keys.some((k) => state.allowedKeys.has(k)),
    [state],
  );

  const hasSection = useCallback(
    (section: string, action: keyof PermissionState["sections"][string] = "can_view") => {
      if (state.hasWildcard) return true;
      const s = state.sections[section];
      return s ? !!s[action] : false;
    },
    [state],
  );

  const invalidate = useCallback(() => {
    if (user) cache.delete(user.id);
    void load();
  }, [user, load]);

  async function logDenied(permissionKey: string, module?: string, reason?: string) {
    if (!user || isLocalMode) return;
    void permissionKey;
    void module;
    void reason;
  }

  return { ...state, has, hasAny, hasSection, invalidate, logDenied };
}

export function clearPermissionCache() {
  cache.clear();
}
