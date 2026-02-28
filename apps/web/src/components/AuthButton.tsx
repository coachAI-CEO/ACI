"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  subscriptionPlan: string;
  adminRole?: string | null;
  emailVerified?: boolean;
}

export default function AuthButton({ compact = false }: { compact?: boolean }) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [resendVerificationState, setResendVerificationState] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [resendVerificationLoading, setResendVerificationLoading] = useState(false);

  const checkUser = () => {
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("accessToken");
    if (token) {
      document.cookie = `accessToken=${encodeURIComponent(token)}; path=/; Max-Age=604800; SameSite=Lax; Secure`;
    } else {
      document.cookie = "accessToken=; path=/; Max-Age=0; SameSite=Lax";
    }
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem("user");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        document.cookie = "accessToken=; path=/; Max-Age=0; SameSite=Lax";
        setUser(null);
      }
    } else {
      setUser(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    checkUser();

    const handleLogin = () => {
      checkUser();
    };
    window.addEventListener("userLogin", handleLogin);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "user") {
        checkUser();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("userLogin", handleLogin);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    document.cookie = "accessToken=; path=/; Max-Age=0; SameSite=Lax";
    setUser(null);
    setMenuOpen(false);
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return null;
  }

  const handleResendVerification = async () => {
    setResendVerificationState(null);
    setResendVerificationLoading(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      const res = await fetch(`${apiBase}/auth/resend-verification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setResendVerificationState({
          type: "success",
          message: "Verification email sent. Please check your inbox.",
        });
      } else {
        setResendVerificationState({
          type: "error",
          message: data.error || "Failed to send verification email",
        });
      }
    } catch {
      setResendVerificationState({
        type: "error",
        message: "Failed to send verification email",
      });
    } finally {
      setResendVerificationLoading(false);
    }
  };

  // Get user initials for avatar
  const getInitials = (u: User) => {
    if (u.name) {
      return u.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
    }
    return u.email[0].toUpperCase();
  };

  if (user) {
    // Compact mode: just show avatar circle
    if (compact) {
      return (
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/25 transition hover:bg-emerald-500/30 hover:ring-emerald-400/40"
            title={user.name || user.email}
          >
            {getInitials(user)}
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute bottom-full left-0 mb-2 z-50 w-48 rounded-xl border border-white/[0.08] bg-[#0f1520] p-2 shadow-2xl shadow-black/50">
                <p className="px-3 py-1.5 text-xs text-slate-400 truncate">{user.name || user.email}</p>
                {resendVerificationState && (
                  <p
                    className={`mx-2 mb-1 rounded-md px-2 py-1 text-[11px] ${
                      resendVerificationState.type === "success"
                        ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border border-red-500/40 bg-red-500/10 text-red-300"
                    }`}
                  >
                    {resendVerificationState.message}
                  </p>
                )}
                {user.emailVerified === false && (
                  <button
                    onClick={handleResendVerification}
                    disabled={resendVerificationLoading}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-amber-300 transition hover:bg-white/[0.04]"
                  >
                    {resendVerificationLoading ? "Sending..." : "Verify Email"}
                  </button>
                )}
                {user.adminRole === "SUPER_ADMIN" && (
                  <Link
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-amber-300 transition hover:bg-white/[0.04]"
                  >
                    Admin Panel
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/[0.04] hover:text-red-300"
                >
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      );
    }

    // Expanded mode: show user row
    return (
      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 transition hover:bg-white/[0.04]"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-500/25">
            {getInitials(user)}
          </span>
          <span className="flex-1 text-left min-w-0">
            <span className="block truncate text-[13px] font-medium text-slate-200">
              {user.name || user.email.split("@")[0]}
            </span>
            <span className="block truncate text-[11px] text-slate-500">
              {user.email}
            </span>
          </span>
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute bottom-full left-0 mb-2 z-50 w-full rounded-xl border border-white/[0.08] bg-[#0f1520] p-1.5 shadow-2xl shadow-black/50">
              {resendVerificationState && (
                <p
                  className={`mx-1.5 mb-1 rounded-md px-2 py-1 text-[11px] ${
                    resendVerificationState.type === "success"
                      ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border border-red-500/40 bg-red-500/10 text-red-300"
                  }`}
                >
                  {resendVerificationState.message}
                </p>
              )}
              {user.emailVerified === false && (
                <button
                  onClick={handleResendVerification}
                  disabled={resendVerificationLoading}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-amber-300 transition hover:bg-white/[0.04]"
                >
                  {resendVerificationLoading ? "Sending..." : "Verify Email"}
                </button>
              )}
              {user.adminRole === "SUPER_ADMIN" && (
                <Link
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-amber-300 transition hover:bg-white/[0.04]"
                >
                  Admin Panel
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-300 transition hover:bg-white/[0.04] hover:text-red-300"
              >
                Log out
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Not logged in
  if (compact) {
    return (
      <Link
        href="/login"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-slate-400 ring-1 ring-white/[0.08] transition hover:bg-white/[0.1] hover:text-slate-200"
        title="Login"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="8" r="4" />
          <path d="M5.5 20.5c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" />
        </svg>
      </Link>
    );
  }

  return (
    <Link
      href="/login"
      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-400 transition hover:bg-white/[0.04] hover:text-slate-200"
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="4" />
        <path d="M5.5 20.5c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" />
      </svg>
      <span>Login</span>
    </Link>
  );
}
