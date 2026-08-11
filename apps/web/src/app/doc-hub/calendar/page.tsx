"use client";

import { Suspense } from "react";
import CalendarPageInner from "./CalendarPageInner";

export default function DocHubCalendarPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-slate-400">Loading calendar…</p>}
    >
      <CalendarPageInner />
    </Suspense>
  );
}
