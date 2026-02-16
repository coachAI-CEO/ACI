"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import AuthButton from "@/components/AuthButton";

const navItems = [
  { href: "/app", label: "Home", icon: HomeIcon },
  { href: "/demo/drill", label: "Drill Generator", icon: DrillIcon },
  { href: "/demo/session", label: "Session Builder", icon: SessionIcon },
  { href: "/vault", label: "Vault", icon: VaultIcon },
  { href: "/vault/favorites", label: "Favorites", icon: StarIcon },
  { href: "/calendar", label: "Calendar", icon: CalendarIcon },
];

const bottomItems = [
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function AppHeader() {
  const pathname = usePathname();
  const hideHeader = pathname === "/" || pathname.startsWith("/landing");
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Persist sidebar collapsed state
  useEffect(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const syncViewport = () => {
      const desktop = media.matches;
      setIsDesktop(desktop);
      if (desktop) setMobileOpen(false);
    };
    syncViewport();
    media.addEventListener("change", syncViewport);
    return () => media.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", String(collapsed));
    window.dispatchEvent(new Event("sidebarCollapsedChange"));
  }, [collapsed]);

  // Check admin role
  useEffect(() => {
    const checkAdmin = () => {
      try {
        const stored = localStorage.getItem("user");
        if (stored) {
          const user = JSON.parse(stored);
          setIsAdmin(user.adminRole === "SUPER_ADMIN");
        } else {
          setIsAdmin(false);
        }
      } catch {
        setIsAdmin(false);
      }
    };
    checkAdmin();
    window.addEventListener("userLogin", checkAdmin);
    window.addEventListener("storage", checkAdmin);
    return () => {
      window.removeEventListener("userLogin", checkAdmin);
      window.removeEventListener("storage", checkAdmin);
    };
  }, []);

  if (hideHeader) return null;

  const isActive = (href: string) => {
    if (href === "/app") return pathname === "/app";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const expanded = !collapsed || hovering;
  const showLabels = isDesktop ? expanded : true;

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#0a0f1a]/90 px-3 backdrop-blur-2xl lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-200"
          aria-label="Open navigation"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <span className="text-sm font-semibold tracking-tight">
          <span className="text-white/90">Tactical</span>
          <span className="text-emerald-400">Edge</span>
        </span>
        <AuthButton compact />
      </div>

      {!isDesktop && mobileOpen && (
        <button
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation overlay"
        />
      )}

      <aside
      onMouseEnter={() => collapsed && setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={`sidebar-root fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/[0.06] bg-[#0a0f1a]/95 backdrop-blur-2xl transition-all duration-300 ease-[cubic-bezier(.4,0,.2,1)] w-72 lg:w-auto ${
        expanded ? "lg:w-56" : "lg:w-[4.25rem]"
      } ${mobileOpen || isDesktop ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
    >
      {/* Logo area */}
      <div className="flex h-20 items-center gap-3 px-4 border-b border-white/[0.04]">
        <div className="relative flex h-[65px] w-[65px] shrink-0 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/TacticalEdge_Emblem.png"
            alt="TacticalEdge"
            width={65}
            height={65}
            className="mix-blend-lighten"
          />
        </div>
        <span
          className={`text-lg font-bold tracking-tight transition-opacity duration-200 ${
            showLabels ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <span className="text-white/90">Tactical</span>
          <span className="text-emerald-400">Edge</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-1 scrollbar-none">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={isDesktop && collapsed && !hovering ? item.label : undefined}
              onClick={() => {
                if (!isDesktop) setMobileOpen(false);
              }}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ${
                active
                  ? "bg-emerald-500/[0.12] text-emerald-300 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.15)]"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
              }`}
            >
              {/* Active indicator bar */}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              )}
              <Icon
                className={`h-[18px] w-[18px] shrink-0 transition-colors duration-200 ${
                  active ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-300"
                }`}
              />
              <span
                className={`whitespace-nowrap transition-opacity duration-200 ${
                  showLabels ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-white/[0.04] px-3 py-3 space-y-1">
        {/* Admin link — only for SUPER_ADMIN */}
        {isAdmin && (() => {
          const active = isActive("/admin");
          return (
            <Link
              href="/admin"
              title={isDesktop && collapsed && !hovering ? "Admin" : undefined}
              onClick={() => {
                if (!isDesktop) setMobileOpen(false);
              }}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ${
                active
                  ? "bg-amber-500/[0.12] text-amber-300 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.15)]"
                  : "text-amber-400/70 hover:bg-white/[0.04] hover:text-amber-300"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
              )}
              <AdminIcon
                className={`h-[18px] w-[18px] shrink-0 transition-colors duration-200 ${
                  active ? "text-amber-400" : "text-amber-500/50 group-hover:text-amber-400"
                }`}
              />
              <span
                className={`whitespace-nowrap transition-opacity duration-200 ${
                  showLabels ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                Admin
              </span>
            </Link>
          );
        })()}

        {bottomItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={isDesktop && collapsed && !hovering ? item.label : undefined}
              onClick={() => {
                if (!isDesktop) setMobileOpen(false);
              }}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ${
                active
                  ? "bg-emerald-500/[0.12] text-emerald-300 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.15)]"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              )}
              <Icon
                className={`h-[18px] w-[18px] shrink-0 transition-colors duration-200 ${
                  active ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-300"
                }`}
              />
              <span
                className={`whitespace-nowrap transition-opacity duration-200 ${
                  showLabels ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Collapse toggle */}
        {isDesktop && (
          <button
            onClick={() => { setCollapsed((c) => !c); setHovering(false); }}
            className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-500 transition-all duration-200 hover:bg-white/[0.04] hover:text-slate-300"
          >
            <CollapseIcon
              className={`h-[18px] w-[18px] shrink-0 transition-transform duration-300 ${
                collapsed ? "rotate-180" : ""
              }`}
            />
            <span
              className={`whitespace-nowrap transition-opacity duration-200 ${
                showLabels ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              Collapse
            </span>
          </button>
        )}

        {/* User / Auth */}
        <div className={`mt-2 pt-2 border-t border-white/[0.04] ${showLabels ? "" : "flex justify-center"}`}>
          <AuthButton compact={isDesktop ? !showLabels : false} />
        </div>
      </div>
    </aside>
    </>
  );
}

/* ─── Icons ─── */

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M9.5 20v-6h5v6" />
    </svg>
  );
}

function DrillIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
      <path d="M8.5 8.5l7 7" />
      <path d="M15 6h3v3" />
      <path d="M6 15v3h3" />
    </svg>
  );
}

function SessionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="M8 9.5h8M8 13h8M8 16.5h5" />
    </svg>
  );
}

function VaultIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3.5 7.5h17v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11z" />
      <path d="M3.5 7.5l2-3h13l2 3" />
      <path d="M10 13h4" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 4l2.2 4.6 5.1.7-3.7 3.6.9 5.1-4.5-2.4-4.5 2.4.9-5.1-3.7-3.6 5.1-.7L12 4z" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M7.5 3.5v3M16.5 3.5v3M3.5 9.5h17" />
      <path d="M8 13h3v3H8z" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="2.8" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.3 1.3 0 0 1-1.8 1.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V19a1.3 1.3 0 0 1-2.6 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.3 1.3 0 1 1-1.8-1.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H5a1.3 1.3 0 0 1 0-2.6h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.3 1.3 0 1 1 1.8-1.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V5a1.3 1.3 0 0 1 2.6 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.3 1.3 0 0 1 1.8 1.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H19a1.3 1.3 0 0 1 0 2.6h-.2a1 1 0 0 0-.9.6z" />
    </svg>
  );
}

function CollapseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11 17l-5-5 5-5" />
      <path d="M18 17l-5-5 5-5" />
    </svg>
  );
}

function AdminIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2L3 7v6c0 5.25 3.83 10.13 9 11 5.17-.87 9-5.75 9-11V7l-9-5z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
