-- System game-model DNA templates (4 stages per GameModelId)
CREATE TABLE IF NOT EXISTS "game_model_templates" (
  "game_model_id" "GameModelId" NOT NULL,
  "label" TEXT NOT NULL,
  "summary" TEXT,
  "exclusive" BOOLEAN NOT NULL DEFAULT false,
  "attacking_organization" TEXT,
  "defensive_transition" TEXT,
  "defensive_organization" TEXT,
  "attacking_transition" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" TEXT,
  CONSTRAINT "game_model_templates_pkey" PRIMARY KEY ("game_model_id")
);
