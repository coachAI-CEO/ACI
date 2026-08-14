"use client";

import { useEffect, useRef, useState } from "react";

export type BoardLoadProgress = {
  visible: boolean;
  percent: number;
  label: string;
};

function labelForElapsed(t: number): string {
  if (t < 2) return "Reading your request…";
  if (t < 6) return "Planning the scenario…";
  if (t < 14) return "Placing players & arrows…";
  if (t < 28) return "Tuning the frames…";
  return "Almost done…";
}

/**
 * Real-feel progress for board waits.
 * Advances on elapsed time (asymptotic toward ~92%), then snaps to 100%
 * when `busy` becomes false. Not streamed from the model — but tied to the
 * actual request lifecycle (starts on send, completes on response).
 */
export function useBoardLoadProgress(busy: boolean): BoardLoadProgress {
  const [visible, setVisible] = useState(false);
  const [percent, setPercent] = useState(0);
  const [label, setLabel] = useState("Starting…");
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    if (!busy) return;

    setVisible(true);
    setPercent(4);
    setLabel("Reading your request…");
    const start = Date.now();
    const id = window.setInterval(() => {
      if (!busyRef.current) return;
      const t = (Date.now() - start) / 1000;
      const p = Math.min(92, Math.round(4 + 88 * (1 - Math.exp(-t / 9))));
      setPercent(p);
      setLabel(labelForElapsed(t));
    }, 180);

    return () => window.clearInterval(id);
  }, [busy]);

  useEffect(() => {
    if (busy) return;
    if (!visible) return;

    setPercent(100);
    setLabel("Done");
    const hide = window.setTimeout(() => {
      setVisible(false);
      setPercent(0);
    }, 450);
    return () => window.clearTimeout(hide);
  }, [busy, visible]);

  return { visible, percent, label };
}
