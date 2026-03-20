-- CreateTable
CREATE TABLE "QuoteContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'decision_maker',
    CONSTRAINT "QuoteContact_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteCompany" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'tenant',
    CONSTRAINT "QuoteCompany_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "type" TEXT NOT NULL DEFAULT 'customer',
    "primaryCompanyId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Contact_primaryCompanyId_fkey" FOREIGN KEY ("primaryCompanyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Contact" ("createdAt", "email", "firstName", "id", "lastName", "phone", "primaryCompanyId", "type") SELECT "createdAt", "email", "firstName", "id", "lastName", "phone", "primaryCompanyId", "type" FROM "Contact";
DROP TABLE "Contact";
ALTER TABLE "new_Contact" RENAME TO "Contact";
CREATE UNIQUE INDEX "Contact_email_key" ON "Contact"("email");
CREATE TABLE "new_Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "projectType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scopeText" TEXT,
    "materialMarkupPct" REAL NOT NULL DEFAULT 10,
    "overheadPct" REAL NOT NULL DEFAULT 10,
    "profitPct" REAL NOT NULL DEFAULT 10,
    "paymentTerms" TEXT NOT NULL DEFAULT '10% due at signing. 25% due after materials purchased. Balance due net 30.',
    "exclusions" TEXT NOT NULL DEFAULT 'Plans. Permit fees. Any work not specifically described above. All valuables and personal property to be removed from work areas prior to work.',
    "notes" TEXT,
    "clientId" TEXT,
    "projectId" TEXT,
    "signingToken" TEXT,
    "signingTokenExpiresAt" DATETIME,
    "signedAt" DATETIME,
    "signedPdfPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sentAt" DATETIME,
    "estimatedDuration" TEXT,
    "estimatedStartDate" DATETIME,
    CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Quote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Quote" ("address", "clientId", "createdAt", "estimatedDuration", "estimatedStartDate", "exclusions", "id", "materialMarkupPct", "notes", "overheadPct", "paymentTerms", "profitPct", "projectId", "projectType", "scopeText", "sentAt", "signedAt", "signedPdfPath", "signingToken", "signingTokenExpiresAt", "slug", "status", "title", "updatedAt") SELECT "address", "clientId", "createdAt", "estimatedDuration", "estimatedStartDate", "exclusions", "id", "materialMarkupPct", "notes", "overheadPct", "paymentTerms", "profitPct", "projectId", "projectType", "scopeText", "sentAt", "signedAt", "signedPdfPath", "signingToken", "signingTokenExpiresAt", "slug", "status", "title", "updatedAt" FROM "Quote";
DROP TABLE "Quote";
ALTER TABLE "new_Quote" RENAME TO "Quote";
CREATE UNIQUE INDEX "Quote_slug_key" ON "Quote"("slug");
CREATE UNIQUE INDEX "Quote_signingToken_key" ON "Quote"("signingToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Note: Contract.quoteId unique constraint is retained via the inline SQLite autoindex from the prior migration.
