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
}

export default function AuthButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkUser = () => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        // Invalid JSON, clear it
        localStorage.removeItem("user");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        setUser(null);
      }
    } else {
      setUser(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Check on mount and when pathname changes
    checkUser();

    // Listen for custom login event (when login happens in same tab)
    const handleLogin = () => {
      checkUser();
    };
    window.addEventListener("userLogin", handleLogin);

    // Listen for storage changes (when login happens in another tab/window)
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
    setUser(null);
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return null;
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        {/* Show name/email */}
        <span className="text-xs text-slate-400 hidden sm:inline">
          {user.name || user.email}
        </span>

        {/* Admin link only for SUPER_ADMIN users */}
        {user.adminRole === "SUPER_ADMIN" && (
          <Link
            href="/admin"
            className="text-xs text-amber-300 hover:text-amber-200 transition"
          >
            ⚙️ Admin
          </Link>
        )}

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="text-xs text-slate-300 hover:text-emerald-300 transition"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/login"
      className="text-xs text-slate-300 hover:text-emerald-300 transition"
    >
      Login
    </Link>
  );
}
