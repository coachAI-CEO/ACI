-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sessionRefCode" TEXT,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER,
    "notes" TEXT,
    "location" TEXT,
    "teamName" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarEvent_userId_idx" ON "CalendarEvent"("userId");

-- CreateIndex
CREATE INDEX "CalendarEvent_sessionId_idx" ON "CalendarEvent"("sessionId");

-- CreateIndex
CREATE INDEX "CalendarEvent_scheduledDate_idx" ON "CalendarEvent"("scheduledDate");

-- CreateIndex
CREATE INDEX "CalendarEvent_userId_scheduledDate_idx" ON "CalendarEvent"("userId", "scheduledDate");

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
