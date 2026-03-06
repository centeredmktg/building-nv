-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Quote" (
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
    "clientId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sentAt" DATETIME,
    CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LineItemSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "quoteId" TEXT NOT NULL,
    CONSTRAINT "LineItemSection_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'ea',
    "unitPrice" REAL NOT NULL,
    "isMaterial" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "sectionId" TEXT NOT NULL,
    CONSTRAINT "LineItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "LineItemSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Acceptance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "signerName" TEXT NOT NULL,
    "acceptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "quoteId" TEXT NOT NULL,
    CONSTRAINT "Acceptance_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Quote_slug_key" ON "Quote"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Acceptance_quoteId_key" ON "Acceptance"("quoteId");
