"use client";

import { useEffect, useRef } from "react";

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

export default function DrillForm({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Wait for DOM to be fully ready
    const init = () => {
      const ageGroupSelect = document.getElementById("ageGroup") as HTMLSelectElement;
      const formationSelect = document.getElementById("formationUsed") as HTMLSelectElement;

      if (!ageGroupSelect || !formationSelect) {
        // Retry if elements not found yet
        setTimeout(init, 50);
        return;
      }

      const updateFormations = () => {
        const ageGroup = ageGroupSelect.value;
        const validFormations = getValidFormations(ageGroup);
        
        // Get current selected value BEFORE clearing
        const currentFormation = formationSelect.value;
        
        // Get current options
        const currentOptions = Array.from(formationSelect.options).map(opt => opt.value);
        
        // Check if update is needed - compare current options to valid formations
        const optionsMatch = currentOptions.length === validFormations.length &&
          currentOptions.every(opt => validFormations.includes(opt)) &&
          validFormations.every(opt => currentOptions.includes(opt));

        if (!optionsMatch) {
          // Clear and repopulate formation options
          formationSelect.innerHTML = "";
          validFormations.forEach((formation) => {
            const option = document.createElement("option");
            option.value = formation;
            option.textContent = formation;
            if (formation === currentFormation) {
              option.selected = true;
            }
            formationSelect.appendChild(option);
          });

          // If current formation wasn't valid, select default
          if (!validFormations.includes(currentFormation)) {
            formationSelect.value = getDefaultFormation(ageGroup);
          }
        } else {
          // Options are already correct, just ensure the selected value is valid
          if (!validFormations.includes(formationSelect.value)) {
            formationSelect.value = getDefaultFormation(ageGroup);
          }
        }

        // Update helper text
        const helperText = formationSelect.parentElement?.querySelector("p");
        if (helperText) {
          if (["U8", "U9", "U10", "U11", "U12"].includes(ageGroup)) {
            helperText.textContent = "7v7 formations";
          } else if (["U13", "U14"].includes(ageGroup)) {
            helperText.textContent = "9v9 formations";
          } else {
            helperText.textContent = "11v11 formations";
          }
        }
      };

      // Run once immediately to fix any mismatches
      updateFormations();
      
      // Listen for age group changes
      ageGroupSelect.addEventListener("change", updateFormations);
      
      return () => {
        ageGroupSelect.removeEventListener("change", updateFormations);
      };
    };

    // Use requestAnimationFrame to ensure DOM is ready
    const rafId = requestAnimationFrame(() => {
      setTimeout(init, 10);
    });

    return () => cancelAnimationFrame(rafId);
  }, []);

  return <>{children}</>;
}

