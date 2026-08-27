"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  AlertTriangle,
  Users,
  CalendarDays,
  Compass,
  ChevronRight,
  Shield,
  Trophy,
  Target,
  BookOpen,
  SlidersHorizontal,
  BarChart3,
} from "lucide-react";
import { DocHubProvider, useDocHub } from "./_lib/DocHubContext";

type NavLeaf = {
  label: string;
  href: string;
  icon: React.ElementType;
  exact?: boolean;
  badge?: string;
};

type NavGroup = {
  group: string;
  items: NavLeaf[];
};

type NavItem = NavLeaf | NavGroup;

function isGroup(item: NavItem): item is NavGroup {
  return "group" in item;
}

const NAV_BASE: NavItem[] = [
  {
    label: "Overview",
    href: "/doc-hub",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    group: "Game Model",
    items: [
      { label: "Philosophy", href: "/doc-hub/game-model", icon: Compass },
      { label: "Principles & Subprinciples", href: "/doc-hub/principles", icon: BookOpen },
      { label: "Age Group Defaults", href: "/doc-hub/age-group-defaults", icon: SlidersHorizontal },
    ],
  },
  {
    group: "Coaching Ops",
    items: [
      { label: "Attention", href: "/doc-hub/attention", icon: AlertTriangle },
      { label: "Coaches", href: "/doc-hub/coaches", icon: Users },
      { label: "Teams", href: "/doc-hub/teams", icon: Trophy },
      { label: "Training Priorities", href: "/doc-hub/training-priorities", icon: Target },
      { label: "Adherence", href: "/doc-hub/adherence", icon: BarChart3 },
      { label: "Calendar", href: "/doc-hub/calendar", icon: CalendarDays },
    ],
  },
];

const BREADCRUMBS: Record<string, string[]> = {
  "/doc-hub": ["DOC Console", "Overview"],
  "/doc-hub/attention": ["DOC Console", "Attention"],
  "/doc-hub/coaches": ["DOC Console", "Coaches"],
  "/doc-hub/teams": ["DOC Console", "Teams"],
  "/doc-hub/calendar": ["DOC Console", "Calendar"],
  "/doc-hub/game-model": ["DOC Console", "Game Model", "Philosophy"],
  "/doc-hub/principles": ["DOC Console", "Game Model", "Principles & Subprinciples"],
  "/doc-hub/age-group-defaults": ["DOC Console", "Game Model", "Age Group Defaults"],
  "/doc-hub/training-priorities": ["DOC Console", "Coaching Ops", "Training Priorities"],
  "/doc-hub/adherence": ["DOC Console", "Coaching Ops", "Adherence"],
};

function SidebarLink({ item, pathname }: { item: NavLeaf; pathname: string }) {
  const isActive = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
        isActive
          ? "bg-emerald-500/15 text-emerald-300 shadow-sm"
          : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
      }`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 transition-colors ${
          isActive ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-300"
        }`}
      />
      <span className="min-w-0 truncate">{item.label}</span>
      {item.badge ? (
        <span className="ml-auto shrink-0 rounded-md border border-emerald-500/30 bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function DocHubSidebar({ pathname }: { pathname: string }) {
  const { clubOptions, selectedClubId, setSelectedClubId, selectedClub } = useDocHub();

  return (
    <aside className="sticky top-0 z-20 flex h-screen w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-950">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-800 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/20">
          <Shield className="h-3.5 w-3.5 text-emerald-400" />
        </div>
        <div>
          <p className="text-xs font-semibold leading-none text-slate-100">CoachAI</p>
          <p className="mt-0.5 text-[10px] leading-none text-slate-500">DOC Console</p>
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_BASE.map((item, i) => {
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

      <div className="shrink-0 space-y-2 border-t border-slate-800 p-3">
        <p className="px-1 text-[9px] font-semibold uppercase tracking-widest text-slate-600">
          Active club
        </p>
        {clubOptions.length > 0 ? (
          <select
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
            value={selectedClubId}
            onChange={(e) => setSelectedClubId(e.target.value)}
          >
            {clubOptions.map((c) => (
              <option key={c.clubId} value={c.clubId}>
                {c.clubName}
                {c.role ? ` (${c.role})` : ""}
              </option>
            ))}
          </select>
        ) : (
          <p className="px-1 text-[11px] text-slate-500">No club linked</p>
        )}
        {selectedClub?.role ? (
          <p className="px-1 text-[10px] text-slate-500">Your role · {selectedClub.role}</p>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-slate-800 p-3">
        <Link
          href="/app"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-500 transition-colors hover:bg-slate-800/60 hover:text-slate-300"
        >
          <ChevronRight className="h-3 w-3 rotate-180" />
          Back to App
        </Link>
      </div>
    </aside>
  );
}

function TopBar({ pathname }: { pathname: string }) {
  const matchedKey =
    Object.keys(BREADCRUMBS)
      .filter((k) => pathname === k || pathname.startsWith(k + "/"))
      .sort((a, b) => b.length - a.length)[0] ?? "/doc-hub";
  const crumbs = BREADCRUMBS[matchedKey] ?? ["DOC Console"];

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-800 bg-slate-950/80 px-6 backdrop-blur-sm">
      <nav className="flex items-center gap-1 text-sm">
        {crumbs.map((crumb, i) => (
          <span key={`${crumb}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-slate-600" />}
            <span className={i === crumbs.length - 1 ? "font-semibold text-slate-200" : "text-slate-500"}>
              {crumb}
            </span>
          </span>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
        <span className="text-[10px] font-medium text-cyan-300">Beta</span>
      </div>
    </header>
  );
}

function DocHubShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { access, accessError } = useDocHub();

  if (access === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Checking DOC Console access…
      </main>
    );
  }

  if (access === "denied") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-50">
        <div className="max-w-md rounded-2xl border border-slate-700/60 bg-slate-900 p-8 text-center">
          <h1 className="text-lg font-semibold text-white">DOC or Section Director access required</h1>
          <p className="mt-2 text-sm text-slate-400">
            DOC Console is for club directors. Coaches use Session Builder, Vault, and Calendar
            instead.
          </p>
          <Link
            href="/app"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white"
          >
            Back to app
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-200">
      <DocHubSidebar pathname={pathname} />
      <div className="min-w-0 flex-1">
        <TopBar pathname={pathname} />
        <main className="min-h-[calc(100vh-3.5rem)] p-6">
          {accessError ? (
            <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {accessError}
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DocHubLayout({ children }: { children: React.ReactNode }) {
  return (
    <DocHubProvider>
      <DocHubShell>{children}</DocHubShell>
    </DocHubProvider>
  );
}
