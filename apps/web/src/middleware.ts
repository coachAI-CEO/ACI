import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = new Set([
  "/",
  "/landing",
  "/pricing",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
]);

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get("accessToken")?.value;
  const nextParam = request.nextUrl.searchParams.get("next");
  const safeNext =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/app";
  const isPublicPath = PUBLIC_PATHS.has(pathname);

  // Keep auth pages inaccessible once logged in.
  if (token && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL(safeNext, request.url));
  }

  // Logged-in users land inside the product app by default.
  if (token && pathname === "/") {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  // Require auth cookie for app pages.
  if (!token && !isPublicPath) {
    const next = `${pathname}${search || ""}`;
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|images|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};
