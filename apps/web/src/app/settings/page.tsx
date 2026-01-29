"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Use Next.js API routes (same origin) so settings works like calendar/vault
const AUTH_ME_URL = "/api/auth/me";
const AUTH_REFRESH_URL = "/api/auth/refresh";
const AUTH_PASSWORD_CHANGE_URL = "/api/auth/password/change";

type CoachLevel = "GRASSROOTS" | "USSF_C" | "USSF_B_PLUS" | "";

interface UserProfile {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  coachLevel: CoachLevel | null;
  organizationName: string | null;
  teamAgeGroups: string[];
  preferences: Record<string, unknown> | null;
  emailVerified: boolean;
}

const AGE_GROUP_OPTIONS = ["U8", "U9", "U10", "U11", "U12", "U13", "U14", "U15", "U16", "U17", "U18"];

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  // Profile form
  const [name, setName] = useState("");
  const [coachLevel, setCoachLevel] = useState<CoachLevel>("");
  const [organizationName, setOrganizationName] = useState("");
  const [teamAgeGroups, setTeamAgeGroups] = useState<string[]>([]);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Preferences form
  const [defaultAgeGroup, setDefaultAgeGroup] = useState("");
  const [emailSessionReminders, setEmailSessionReminders] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsMessage, setPrefsMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [authErrorDetail, setAuthErrorDetail] = useState<string | null>(null);

  const runAuthCheck = useCallback(() => {
    if (typeof window === "undefined") return;
    let token = localStorage.getItem("accessToken");
    if (!token) {
      setAuthError(true);
      setAuthErrorDetail(null);
      setLoading(false);
      return;
    }

    const fetchMe = (accessToken: string) =>
      fetch(AUTH_ME_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

    const applyUser = (data: { ok?: boolean; user?: UserProfile }) => {
      if (data?.ok && data.user) {
        const u = data.user;
        setUser(u);
        setAuthError(false);
        setAuthErrorDetail(null);
        setName(u.name ?? "");
        setCoachLevel((u.coachLevel as CoachLevel) ?? "");
        setOrganizationName(u.organizationName ?? "");
        setTeamAgeGroups(Array.isArray(u.teamAgeGroups) ? u.teamAgeGroups : []);
        const prefs = (u.preferences as Record<string, unknown>) ?? {};
        setDefaultAgeGroup((prefs.defaultAgeGroup as string) ?? "");
        setEmailSessionReminders((prefs.emailSessionReminders as boolean) ?? false);
      } else {
        setAuthError(true);
        setAuthErrorDetail("Session invalid. Try logging in again.");
      }
    };

    setLoading(true);
    setAuthError(false);
    setAuthErrorDetail(null);

    fetchMe(token)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          applyUser(data);
          return;
        }
        if (res.status === 401) {
          const refreshToken = localStorage.getItem("refreshToken");
          if (refreshToken) {
            const refreshRes = await fetch(AUTH_REFRESH_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refreshToken }),
            });
            const refreshData = await refreshRes.json();
            if (refreshRes.ok && refreshData.accessToken) {
              localStorage.setItem("accessToken", refreshData.accessToken);
              const retryRes = await fetchMe(refreshData.accessToken);
              if (retryRes.ok) {
                const retryData = await retryRes.json();
                applyUser(retryData);
                return;
              }
            }
          }
          setAuthError(true);
          setAuthErrorDetail("Session expired. Please sign in again.");
          return;
        }
        if (res.status >= 500 || res.status === 0) {
          setAuthError(true);
          setAuthErrorDetail("Server unreachable. Check that the API is running and try again.");
          return;
        }
        setAuthError(true);
        setAuthErrorDetail("Could not load your account. Try signing in again.");
      })
      .catch((err) => {
        setAuthError(true);
        setAuthErrorDetail(
          err?.message?.includes("fetch") || err?.message?.includes("network")
            ? "Network error. Try again."
            : "Something went wrong. Try again or sign in."
        );
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    runAuthCheck();
  }, [runAuthCheck]);

  // Re-check when user logs in (same tab or another tab)
  useEffect(() => {
    const handleLogin = () => runAuthCheck();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "accessToken" || e.key === "user") runAuthCheck();
    };
    window.addEventListener("userLogin", handleLogin);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("userLogin", handleLogin);
      window.removeEventListener("storage", handleStorage);
    };
  }, [runAuthCheck]);

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    setProfileSaving(true);
    const token = localStorage.getItem("accessToken");
    try {
      const res = await fetch(AUTH_ME_URL, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim() || undefined,
          coachLevel: coachLevel || null,
          organizationName: organizationName.trim() || null,
          teamAgeGroups,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setProfileMessage({ type: "success", text: "Profile updated." });
        const stored = localStorage.getItem("user");
        if (stored) {
          const parsed = JSON.parse(stored);
          localStorage.setItem("user", JSON.stringify({ ...parsed, name: name.trim() || parsed.name }));
          window.dispatchEvent(new Event("userLogin"));
        }
      } else {
        setProfileMessage({ type: "error", text: data.error || "Failed to update profile" });
      }
    } catch (err: unknown) {
      setProfileMessage({ type: "error", text: "Failed to update profile" });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePreferencesSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPrefsMessage(null);
    setPrefsSaving(true);
    const token = localStorage.getItem("accessToken");
    try {
      const res = await fetch(AUTH_ME_URL, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          preferences: {
            defaultAgeGroup: defaultAgeGroup || undefined,
            emailSessionReminders: emailSessionReminders,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setPrefsMessage({ type: "success", text: "Preferences saved." });
      } else {
        setPrefsMessage({ type: "error", text: data.error || "Failed to save preferences" });
      }
    } catch {
      setPrefsMessage({ type: "error", text: "Failed to save preferences" });
    } finally {
      setPrefsSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "New passwords do not match" });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage({ type: "error", text: "New password must be at least 8 characters" });
      return;
    }
    setPasswordSaving(true);
    const token = localStorage.getItem("accessToken");
    try {
      const res = await fetch(AUTH_PASSWORD_CHANGE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setPasswordMessage({ type: "success", text: "Password changed. Please sign in again." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          localStorage.removeItem("user");
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          window.dispatchEvent(new Event("userLogin"));
          router.push("/login");
          router.refresh();
        }, 1500);
      } else {
        setPasswordMessage({ type: "error", text: data.error || "Failed to change password" });
      }
    } catch {
      setPasswordMessage({ type: "error", text: "Failed to change password" });
    } finally {
      setPasswordSaving(false);
    }
  };

  const toggleAgeGroup = (age: string) => {
    setTeamAgeGroups((prev) =>
      prev.includes(age) ? prev.filter((a) => a !== age) : [...prev, age].sort()
    );
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-slate-400">Loading...</p>
      </main>
    );
  }

  if (authError) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-6">
        <div className="text-center max-w-md space-y-4">
          <h1 className="text-xl font-semibold text-slate-200">Sign in required</h1>
          <p className="text-slate-400 text-sm">
            {authErrorDetail ?? "You need to be signed in to view settings."}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => runAuthCheck()}
              className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
            >
              Retry
            </button>
            <Link
              href="/login"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
            >
              Go to login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-10">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400">Settings</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage your profile, preferences, and account.
          </p>
        </div>

        {/* Profile */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold text-slate-200">Profile</h2>
          <p className="mt-1 text-xs text-slate-500">Name, organization, and coaching info.</p>
          <form onSubmit={handleProfileSubmit} className="mt-4 space-y-4">
            {profileMessage && (
              <div
                className={`rounded-lg border p-3 text-sm ${
                  profileMessage.type === "success"
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                    : "border-red-500/50 bg-red-500/10 text-red-300"
                }`}
              >
                {profileMessage.text}
              </div>
            )}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-50 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Your name"
                disabled={profileSaving}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
              <p className="text-slate-400 text-sm">{user?.email ?? "—"}</p>
              <p className="text-xs text-slate-500 mt-0.5">Email cannot be changed here.</p>
            </div>
            <div>
              <label htmlFor="coachLevel" className="block text-sm font-medium text-slate-300 mb-1">
                Coach level
              </label>
              <select
                id="coachLevel"
                value={coachLevel}
                onChange={(e) => setCoachLevel(e.target.value as CoachLevel)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-50 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                disabled={profileSaving}
              >
                <option value="">Not set</option>
                <option value="GRASSROOTS">Grassroots</option>
                <option value="USSF_C">USSF C</option>
                <option value="USSF_B_PLUS">USSF B+</option>
              </select>
            </div>
            <div>
              <label htmlFor="organizationName" className="block text-sm font-medium text-slate-300 mb-1">
                Organization / club
              </label>
              <input
                id="organizationName"
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-50 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Club or organization name"
                disabled={profileSaving}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Age groups you coach
              </label>
              <div className="flex flex-wrap gap-2">
                {AGE_GROUP_OPTIONS.map((age) => (
                  <button
                    key={age}
                    type="button"
                    onClick={() => toggleAgeGroup(age)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      teamAgeGroups.includes(age)
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50"
                        : "bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600"
                    }`}
                    disabled={profileSaving}
                  >
                    {age}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={profileSaving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
            >
              {profileSaving ? "Saving..." : "Save profile"}
            </button>
          </form>
        </section>

        {/* Preferences */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold text-slate-200">Preferences</h2>
          <p className="mt-1 text-xs text-slate-500">Defaults and notification options.</p>
          <form onSubmit={handlePreferencesSubmit} className="mt-4 space-y-4">
            {prefsMessage && (
              <div
                className={`rounded-lg border p-3 text-sm ${
                  prefsMessage.type === "success"
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                    : "border-red-500/50 bg-red-500/10 text-red-300"
                }`}
              >
                {prefsMessage.text}
              </div>
            )}
            <div>
              <label htmlFor="defaultAgeGroup" className="block text-sm font-medium text-slate-300 mb-1">
                Default age group
              </label>
              <select
                id="defaultAgeGroup"
                value={defaultAgeGroup}
                onChange={(e) => setDefaultAgeGroup(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-50 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                disabled={prefsSaving}
              >
                <option value="">None</option>
                {AGE_GROUP_OPTIONS.map((age) => (
                  <option key={age} value={age}>
                    {age}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">Pre-fill age group in session and drill forms.</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="emailSessionReminders"
                type="checkbox"
                checked={emailSessionReminders}
                onChange={(e) => setEmailSessionReminders(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                disabled={prefsSaving}
              />
              <label htmlFor="emailSessionReminders" className="text-sm text-slate-300">
                Email session reminders (when available)
              </label>
            </div>
            <button
              type="submit"
              disabled={prefsSaving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
            >
              {prefsSaving ? "Saving..." : "Save preferences"}
            </button>
          </form>
        </section>

        {/* Account / Password */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold text-slate-200">Account</h2>
          <p className="mt-1 text-xs text-slate-500">Change your password.</p>
          <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-4">
            {passwordMessage && (
              <div
                className={`rounded-lg border p-3 text-sm ${
                  passwordMessage.type === "success"
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                    : "border-red-500/50 bg-red-500/10 text-red-300"
                }`}
              >
                {passwordMessage.text}
              </div>
            )}
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-300 mb-1">
                Current password
              </label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-50 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
                disabled={passwordSaving}
              />
            </div>
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-slate-300 mb-1">
                New password
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-50 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="At least 8 characters"
                minLength={8}
                disabled={passwordSaving}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-1">
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-50 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Confirm new password"
                disabled={passwordSaving}
              />
            </div>
            <button
              type="submit"
              disabled={passwordSaving}
              className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
            >
              {passwordSaving ? "Updating..." : "Change password"}
            </button>
          </form>
        </section>

        <div className="text-sm text-slate-500">
          <Link href="/" className="text-emerald-400 hover:text-emerald-300">
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
