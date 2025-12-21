"use client";

import { useEffect, useState, useRef } from "react";

const FORMATION_BY_AGE: Record<string, string[]> = {
  // 7v7 formations (U8-U12)
  U8: ["2-3-1", "3-2-1"],
  U9: ["2-3-1", "3-2-1"],
  U10: ["2-3-1", "3-2-1"],
  U11: ["2-3-1", "3-2-1"],
  U12: ["2-3-1", "3-2-1"],
  // 9v9 formations (U13-U14)
  U13: ["3-2-3", "2-3-2-1", "3-3-2"],
  U14: ["3-2-3", "2-3-2-1", "3-3-2"],
  // 11v11 formations (U15-U18)
  U15: ["4-3-3", "4-2-3-1", "4-4-2", "3-5-2"],
  U16: ["4-3-3", "4-2-3-1", "4-4-2", "3-5-2"],
  U17: ["4-3-3", "4-2-3-1", "4-4-2", "3-5-2"],
  U18: ["4-3-3", "4-2-3-1", "4-4-2", "3-5-2"],
};

function getValidFormations(ageGroup: string): string[] {
  return FORMATION_BY_AGE[ageGroup] || FORMATION_BY_AGE["U10"];
}

function getDefaultFormation(ageGroup: string): string {
  const valid = getValidFormations(ageGroup);
  return valid[0] || "2-3-1";
}

function getFormationType(ageGroup: string): string {
  if (["U8", "U9", "U10", "U11", "U12"].includes(ageGroup)) {
    return "7v7 formations";
  } else if (["U13", "U14"].includes(ageGroup)) {
    return "9v9 formations";
  } else {
    return "11v11 formations";
  }
}

type FormationSelectProps = {
  ageGroup: string;
  defaultValue: string;
  name: string;
  id: string;
  className?: string;
};

export default function FormationSelect({
  ageGroup: initialAgeGroup,
  defaultValue,
  name,
  id,
  className,
}: FormationSelectProps) {
  const [currentAgeGroup, setCurrentAgeGroup] = useState(initialAgeGroup);
  const [selectedFormation, setSelectedFormation] = useState(defaultValue);
  const hasInitialized = useRef(false);

  // Read actual DOM value on mount and sync
  useEffect(() => {
    const updateFromDOM = () => {
      const ageGroupSelect = document.getElementById("ageGroup") as HTMLSelectElement;
      if (!ageGroupSelect) return;

      const domAgeGroup = ageGroupSelect.value;
      if (domAgeGroup) {
        setCurrentAgeGroup((prev) => {
          if (domAgeGroup !== prev) {
            const validFormations = getValidFormations(domAgeGroup);
            setSelectedFormation((prevForm) => {
              if (!validFormations.includes(prevForm)) {
                return getDefaultFormation(domAgeGroup);
              }
              return prevForm;
            });
            return domAgeGroup;
          }
          return prev;
        });
      }
    };

    // Try multiple times to catch DOM updates
    if (!hasInitialized.current) {
      updateFromDOM();
      const timer1 = setTimeout(updateFromDOM, 10);
      const timer2 = setTimeout(updateFromDOM, 100);
      hasInitialized.current = true;
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, []);

  // Listen for age group changes
  useEffect(() => {
    const ageGroupSelect = document.getElementById("ageGroup") as HTMLSelectElement;
    if (!ageGroupSelect) return;

    const handleChange = () => {
      const newAgeGroup = ageGroupSelect.value;
      if (newAgeGroup && newAgeGroup !== currentAgeGroup) {
        setCurrentAgeGroup(newAgeGroup);
        const validFormations = getValidFormations(newAgeGroup);
        setSelectedFormation((prev) => {
          if (!validFormations.includes(prev)) {
            return getDefaultFormation(newAgeGroup);
          }
          return prev;
        });
      }
    };

    ageGroupSelect.addEventListener("change", handleChange);
    return () => {
      ageGroupSelect.removeEventListener("change", handleChange);
    };
  }, [currentAgeGroup]);

  // Also update when prop changes (server-side update)
  useEffect(() => {
    if (initialAgeGroup !== currentAgeGroup) {
      // Check if DOM matches prop
      const ageGroupSelect = document.getElementById("ageGroup") as HTMLSelectElement;
      const domValue = ageGroupSelect?.value;
      
      // Use DOM value if available, otherwise use prop
      const ageGroupToUse = domValue || initialAgeGroup;
      if (ageGroupToUse !== currentAgeGroup) {
        setCurrentAgeGroup(ageGroupToUse);
        const validFormations = getValidFormations(ageGroupToUse);
        if (!validFormations.includes(selectedFormation)) {
          setSelectedFormation(getDefaultFormation(ageGroupToUse));
        }
      }
    }
  }, [initialAgeGroup, currentAgeGroup, selectedFormation]);

  const validFormations = getValidFormations(currentAgeGroup);
  const formationType = getFormationType(currentAgeGroup);

  return (
    <div>
      <select
        name={name}
        id={id}
        value={selectedFormation}
        onChange={(e) => setSelectedFormation(e.target.value)}
        className={className}
      >
        {validFormations.map((formation) => (
          <option key={formation} value={formation}>
            {formation}
          </option>
        ))}
      </select>
      <p className="text-[10px] text-slate-500 mt-0.5">
        {formationType}
      </p>
    </div>
  );
}
