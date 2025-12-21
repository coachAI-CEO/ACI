"use client";

import { useEffect, useRef } from "react";

interface PlayerCountInputsProps {
  minDefault: number;
  maxDefault: number;
}

export default function PlayerCountInputs({
  minDefault,
  maxDefault,
}: PlayerCountInputsProps) {
  const minInputRef = useRef<HTMLInputElement>(null);
  const maxInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const minInput = minInputRef.current;
    const maxInput = maxInputRef.current;

    if (!minInput || !maxInput) return;

    const handleMinChange = () => {
      const minValue = parseInt(minInput.value, 10);
      const maxValue = parseInt(maxInput.value, 10);

      if (!isNaN(minValue) && (isNaN(maxValue) || maxValue < minValue)) {
        maxInput.value = minValue.toString();
      }
    };

    const handleMaxChange = () => {
      const minValue = parseInt(minInput.value, 10);
      const maxValue = parseInt(maxInput.value, 10);

      if (!isNaN(minValue) && !isNaN(maxValue) && maxValue < minValue) {
        maxInput.value = minValue.toString();
      }
    };

    minInput.addEventListener("input", handleMinChange);
    maxInput.addEventListener("input", handleMaxChange);

    return () => {
      minInput.removeEventListener("input", handleMinChange);
      maxInput.removeEventListener("input", handleMaxChange);
    };
  }, []);

  return (
    <div className="flex items-center gap-2">
      <input
        ref={minInputRef}
        type="number"
        name="numbersMin"
        defaultValue={minDefault}
        min={2}
        className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px]"
      />
      <span className="text-slate-500">–</span>
      <input
        ref={maxInputRef}
        type="number"
        name="numbersMax"
        defaultValue={maxDefault}
        min={2}
        className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px]"
      />
    </div>
  );
}

