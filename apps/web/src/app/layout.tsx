import type { Metadata } from "next";
import "./globals.css";
import AppHeader from "@/components/AppHeader";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "TacticalEdge",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#060a13] text-slate-50 antialiased">
        <AppHeader />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
