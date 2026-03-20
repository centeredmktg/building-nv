-- AlterTable
ALTER TABLE "Quote" ADD COLUMN "signingToken" TEXT;
ALTER TABLE "Quote" ADD COLUMN "signingTokenExpiresAt" DATETIME;
ALTER TABLE "Quote" ADD COLUMN "signedAt" DATETIME;
ALTER TABLE "Quote" ADD COLUMN "signedPdfPath" TEXT;

-- AlterTable
ALTER TABLE "Acceptance" ADD COLUMN "signaturePngPath" TEXT;

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL UNIQUE,
    "projectId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "htmlPath" TEXT,
    "contractAmount" REAL,
    "signingToken" TEXT UNIQUE,
    "signingTokenExpiresAt" DATETIME,
    "signerName" TEXT,
    "signedAt" DATETIME,
    "signedPdfPath" TEXT,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contract_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT "Contract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON UPDATE CASCADE ON DELETE SET NULL
);

-- CreateTable
CREATE TABLE "ChangeOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "scopeDelta" TEXT NOT NULL,
    "priceDelta" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "htmlPath" TEXT,
    "signingToken" TEXT UNIQUE,
    "signingTokenExpiresAt" DATETIME,
    "signerName" TEXT,
    "signedAt" DATETIME,
    "signedPdfPath" TEXT,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChangeOrder_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON UPDATE CASCADE ON DELETE RESTRICT
);

-- CreateIndex
CREATE UNIQUE INDEX "Quote_signingToken_key" ON "Quote"("signingToken");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_signingToken_key" ON "Contract"("signingToken");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeOrder_signingToken_key" ON "ChangeOrder"("signingToken");
