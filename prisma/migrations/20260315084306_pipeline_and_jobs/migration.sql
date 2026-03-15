-- AlterTable
ALTER TABLE "Project" ADD COLUMN "contractAmount" REAL;
ALTER TABLE "Project" ADD COLUMN "estimatedCloseDate" DATETIME;
ALTER TABLE "Project" ADD COLUMN "estimatedEndDate" DATETIME;
ALTER TABLE "Project" ADD COLUMN "estimatedStartDate" DATETIME;
ALTER TABLE "Project" ADD COLUMN "targetCostAmount" REAL;
ALTER TABLE "Project" ADD COLUMN "timingNotes" TEXT;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN "estimatedDuration" TEXT;
ALTER TABLE "Quote" ADD COLUMN "estimatedStartDate" DATETIME;

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plannedDate" DATETIME,
    "completedAt" DATETIME,
    "position" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Data migration: collapse pre-contract stages
UPDATE "Project" SET "stage" = 'quote_sent' WHERE "stage" IN ('quote_requested', 'bid_delivered');
UPDATE "Project" SET "stage" = 'contract_signed' WHERE "stage" IN ('contract_completed', 'contract_sent');
