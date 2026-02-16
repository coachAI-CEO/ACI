"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideShell =
    pathname === "/" ||
    pathname.startsWith("/landing") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email");
  const [collapsed, setCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  // Sync with sidebar collapsed state + viewport mode
  useEffect(() => {
    const syncCollapsed = () => {
      setCollapsed(localStorage.getItem("sidebarCollapsed") === "true");
    };
    const media = window.matchMedia("(min-width: 1024px)");
    const syncViewport = () => setIsDesktop(media.matches);

    syncCollapsed();
    syncViewport();

    window.addEventListener("storage", syncCollapsed);
    window.addEventListener("sidebarCollapsedChange", syncCollapsed);
    media.addEventListener("change", syncViewport);

    return () => {
      window.removeEventListener("storage", syncCollapsed);
      window.removeEventListener("sidebarCollapsedChange", syncCollapsed);
      media.removeEventListener("change", syncViewport);
    };
  }, []);

  if (hideShell) {
    return <>{children}</>;
  }

  return (
    <div
      className="min-h-dvh pt-14 transition-[margin] duration-300 ease-[cubic-bezier(.4,0,.2,1)] lg:pt-0"
      style={{ marginLeft: isDesktop ? (collapsed ? "4.25rem" : "14rem") : "0rem" }}
    >
      {children}
    </div>
  );
}
