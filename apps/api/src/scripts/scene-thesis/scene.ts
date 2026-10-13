import {
  extractScene,
  promptForScene,
  sceneToDrawerParams as sceneToDrawerParamsFromCard,
  type SceneDiagram,
  type SceneCard,
} from "../../services/scene-document";
import type { DrawerParams } from "../../types/drawer";
import type { ThesisIdea } from "./ideas";

export { extractScene, type SceneDiagram };

function ideaToCard(idea: ThesisIdea): SceneCard {
  return {
    title: idea.title,
    card: idea.card,
    drillType: idea.drillType,
    fieldFormat: idea.fieldFormat,
    spaceConstraint: idea.spaceConstraint,
    formationAttacking: idea.formationAttacking,
    formationDefending: idea.formationDefending,
    coachLevel: idea.coachLevel,
    picture: idea.picture,
    phase: "ATTACKING",
    zone: "MIDDLE_THIRD",
    gameModelId: "POSSESSION",
    durationMin: 12,
    rpeMin: 4,
    rpeMax: 6,
  };
}

export function promptFor(idea: ThesisIdea): string {
  return promptForScene(ideaToCard(idea));
}

export function sceneToDrawerParams(idea: ThesisIdea, scene: SceneDiagram): DrawerParams {
  return sceneToDrawerParamsFromCard(ideaToCard(idea), scene);
}
