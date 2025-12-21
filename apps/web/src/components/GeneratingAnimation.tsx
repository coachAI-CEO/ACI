"use client";

import { useEffect, useState } from "react";

export default function GeneratingAnimation() {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev.length >= 3) return "";
        return prev + ".";
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-slate-700 border-t-green-500"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 rounded-full bg-green-500/20"></div>
          </div>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-100">Generating Drill{dots}</p>
          <p className="mt-2 text-sm text-slate-400">This may take 30-60 seconds</p>
        </div>
      </div>
    </div>
  );
}

