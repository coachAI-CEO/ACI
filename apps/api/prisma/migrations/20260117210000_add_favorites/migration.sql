-- AlterTable: Add favoriteCount to Drill
ALTER TABLE "Drill" ADD COLUMN "favoriteCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Add favoriteCount to Session
ALTER TABLE "Session" ADD COLUMN "favoriteCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: User
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Favorite
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "drillId" TEXT,
    "seriesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: User email unique
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex: Favorite unique constraints
CREATE UNIQUE INDEX "Favorite_userId_sessionId_key" ON "Favorite"("userId", "sessionId");
CREATE UNIQUE INDEX "Favorite_userId_drillId_key" ON "Favorite"("userId", "drillId");
CREATE UNIQUE INDEX "Favorite_userId_seriesId_key" ON "Favorite"("userId", "seriesId");

-- CreateIndex: Favorite indexes
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");
CREATE INDEX "Favorite_sessionId_idx" ON "Favorite"("sessionId");
CREATE INDEX "Favorite_drillId_idx" ON "Favorite"("drillId");
CREATE INDEX "Favorite_seriesId_idx" ON "Favorite"("seriesId");

-- AddForeignKey: Favorite -> User
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
