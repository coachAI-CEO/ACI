import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import AuthButton from "@/components/AuthButton";

export const metadata: Metadata = {
  title: "ACI Drill Diagrams",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-50 antialiased">
        <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300">
              ACI Training Platform
            </Link>
            <nav className="flex items-center gap-4 text-xs text-slate-300">
              <Link href="/" className="hover:text-emerald-300">🏠 Home</Link>
              <Link href="/demo/drill" className="hover:text-emerald-300">🧩 Drill Generator</Link>
              <Link href="/demo/session" className="hover:text-emerald-300">📋 Session Generator</Link>
              <Link href="/vault" className="hover:text-emerald-300">🗂️ Vault</Link>
              <Link href="/vault/favorites" className="hover:text-emerald-300">■ Favorites</Link>
              <Link href="/calendar" className="hover:text-emerald-300">📅 Calendar</Link>
              <AuthButton />
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
