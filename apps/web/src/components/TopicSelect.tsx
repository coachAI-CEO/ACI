"use client";

import { useState, useEffect } from "react";
import { getTopicsForPhaseAndZone } from "@/data/session-topics";

type Props = {
  phase?: string;
  zone?: string;
  coachLevel?: string;
  defaultValue?: string;
  name?: string;
  id?: string;
  className?: string;
};

export default function TopicSelect({
  phase,
  zone,
  coachLevel,
  defaultValue,
  name = "topic",
  id = "topic",
  className,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [value, setValue] = useState(defaultValue || "");
  
  const topics = getTopicsForPhaseAndZone(phase, zone, coachLevel);

  useEffect(() => {
    setMounted(true);
    // If defaultValue is not in topics, use first topic
    if (defaultValue && topics.includes(defaultValue)) {
      setValue(defaultValue);
    } else if (topics.length > 0) {
      setValue(topics[0]);
    }
  }, [defaultValue, topics]);

  // During SSR/hydration, render a simple placeholder to avoid mismatch
  if (!mounted) {
    return (
      <select name={name} id={id} defaultValue="" className={className} suppressHydrationWarning>
        <option value="">Loading...</option>
      </select>
    );
  }

  return (
    <select 
      name={name} 
      id={id} 
      value={value} 
      onChange={(e) => setValue(e.target.value)}
      className={className}
    >
      {topics.map((topic) => (
        <option key={topic} value={topic}>
          {topic}
        </option>
      ))}
    </select>
  );
}
