-- AlterTable
ALTER TABLE "Project" ADD COLUMN "hazardNotes" TEXT;
ALTER TABLE "Project" ADD COLUMN "siteAddress" TEXT;
ALTER TABLE "Project" ADD COLUMN "siteCity" TEXT;
ALTER TABLE "Project" ADD COLUMN "siteState" TEXT;
ALTER TABLE "Project" ADD COLUMN "siteZip" TEXT;

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "hireDate" DATETIME NOT NULL,
    "employmentType" TEXT NOT NULL,
    "tradeClassification" TEXT NOT NULL,
    "activeStatus" TEXT NOT NULL DEFAULT 'active',
    "terminatedAt" DATETIME,
    "homeAddress" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "ec1Name" TEXT NOT NULL,
    "ec1Relationship" TEXT NOT NULL,
    "ec1Phone" TEXT NOT NULL,
    "ec2Name" TEXT,
    "ec2Relationship" TEXT,
    "ec2Phone" TEXT,
    "driversLicenseNumber" TEXT,
    "driversLicenseExpiry" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "issueDate" DATETIME NOT NULL,
    "expirationDate" DATETIME,
    "cardPhotoUrl" TEXT,
    "verifiedStatus" TEXT NOT NULL DEFAULT 'unverified',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Certification_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OnboardingStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "stepName" TEXT NOT NULL,
    "completedAt" DATETIME,
    "signerName" TEXT,
    "ipAddress" TEXT,
    CONSTRAINT "OnboardingStep_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OnboardingInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "contactId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProjectTeamMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'worker',
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectTeamMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectTeamMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Component" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "vendorSku" TEXT,
    "vendorCost" REAL NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'ea',
    "vendorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sdsUrl" TEXT,
    "isHazardous" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Component_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Component" ("category", "createdAt", "description", "id", "name", "unit", "updatedAt", "vendorCost", "vendorId", "vendorSku") SELECT "category", "createdAt", "description", "id", "name", "unit", "updatedAt", "vendorCost", "vendorId", "vendorSku" FROM "Component";
DROP TABLE "Component";
ALTER TABLE "new_Component" RENAME TO "Component";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Employee_contactId_key" ON "Employee"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingStep_employeeId_stepName_key" ON "OnboardingStep"("employeeId", "stepName");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingInvite_token_key" ON "OnboardingInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTeamMember_projectId_employeeId_key" ON "ProjectTeamMember"("projectId", "employeeId");
