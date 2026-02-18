"use client";

import { useEffect } from "react";
import { getTopicsForPhaseAndZone } from "@/data/session-topics";

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
      const ageGroupSelect = document.getElementById("ageGroup");
      const formationAttackingSelect = document.getElementById("formationAttacking");
      const formationDefendingSelect = document.getElementById("formationDefending");
      const phaseSelect = document.getElementById("phase");
      const zoneSelect = document.getElementById("zone");
      const playerLevelSelect = document.getElementById("playerLevel");
      const coachLevelSelect = document.getElementById("coachLevel");
      const topicSelect = document.getElementById("topic");

      if (
        !(ageGroupSelect instanceof HTMLSelectElement) ||
        !(formationAttackingSelect instanceof HTMLSelectElement) ||
        !(formationDefendingSelect instanceof HTMLSelectElement) ||
        !(phaseSelect instanceof HTMLSelectElement) ||
        !(zoneSelect instanceof HTMLSelectElement) ||
        !(playerLevelSelect instanceof HTMLSelectElement) ||
        !(coachLevelSelect instanceof HTMLSelectElement) ||
        !(topicSelect instanceof HTMLSelectElement)
      ) {
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

      const updateTopics = () => {
        const phase = phaseSelect.value || "ATTACKING";
        const zone = zoneSelect.value || "ATTACKING_THIRD";
        const coachLevel = coachLevelSelect.value || "GRASSROOTS";
        const validTopics = getTopicsForPhaseAndZone(phase, zone, coachLevel);
        const currentTopic = topicSelect.value;
        const currentOptions = Array.from(topicSelect.options).map(opt => opt.value);
        const topicsMatch = currentOptions.length === validTopics.length &&
          currentOptions.every(opt => validTopics.includes(opt)) &&
          validTopics.every(opt => currentOptions.includes(opt));

        if (!topicsMatch) {
          topicSelect.innerHTML = "";
          validTopics.forEach((topic) => {
            const option = document.createElement("option");
            option.value = topic;
            option.textContent = topic;
            if (topic === currentTopic) {
              option.selected = true;
            }
            topicSelect.appendChild(option);
          });
          if (!validTopics.includes(currentTopic)) {
            topicSelect.value = validTopics[0] || "";
          }
        }
      };

      const updatePlayerLevelGuardrail = () => {
        const coachLevel = coachLevelSelect.value || "GRASSROOTS";
        const isGrassroots = coachLevel === "GRASSROOTS";
        const playerOptions = Array.from(playerLevelSelect.options);

        playerLevelSelect.disabled = isGrassroots;

        playerOptions.forEach((option) => {
          option.disabled = isGrassroots && option.value !== "BEGINNER";
        });

        if (isGrassroots && playerLevelSelect.value !== "BEGINNER") {
          playerLevelSelect.value = "BEGINNER";
          playerLevelSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }

        const hint = document.getElementById("playerLevelGuardrailHint");
        if (hint) {
          hint.textContent = isGrassroots
            ? "Grassroots guardrail: player level is locked to Beginner."
            : "";
        }
      };
      const enforcePlayerLevelGuardrail = () => {
        const coachLevel = coachLevelSelect.value || "GRASSROOTS";
        if (coachLevel === "GRASSROOTS" && playerLevelSelect.value !== "BEGINNER") {
          playerLevelSelect.value = "BEGINNER";
          const hint = document.getElementById("playerLevelGuardrailHint");
          if (hint) {
            hint.textContent = "Grassroots guardrail: player level is fixed to Beginner.";
          }
        }
      };

      // Run once immediately to fix any mismatches
      updateFormations();
      updateTopics();
      updatePlayerLevelGuardrail();
      
      // Listen for changes that should impact formations/topics
      ageGroupSelect.addEventListener("change", updateFormations);
      phaseSelect.addEventListener("change", updateTopics);
      zoneSelect.addEventListener("change", updateTopics);
      coachLevelSelect.addEventListener("change", updateTopics);
      coachLevelSelect.addEventListener("change", updatePlayerLevelGuardrail);
      playerLevelSelect.addEventListener("change", enforcePlayerLevelGuardrail);
      
      return () => {
        ageGroupSelect.removeEventListener("change", updateFormations);
        phaseSelect.removeEventListener("change", updateTopics);
        zoneSelect.removeEventListener("change", updateTopics);
        coachLevelSelect.removeEventListener("change", updateTopics);
        coachLevelSelect.removeEventListener("change", updatePlayerLevelGuardrail);
        playerLevelSelect.removeEventListener("change", enforcePlayerLevelGuardrail);
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
