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

export default function SessionForm({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Wait for DOM to be fully ready
    const init = () => {
      const ageGroupSelect = document.getElementById("ageGroup") as HTMLSelectElement;
      const formationAttackingSelect = document.getElementById("formationAttacking") as HTMLSelectElement;
      const formationDefendingSelect = document.getElementById("formationDefending") as HTMLSelectElement;

      if (!ageGroupSelect || !formationAttackingSelect || !formationDefendingSelect) {
        // Retry if elements not found yet
        setTimeout(init, 50);
        return;
      }

      const updateFormations = () => {
        const ageGroup = ageGroupSelect.value;
        const validFormations = getValidFormations(ageGroup);
        
        // Update attacking formation
        const currentAttackingFormation = formationAttackingSelect.value;
        const currentAttackingOptions = Array.from(formationAttackingSelect.options).map(opt => opt.value);
        const attackingOptionsMatch = currentAttackingOptions.length === validFormations.length &&
          currentAttackingOptions.every(opt => validFormations.includes(opt)) &&
          validFormations.every(opt => currentAttackingOptions.includes(opt));

        if (!attackingOptionsMatch) {
          formationAttackingSelect.innerHTML = "";
          validFormations.forEach((formation) => {
            const option = document.createElement("option");
            option.value = formation;
            option.textContent = formation;
            if (formation === currentAttackingFormation) {
              option.selected = true;
            }
            formationAttackingSelect.appendChild(option);
          });
          if (!validFormations.includes(currentAttackingFormation)) {
            formationAttackingSelect.value = getDefaultFormation(ageGroup);
          }
        }

        // Update defending formation
        const currentDefendingFormation = formationDefendingSelect.value;
        const currentDefendingOptions = Array.from(formationDefendingSelect.options).map(opt => opt.value);
        const defendingOptionsMatch = currentDefendingOptions.length === validFormations.length &&
          currentDefendingOptions.every(opt => validFormations.includes(opt)) &&
          validFormations.every(opt => currentDefendingOptions.includes(opt));

        if (!defendingOptionsMatch) {
          formationDefendingSelect.innerHTML = "";
          validFormations.forEach((formation) => {
            const option = document.createElement("option");
            option.value = formation;
            option.textContent = formation;
            if (formation === currentDefendingFormation) {
              option.selected = true;
            }
            formationDefendingSelect.appendChild(option);
          });
          if (!validFormations.includes(currentDefendingFormation)) {
            formationDefendingSelect.value = getDefaultFormation(ageGroup);
          }
        }

        // Update helper text
        const helperTexts = document.querySelectorAll(".formation-helper");
        helperTexts.forEach(helperText => {
          if (["U8", "U9", "U10", "U11", "U12"].includes(ageGroup)) {
            helperText.textContent = "7v7 formations";
          } else if (["U13", "U14"].includes(ageGroup)) {
            helperText.textContent = "9v9 formations";
          } else {
            helperText.textContent = "11v11 formations";
          }
        });
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

