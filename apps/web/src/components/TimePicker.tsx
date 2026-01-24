"use client";

import { useState, useRef, useEffect } from "react";

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
}

export default function TimePicker({
  value,
  onChange,
  className = "",
  required = false,
}: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hour, setHour] = useState(() => {
    if (value) {
      const [h] = value.split(":");
      return parseInt(h, 10);
    }
    return new Date().getHours();
  });
  const [minute, setMinute] = useState(() => {
    if (value) {
      const [, m] = value.split(":");
      return parseInt(m || "0", 10);
    }
    return 0;
  });
  const [isAM, setIsAM] = useState(() => {
    if (value) {
      const [h] = value.split(":");
      return parseInt(h, 10) < 12;
    }
    return new Date().getHours() < 12;
  });
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.left,
      });
    } else {
      setPosition(null);
    }
  }, [isOpen]);

  useEffect(() => {
    // Update value when hour/minute/AM-PM changes
    const hour24 = isAM ? (hour === 12 ? 0 : hour) : (hour === 12 ? 12 : hour + 12);
    const timeString = `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    onChange(timeString);
  }, [hour, minute, isAM, onChange]);

  const formatDisplayTime = (timeString: string) => {
    if (!timeString) return "";
    const [h, m] = timeString.split(":");
    const hour24 = parseInt(h, 10);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 < 12 ? "AM" : "PM";
    return `${hour12}:${m || "00"} ${ampm}`;
  };

  const handleHourClick = (h: number) => {
    setHour(h);
  };

  const handleMinuteClick = (m: number) => {
    setMinute(m);
  };

  // Convert hour to 12-hour format for display
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

  // Generate hour options (1-12)
  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  
  // Generate minute options (0, 15, 30, 45)
  const minutes = [0, 15, 30, 45];

  return (
    <div className="relative" ref={pickerRef}>
      <input
        ref={inputRef}
        type="text"
        value={formatDisplayTime(value)}
        onClick={() => setIsOpen(!isOpen)}
        readOnly
        required={required}
        className={className}
        placeholder="Select time"
      />
      {isOpen && position && (
        <div 
          className="fixed z-[9999] bg-slate-800 border border-slate-700 rounded-lg shadow-2xl p-3 min-w-[200px]"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
        >
          {/* Current Time Display */}
          <div className="text-center mb-3 pb-2 border-b border-slate-700">
            <div className="text-lg font-bold text-slate-100 mb-1.5">
              {hour12}:{String(minute).padStart(2, "0")}
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsAM(true)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  isAM
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                }`}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => setIsAM(false)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  !isAM
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                }`}
              >
                PM
              </button>
            </div>
          </div>

          {/* Hour Selection */}
          <div className="mb-3">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              Hour
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {hours.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => handleHourClick(h)}
                  className={`h-7 rounded text-xs font-medium transition-all ${
                    hour12 === h
                      ? "bg-emerald-600 text-white font-semibold"
                      : "bg-slate-700 text-slate-200 hover:bg-slate-600"
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          {/* Minute Selection */}
          <div className="mb-3">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              Minute
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {minutes.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleMinuteClick(m)}
                  className={`h-7 rounded text-xs font-medium transition-all ${
                    minute === m
                      ? "bg-emerald-600 text-white font-semibold"
                      : "bg-slate-700 text-slate-200 hover:bg-slate-600"
                  }`}
                >
                  {String(m).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end pt-2 border-t border-slate-700">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-1.5 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
