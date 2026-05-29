import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/use-auth";
import {
  LayoutDashboard,
  Users,
  Download,
  ClipboardList,
  Shield,
  LogOut,
  Table2,
  FileText,
  ScrollText,
  Upload,
  History,
  Sliders,
  FlaskConical,
  ClipboardCheck,
  Bug,
  BarChart3,
  BookOpen,
  Rocket,
  ChevronsLeft,
  ChevronsRight,
  UserCog,
  Stethoscope,
  Activity,
  AlertCircle,
  Ruler,
  Settings2,
  Hash,
  ShieldCheck,
  Trash2,
  Gauge,
  ClipboardEdit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import rikkesLogo from "@/assets/rikkes-logo.png";
import { useEffect, useState } from "react";
import { RealtimeNotifier } from "@/components/app/RealtimeNotifier";
import { NotificationsBell } from "@/components/app/NotificationsBell";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { getDb, subscribeLocalDbChanged } from "@/lib/localDb";
import { PERMISSIONS } from "@/lib/permissions/keys";
import { AppErrorBoundary } from "@/components/app/AppErrorBoundary";

const NAV: { to: string; label: string; icon: any; perm?: string; perms?: string[] }[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: PERMISSIONS.DASHBOARD_VIEW },
  {
    to: "/selections",
    label: "Master Seleksi",
    icon: ClipboardList,
    perm: PERMISSIONS.CANDIDATE_VIEW,
  },
  { to: "/candidates", label: "Peserta", icon: Users, perm: PERMISSIONS.CANDIDATE_VIEW },
  { to: "/hari-h", label: "Hari-H RIKKES", icon: Activity, perm: PERMISSIONS.HARI_H_VIEW },
  {
    to: "/data-belum-lengkap",
    label: "Data Belum Lengkap",
    icon: AlertCircle,
    perm: PERMISSIONS.CANDIDATE_VIEW,
  },
  {
    to: "/peserta-tanpa-no-test",
    label: "Peserta Tanpa No Test",
    icon: Hash,
    perm: PERMISSIONS.NO_TEST_VIEW,
  },
  { to: "/import-nomor-tes", label: "Import Nomor Tes", icon: Hash },
  {
    to: "/setting-hari-h",
    label: "Setting Hari-H",
    icon: Settings2,
    perm: PERMISSIONS.HARI_H_SETTINGS_VIEW,
  },
  {
    to: "/bypass-review",
    label: "Review Bypass",
    icon: ShieldCheck,
    perm: PERMISSIONS.HARI_H_BYPASS_VIEW,
  },
  {
    to: "/master-juknis",
    label: "Master Parameter Juknis",
    icon: Ruler,
    perm: PERMISSIONS.JUKNIS_VIEW,
  },
  {
    to: "/rekap-aplikasi",
    label: "Rekap APLIKASI",
    icon: Table2,
    perm: PERMISSIONS.CANDIDATE_VIEW,
  },
  {
    to: "/laporan-tahap",
    label: "Laporan Tahap",
    icon: FileText,
    perm: PERMISSIONS.CANDIDATE_VIEW,
  },
  {
    to: "/resume-casis",
    label: "Resume Casis",
    icon: ScrollText,
    perm: PERMISSIONS.CANDIDATE_VIEW,
  },
  {
    to: "/exports",
    label: "Export Rekap",
    icon: Download,
    perms: [PERMISSIONS.EXPORT_XLSX, PERMISSIONS.EXPORT_PDF],
  },
  { to: "/import-data", label: "Import Data", icon: Upload, perm: PERMISSIONS.IMPORT_VIEW },
  { to: "/import-history", label: "Import History", icon: History, perm: PERMISSIONS.IMPORT_VIEW },
  { to: "/formula-config", label: "Formula Config", icon: Sliders, perm: PERMISSIONS.FORMULA_VIEW },
  { to: "/progress-weights", label: "Bobot Progress", icon: Gauge },
  {
    to: "/rule-simulator",
    label: "Rule Simulator",
    icon: FlaskConical,
    perm: PERMISSIONS.RULE_SIMULATOR_VIEW,
  },
  { to: "/qa-dashboard", label: "QA Dashboard", icon: BarChart3 },
  { to: "/qa-test-cases", label: "Test Cases", icon: ClipboardCheck },
  { to: "/qa-issues", label: "Issue Tracker", icon: Bug },
  { to: "/audit", label: "Audit Log", icon: Shield, perm: PERMISSIONS.AUDIT_VIEW },
  { to: "/recovery", label: "Recovery Peserta", icon: Trash2 },
  { to: "/help-center", label: "Help Center", icon: BookOpen },
  { to: "/sop", label: "SOP Operasional", icon: ScrollText },
  { to: "/release-notes", label: "Release Notes", icon: Rocket },
  {
    to: "/user-management",
    label: "Manajemen Pengguna",
    icon: UserCog,
    perm: PERMISSIONS.USER_MANAGEMENT_VIEW,
  },
  {
    to: "/medical-subteams",
    label: "Master Subtim",
    icon: Stethoscope,
    perm: PERMISSIONS.MASTER_SUBTIM_VIEW,
  },
];

export function AppShell() {
  return (
    <AppErrorBoundary scope="AppShell">
      <AppShellInner />
    </AppErrorBoundary>
  );
}

function AppShellInner() {
  const { user, roles, signOut } = useAuth();
  const { loading: permLoading, has, hasAny, hasWildcard } = usePermissions();
  const state = useRouterState();
  const path = state.location.pathname;
  const navigate = useNavigate();
  // Super admin / tester selalu full access — bypass semua filter permission
  const isSuperAdmin = roles.includes("super_admin") || roles.includes("tester");
  // Peserta / Casis — hanya boleh akses form anamnesis miliknya sendiri
  const isPatientOnly =
    !isSuperAdmin && roles.length > 0 && roles.every((r) => r === "peserta" || r === "casis");
  const PATIENT_ALLOWED = new Set<string>(["/my-anamnesis", "/help-center"]);
  const PATIENT_NAV = [
    { to: "/my-anamnesis", label: "Form Anamnesis Saya", icon: ClipboardEdit },
    { to: "/help-center", label: "Help Center", icon: BookOpen },
  ];

  // Hard-redirect peserta jika mencoba membuka route admin secara manual
  useEffect(() => {
    if (!isPatientOnly) return;
    const allowed = Array.from(PATIENT_ALLOWED).some((p) => path === p || path.startsWith(p + "/"));
    if (!allowed) {
      navigate({ to: "/my-anamnesis", replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPatientOnly, path]);

  // Pimpinan / Direksi (read-only) — hanya menu monitoring & laporan
  const isPimpinanViewer =
    !isSuperAdmin &&
    roles.length > 0 &&
    roles.every((r) => r === "pimpinan_viewer" || r === "viewer");
  const VIEWER_ALLOWED = new Set<string>([
    "/dashboard",
    "/rekap-aplikasi",
    "/laporan-tahap",
    "/resume-casis",
    "/help-center",
    "/sop",
    "/release-notes",
    "/rikkes",
  ]);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("rikkes:sidebar:collapsed") === "1";
  });
  const [badges, setBadges] = useState({
    noTestPending: 0,
    incomplete: 0,
    review: 0,
    importIssues: 0,
  });
  const { noTestPending } = badges;

  useEffect(() => {
    if (isPatientOnly) return undefined;
    const refreshNoTestBadge = () => {
      const db = getDb() as any;
      const count = (db.candidates ?? []).filter(
        (candidate: any) =>
          !candidate.is_deleted &&
          (!String(candidate.test_number ?? "").trim() || candidate.no_test_missing === true),
      ).length;
      setBadges((current) => ({ ...current, noTestPending: count }));
    };
    refreshNoTestBadge();
    return subscribeLocalDbChanged(refreshNoTestBadge);
  }, [isPatientOnly, path]);

  useEffect(() => {
    try {
      localStorage.setItem("rikkes:sidebar:collapsed", collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);

  return (
    <div className="flex min-h-screen bg-[hsl(210_40%_96%)]">
      <aside
        className={`${collapsed ? "w-16" : "w-64"} transition-[width] duration-200 shrink-0 border-r border-white/10 bg-primary text-primary-foreground flex flex-col sticky top-0 h-screen`}
      >
        <div
          className={`${collapsed ? "px-2 py-4 justify-center" : "px-5 py-5"} border-b border-white/10 flex items-center gap-3`}
        >
          <img
            src={rikkesLogo}
            alt="Logo RIKKES TNI AU"
            width={40}
            height={40}
            className="h-10 w-10 object-contain shrink-0 drop-shadow"
            loading="eager"
          />
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-[10px] tracking-widest uppercase opacity-70">Sistem Digital</div>
              <div className="text-base font-bold leading-tight truncate">RIKKES TNI AU</div>
              <div className="text-[10px] opacity-70">Diskesau</div>
              <div className="mt-1 inline-flex rounded bg-emerald-500/20 px-2 py-0.5 text-[10px]">
                Mode Lokal
              </div>
            </div>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {(isPatientOnly ? PATIENT_NAV : NAV)
            .filter((n) => {
              if (isPatientOnly) return true;
              // Super admin/tester selalu lihat semua menu — tanpa menunggu permission load
              if (isSuperAdmin) return true;
              // Pimpinan viewer / viewer murni → whitelist menu monitoring saja
              if (isPimpinanViewer) return VIEWER_ALLOWED.has(n.to);
              if (permLoading) return false;
              if (hasWildcard) return true;
              if (!(n as any).perm && !(n as any).perms) return true;
              if ((n as any).perm) return has((n as any).perm);
              if ((n as any).perms) return hasAny((n as any).perms);
              return false;
            })
            .map((n) => {
              const active = path.startsWith(n.to);
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  title={collapsed ? n.label : undefined}
                  className={`relative flex items-center ${collapsed ? "justify-center px-2" : "gap-3 px-3"} py-2 rounded-md text-sm transition ${
                    active ? "bg-white/15 font-semibold" : "hover:bg-white/10"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate flex-1">{n.label}</span>}
                  {n.to === "/peserta-tanpa-no-test" && noTestPending > 0 && (
                    <span
                      className={`${collapsed ? "absolute top-1 right-1" : "ml-auto"} inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-amber-400 text-amber-950 leading-none`}
                      title={`${noTestPending} peserta belum punya No Test final`}
                    >
                      {noTestPending > 99 ? "99+" : noTestPending}
                    </span>
                  )}
                </Link>
              );
            })}
        </nav>
        <div className="p-2 border-t border-white/10 space-y-2">
          <NotificationsBell />
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className={`w-full flex items-center ${collapsed ? "justify-center" : "justify-between px-3"} py-2 rounded-md text-xs hover:bg-white/10 transition`}
            title={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
          >
            {!collapsed && <span className="opacity-80">Ciutkan</span>}
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <ChevronsLeft className="h-4 w-4" />
            )}
          </button>
          {!collapsed && (
            <div className="px-2 text-[11px]">
              <div className="opacity-70">Login sebagai:</div>
              <div className="truncate font-medium">{user?.email}</div>
              <div className="opacity-70 truncate capitalize">
                {(roles[0] ?? "viewer").replace(/_/g, " ")}
              </div>
            </div>
          )}
          <Button
            variant="destructive"
            size="sm"
            className={`w-full ${collapsed ? "px-0" : ""} bg-red-500 hover:bg-red-600 text-white`}
            onClick={() => signOut()}
            title="Keluar"
          >
            <LogOut className={`h-4 w-4 ${collapsed ? "" : "mr-2"}`} />
            {!collapsed && "Logout"}
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <RealtimeNotifier />
        <Outlet />
      </main>
    </div>
  );
}
