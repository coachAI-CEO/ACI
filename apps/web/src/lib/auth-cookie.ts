/**
 * Auth cookie helpers.
 *
 * Bug we hit in local dev: tokens were written with `Secure` but cleared
 * without it, so the old cookie survived logout and middleware kept
 * redirecting away from /login as the previous user.
 */

import { invalidateAuthMeCache } from "@/lib/auth-me";

function cookieSecureSuffix(): string {
  if (typeof window === "undefined") return "";
  // Secure cookies on http://localhost are allowed in Chromium, but clearing
  // must match how they were set. Prefer Secure only on real HTTPS.
  return window.location.protocol === "https:" ? "; Secure" : "";
}

/** Clear every accessToken cookie variant browsers may have stored. */
export function clearAccessTokenCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = "accessToken=; path=/; Max-Age=0; SameSite=Lax";
  document.cookie = "accessToken=; path=/; Max-Age=0; SameSite=Lax; Secure";
}

export function setAccessTokenCookie(token: string | null | undefined): void {
  if (typeof document === "undefined") return;
  if (!token) {
    clearAccessTokenCookie();
    return;
  }
  // Replace any prior Secure/non-Secure cookie first.
  clearAccessTokenCookie();
  document.cookie = `accessToken=${encodeURIComponent(token)}; path=/; Max-Age=604800; SameSite=Lax${cookieSecureSuffix()}`;
}

export function clearAuthStorage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  clearAccessTokenCookie();
  invalidateAuthMeCache();
}
