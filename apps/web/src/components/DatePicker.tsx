"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  className?: string;
  required?: boolean;
}

export default function DatePicker({
  value,
  onChange,
  min,
  className = "",
  required = false,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (value) {
      // Parse the date string (YYYY-MM-DD) as local date, not UTC
      const [year, month] = value.split('-').map(Number);
      return new Date(year, month - 1, 1);
    }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return "";
    // Parse the date string (YYYY-MM-DD) as local date, not UTC
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const handleDateSelect = useCallback((date: Date) => {
    // Create a new Date object to ensure we have the correct date
    const selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const day = String(selectedDate.getDate()).padStart(2, "0");
    const dateString = `${year}-${month}-${day}`;
    onChange(dateString);
    setIsOpen(false);
  }, [onChange]);

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    onChange(`${year}-${month}-${day}`);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (date: Date) => {
    if (!value) return false;
    // Parse the date string (YYYY-MM-DD) as local date, not UTC
    const [year, month, day] = value.split('-').map(Number);
    const selected = new Date(year, month - 1, day);
    return (
      date.getDate() === selected.getDate() &&
      date.getMonth() === selected.getMonth() &&
      date.getFullYear() === selected.getFullYear()
    );
  };

  const isDisabled = (date: Date) => {
    if (min) {
      // Parse the min date string (YYYY-MM-DD) as local date, not UTC
      const [year, month, day] = min.split('-').map(Number);
      const minDate = new Date(year, month - 1, day);
      minDate.setHours(0, 0, 0, 0);
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);
      return checkDate < minDate;
    }
    return false;
  };

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Calculate position for fixed positioning
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      const updatePosition = () => {
        if (inputRef.current) {
          const rect = inputRef.current.getBoundingClientRect();
          setPosition({
            top: rect.bottom + 8,
            left: rect.left,
          });
        }
      };
      
      updatePosition();
      
      // Update position on scroll or resize
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    } else {
      setPosition(null);
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={pickerRef}>
      <input
        ref={inputRef}
        type="text"
        value={formatDisplayDate(value)}
        onClick={() => setIsOpen(!isOpen)}
        readOnly
        required={required}
        className={className}
        placeholder="Select date"
      />
      {isOpen && position && (
        <div 
          className="fixed z-[9999] bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4 min-w-[280px]"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="p-1 rounded-lg hover:bg-slate-700 text-slate-300 transition-colors"
              aria-label="Previous month"
            >
              ←
            </button>
            <div className="text-sm font-semibold text-slate-200">{monthName}</div>
            <button
              type="button"
              onClick={goToNextMonth}
              className="p-1 rounded-lg hover:bg-slate-700 text-slate-300 transition-colors"
              aria-label="Next month"
            >
              →
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => (
              <div
                key={idx}
                className="text-center text-xs font-semibold text-slate-400 py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((date, idx) => {
              if (!date) {
                return <div key={`empty-${idx}`} className="h-8" />;
              }

              const disabled = isDisabled(date);
              const today = isToday(date);
              const selected = isSelected(date);
              const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

              // Create a stable date reference to avoid closure issues
              const dateValue = date.getDate();
              const dateMonth = date.getMonth();
              const dateYear = date.getFullYear();
              
              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!disabled) {
                      // Create a fresh Date object to ensure correct date
                      const selectedDate = new Date(dateYear, dateMonth, dateValue);
                      handleDateSelect(selectedDate);
                    }
                  }}
                  disabled={disabled}
                  className={`h-8 w-8 rounded-lg text-xs font-medium transition-colors ${
                    disabled
                      ? "text-slate-600 cursor-not-allowed"
                      : selected
                      ? "bg-emerald-600 text-white font-semibold"
                      : today
                      ? "bg-emerald-900/30 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/50"
                      : "text-slate-200 hover:bg-slate-700"
                  }`}
                >
                  {dateValue}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setIsOpen(false);
              }}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-semibold"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
