ALTER TABLE "Drill"
ADD COLUMN "diagramSvg" TEXT,
ADD COLUMN "diagramSvgGeneratedAt" TIMESTAMP(3),
ADD COLUMN "diagramSvgModel" TEXT,
ADD COLUMN "diagramSvgPromptVersion" TEXT;
