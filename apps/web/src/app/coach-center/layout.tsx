"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CalendarDays,
  MessageSquare,
  Sparkles,
  ClipboardList,
  ChevronRight,
  Trophy,
  Settings,
} from "lucide-react";
import { CoachCenterProvider, useCoachCenter } from "./_lib/CoachCenterContext";
import { TeamPicker } from "./_lib/TeamPicker";

type NavLeaf = {
  label: string;
  href: string;
  icon: React.ElementType;
  exact?: boolean;
};

const NAV: NavLeaf[] = [
  { label: "Overview", href: "/coach-center", icon: LayoutDashboard, exact: true },
  { label: "Team", href: "/coach-center/team", icon: Users },
  { label: "Curriculum", href: "/coach-center/curriculum", icon: BookOpen },
  { label: "Calendar", href: "/coach-center/calendar", icon: CalendarDays },
  { label: "Chat", href: "/coach-center/chat", icon: MessageSquare },
  { label: "Next Sessions", href: "/coach-center/next-sessions", icon: Sparkles },
  { label: "Game Day", href: "/coach-center/game-day", icon: ClipboardList },
  { label: "Settings", href: "/coach-center/settings", icon: Settings },
];

const BREADCRUMBS: Record<string, string[]> = {
  "/coach-center": ["Coach Center", "Overview"],
  "/coach-center/team": ["Coach Center", "Team"],
  "/coach-center/curriculum": ["Coach Center", "Curriculum"],
  "/coach-center/calendar": ["Coach Center", "Calendar"],
  "/coach-center/chat": ["Coach Center", "Chat"],
  "/coach-center/next-sessions": ["Coach Center", "Next Sessions"],
  "/coach-center/game-day": ["Coach Center", "Game Day"],
  "/coach-center/settings": ["Coach Center", "Settings"],
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
          ? "bg-sky-500/15 text-sky-300 shadow-sm"
          : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
      }`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${isActive ? "text-sky-400" : "text-slate-500 group-hover:text-slate-300"}`}
      />
      <span className="min-w-0 truncate">{item.label}</span>
    </Link>
  );
}

function CoachCenterSidebar({ pathname }: { pathname: string }) {
  const { teams, selectedTeamId, setSelectedTeamId, selectedTeam, canViewAllTeams } = useCoachCenter();

  return (
    <aside className="sticky top-0 z-20 flex h-screen w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-950">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-800 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/20">
          <Trophy className="h-3.5 w-3.5 text-sky-400" />
        </div>
        <div>
          <p className="text-xs font-semibold leading-none text-slate-100">CoachAI</p>
          <p className="mt-0.5 text-[10px] leading-none text-slate-500">Coach Center</p>
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV.map((item) => (
          <SidebarLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      <div className="shrink-0 space-y-2 border-t border-slate-800 p-3">
        <p className="px-1 text-[9px] font-semibold uppercase tracking-widest text-slate-600">
          {canViewAllTeams ? "View team" : "Active team"}
        </p>
        {teams.length > 0 ? (
          <TeamPicker
            compact
            teams={teams}
            selectedTeamId={selectedTeamId}
            onChange={setSelectedTeamId}
            label={canViewAllTeams ? "all teams" : "team"}
          />
        ) : (
          <p className="px-1 text-[11px] text-slate-500">No team yet — create one in Team</p>
        )}
        {selectedTeam ? (
          <p className="px-1 text-[10px] text-slate-500">
            {selectedTeam.gameModelLabel}
            {selectedTeam.season ? ` · week ${selectedTeam.season.currentWeekIndex}` : ""}
          </p>
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
  const { teams, selectedTeamId, setSelectedTeamId, canViewAllTeams } = useCoachCenter();
  const matchedKey =
    Object.keys(BREADCRUMBS)
      .filter((k) => pathname === k || pathname.startsWith(k + "/"))
      .sort((a, b) => b.length - a.length)[0] ?? "/coach-center";
  const crumbs = BREADCRUMBS[matchedKey] ?? ["Coach Center"];

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
      <div className="ml-auto flex items-center gap-3">
        {teams.length > 1 ? (
          <div className="hidden min-w-[240px] sm:block">
            <TeamPicker
              teams={teams}
              selectedTeamId={selectedTeamId}
              onChange={setSelectedTeamId}
              label={canViewAllTeams ? "all teams" : "team"}
            />
          </div>
        ) : null}
        {canViewAllTeams ? (
          <span className="hidden rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium text-amber-300 md:inline">
            All teams
          </span>
        ) : null}
        <div className="flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
          <span className="text-[10px] font-medium text-cyan-300">Beta</span>
        </div>
      </div>
    </header>
  );
}

function CoachCenterShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { access, accessError } = useCoachCenter();

  if (access === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Opening Coach Center…
      </main>
    );
  }

  if (access === "denied") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-50">
        <div className="max-w-md rounded-2xl border border-slate-700/60 bg-slate-900 p-8 text-center">
          <h1 className="text-lg font-semibold text-white">Sign in to open Coach Center</h1>
          <p className="mt-2 text-sm text-slate-400">
            Your team, curriculum, calendar, and season chat live here.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-sky-600 px-4 text-sm font-medium text-white"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-200">
      <CoachCenterSidebar pathname={pathname} />
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

export default function CoachCenterLayout({ children }: { children: React.ReactNode }) {
  return (
    <CoachCenterProvider>
      <CoachCenterShell>{children}</CoachCenterShell>
    </CoachCenterProvider>
  );
}
