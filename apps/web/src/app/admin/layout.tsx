"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  Building2,
  BarChart3,
  FileCheck,
  Settings,
  ChevronRight,
  Lock,
  Cpu,
} from "lucide-react";

// ─── Nav structure ────────────────────────────────────────────────────────────

type NavLeaf = {
  label: string;
  href: string;
  icon: React.ElementType;
  layer?: string;      // "L1", "L3", "L5" etc — shown as a badge
  badge?: string;      // "NEW", "BETA" etc
  exact?: boolean;     // exact match for active state
};

type NavGroup = {
  group: string;
  items: NavLeaf[];
};

type NavItem = NavLeaf | NavGroup;

function isGroup(item: NavItem): item is NavGroup {
  return "group" in item;
}

const NAV: NavItem[] = [
  {
    label: "Overview",
    href: "/admin",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    group: "Access Control",
    items: [
      {
        label: "Permissions",
        href: "/admin/access",
        icon: Lock,
        layer: "L3",
      },
      {
        label: "Club Management",
        href: "/admin/clubs",
        icon: Building2,
        layer: "L5",
        badge: "NEW",
      },
    ],
  },
  {
    label: "Users",
    href: "/admin/users",
    icon: Users,
    layer: "L1",
  },
  {
    label: "Analytics",
    href: "/admin/analytics",
    icon: BarChart3,
  },
  {
    label: "Content & QA",
    href: "/admin/content",
    icon: FileCheck,
  },
  {
    label: "System",
    href: "/admin/system",
    icon: Settings,
  },
];

// ─── Layer colour map ─────────────────────────────────────────────────────────

const LAYER_COLORS: Record<string, string> = {
  L1: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  L2: "bg-violet-500/20 text-violet-300 border border-violet-500/30",
  L3: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  L4: "bg-red-500/20 text-red-300 border border-red-500/30",
  L5: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
};

// ─── Sidebar leaf item ────────────────────────────────────────────────────────

function SidebarLink({ item, pathname }: { item: NavLeaf; pathname: string }) {
  const isActive = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + "/");

  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={`
        group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all
        ${
          isActive
            ? "bg-emerald-500/15 text-emerald-300 shadow-sm"
            : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
        }
      `}
    >
      <Icon
        className={`h-4 w-4 shrink-0 transition-colors ${
          isActive ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-300"
        }`}
      />
      <span className="truncate">{item.label}</span>
      {item.layer && (
        <span
          className={`ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
            LAYER_COLORS[item.layer] ?? "bg-slate-700 text-slate-400"
          }`}
        >
          {item.layer}
        </span>
      )}
      {item.badge && !item.layer && (
        <span className="ml-auto shrink-0 rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300 border border-emerald-500/30">
          {item.badge}
        </span>
      )}
      {item.badge && item.layer && (
        <span className="shrink-0 rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300 border border-emerald-500/30">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function AdminSidebar({ pathname }: { pathname: string }) {
  return (
    <aside className="sticky top-0 z-20 flex h-screen w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-950">
      {/* Logo / brand */}
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-800 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/30">
          <Cpu className="h-3.5 w-3.5 text-emerald-400" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-100 leading-none">CoachAI</p>
          <p className="text-[10px] text-slate-500 leading-none mt-0.5">Admin Console</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV.map((item, i) => {
          if (isGroup(item)) {
            return (
              <div key={i} className="pt-3 first:pt-0">
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                  {item.group}
                </p>
                <div className="space-y-0.5">
                  {item.items.map((child) => (
                    <SidebarLink key={child.href} item={child} pathname={pathname} />
                  ))}
                </div>
              </div>
            );
          }
          return (
            <div key={i} className="space-y-0.5">
              <SidebarLink item={item} pathname={pathname} />
            </div>
          );
        })}
      </nav>

      {/* Permission Layer Legend */}
      <div className="shrink-0 border-t border-slate-800 p-3">
        <p className="mb-2 px-1 text-[9px] font-semibold uppercase tracking-widest text-slate-600">
          Permission Layers
        </p>
        <div className="space-y-1">
          {[
            { id: "L1", label: "Identity" },
            { id: "L2", label: "Subscription" },
            { id: "L3", label: "Access Rules" },
            { id: "L4", label: "Admin Roles" },
            { id: "L5", label: "Club Code" },
          ].map(({ id, label }) => (
            <div key={id} className="flex items-center gap-2">
              <span
                className={`shrink-0 rounded px-1.5 py-px text-[9px] font-bold ${
                  LAYER_COLORS[id] ?? ""
                }`}
              >
                {id}
              </span>
              <span className="text-[10px] text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Back to app */}
      <div className="shrink-0 border-t border-slate-800 p-3">
        <Link
          href="/app"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-500 hover:bg-slate-800/60 hover:text-slate-300 transition-colors"
        >
          <ChevronRight className="h-3 w-3 rotate-180" />
          Back to App
        </Link>
      </div>
    </aside>
  );
}

// ─── Top bar ──────────────────────────────────────────────────────────────────

const BREADCRUMBS: Record<string, string[]> = {
  "/admin":           ["Admin", "Overview"],
  "/admin/users":     ["Admin", "Users"],
  "/admin/access":    ["Admin", "Access Control", "Permissions"],
  "/admin/clubs":     ["Admin", "Access Control", "Club Management"],
  "/admin/analytics": ["Admin", "Analytics"],
  "/admin/content":   ["Admin", "Content & QA"],
  "/admin/system":    ["Admin", "System"],
};

function TopBar({ pathname }: { pathname: string }) {
  // Find longest prefix match
  const matchedKey =
    Object.keys(BREADCRUMBS)
      .filter((k) => pathname === k || pathname.startsWith(k + "/"))
      .sort((a, b) => b.length - a.length)[0] ?? "/admin";

  const crumbs = BREADCRUMBS[matchedKey] ?? ["Admin"];

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-800 bg-slate-950/80 px-6 backdrop-blur-sm">
      <nav className="flex items-center gap-1 text-sm">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-slate-600" />}
            <span
              className={
                i === crumbs.length - 1
                  ? "font-semibold text-slate-200"
                  : "text-slate-500"
              }
            >
              {crumb}
            </span>
          </span>
        ))}
      </nav>

      {/* Live indicator */}
      <div className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] font-medium text-emerald-400">Live</span>
      </div>
    </header>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-200">
      <AdminSidebar pathname={pathname} />

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <TopBar pathname={pathname} />
        <main className="min-h-[calc(100vh-3.5rem)] p-6">{children}</main>
      </div>
    </div>
  );
}
