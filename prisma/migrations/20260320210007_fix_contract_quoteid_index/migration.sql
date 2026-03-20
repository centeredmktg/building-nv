-- Fix Contract.quoteId unique index: rename sqlite_autoindex_Contract_2 → Contract_quoteId_key
-- SQLite does not support DROP INDEX on autoindexes, so we recreate the table.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "projectId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "htmlPath" TEXT,
    "contractAmount" REAL,
    "signingToken" TEXT,
    "signingTokenExpiresAt" DATETIME,
    "signerName" TEXT,
    "signedAt" DATETIME,
    "signedPdfPath" TEXT,
    "signerIp" TEXT,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contract_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Contract" ("id","quoteId","projectId","status","htmlPath","contractAmount","signingToken","signingTokenExpiresAt","signerName","signedAt","signedPdfPath","signerIp","sentAt","createdAt","updatedAt") SELECT "id","quoteId","projectId","status","htmlPath","contractAmount","signingToken","signingTokenExpiresAt","signerName","signedAt","signedPdfPath","signerIp","sentAt","createdAt","updatedAt" FROM "Contract";
DROP TABLE "Contract";
ALTER TABLE "new_Contract" RENAME TO "Contract";
CREATE UNIQUE INDEX "Contract_quoteId_key" ON "Contract"("quoteId");
CREATE UNIQUE INDEX "Contract_signingToken_key" ON "Contract"("signingToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
