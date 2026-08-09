"use client";

import { useEffect } from "react";
import { getTopicsForPhaseAndZone } from "@/data/session-topics";

const FORMATION_BY_AGE: Record<string, string[]> = {
  // 7v7 formations (U8-U10)
  U8: ["2-3-1", "3-2-1"],
  U9: ["2-3-1", "3-2-1"],
  U10: ["2-3-1", "3-2-1"],
  // 9v9 formations (U11-U12)
  U11: ["3-2-3", "2-3-2-1", "3-3-2"],
  U12: ["3-2-3", "2-3-2-1", "3-3-2"],
  // 11v11 formations (U13-U18)
  U13: ["4-3-3", "4-2-3-1", "4-4-2", "3-5-2"],
  U14: ["4-3-3", "4-2-3-1", "4-4-2", "3-5-2"],
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
          if (["U8", "U9", "U10"].includes(ageGroup)) {
            helperText.textContent = "7v7 formations";
          } else if (["U11", "U12"].includes(ageGroup)) {
            helperText.textContent = "9v9 formations";
          } else {
            helperText.textContent = "11v11 formations";
          }
        });
      };

      const updateTopics = () => {
        const phase = phaseSelect.value || "ATTACKING";
        const zone = zoneSelect.value || "ATTACKING_THIRD";
        const coachLevel = coachLevelSelect.value || "USSF_D";
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


      // USSF_C and USSF_B_PLUS coaches are never paired with Beginner
      // players -- these licenses coach competitive teams in practice, and
      // it's also the one combination that tested unreliably across every
      // model (advanced tactical vocabulary fighting genuinely simple
      // constraints in the same output). Disable the option rather than
      // hide it, so it's clear it's a rule, not a missing choice.
      const updatePlayerLevelOptions = () => {
        const coachLevel = coachLevelSelect.value || "USSF_D";
        const beginnerOption = Array.from(playerLevelSelect.options).find((opt) => opt.value === "BEGINNER");
        if (!beginnerOption) return;
        const beginnerAllowed = coachLevel === "USSF_D";
        beginnerOption.disabled = !beginnerAllowed;
        if (!beginnerAllowed && playerLevelSelect.value === "BEGINNER") {
          playerLevelSelect.value = "INTERMEDIATE";
          playerLevelSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
        const hint = document.getElementById("playerLevelRuleHint");
        if (hint) {
          hint.textContent = beginnerAllowed
            ? ""
            : `${coachLevel === "USSF_C" ? "USSF C" : "USSF B+"} coaches are paired with Intermediate or Advanced players.`;
        }
      };

      // Run once immediately to fix any mismatches
      updateFormations();
      updateTopics();
      updatePlayerLevelOptions();

      // Listen for changes that should impact formations/topics
      ageGroupSelect.addEventListener("change", updateFormations);
      phaseSelect.addEventListener("change", updateTopics);
      zoneSelect.addEventListener("change", updateTopics);
      coachLevelSelect.addEventListener("change", updateTopics);
      coachLevelSelect.addEventListener("change", updatePlayerLevelOptions);

      return () => {
        ageGroupSelect.removeEventListener("change", updateFormations);
        phaseSelect.removeEventListener("change", updateTopics);
        zoneSelect.removeEventListener("change", updateTopics);
        coachLevelSelect.removeEventListener("change", updateTopics);
        coachLevelSelect.removeEventListener("change", updatePlayerLevelOptions);
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
