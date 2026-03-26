-- CreateTable
CREATE TABLE "QuoteMilestone" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "duration" TEXT,
    "paymentPct" DOUBLE PRECISION,
    "paymentLabel" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "QuoteMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuoteMilestone_quoteId_position_key" ON "QuoteMilestone"("quoteId", "position");

-- AddForeignKey
ALTER TABLE "QuoteMilestone" ADD CONSTRAINT "QuoteMilestone_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
