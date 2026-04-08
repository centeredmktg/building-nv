-- CreateTable
CREATE TABLE "DetailLibraryItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "manufacturer" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "csiDivision" TEXT,
    "csiTitle" TEXT,
    "detailType" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "tags" TEXT[],
    "isFree" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DetailLibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DetailLibraryItem_sourceUrl_key" ON "DetailLibraryItem"("sourceUrl");
