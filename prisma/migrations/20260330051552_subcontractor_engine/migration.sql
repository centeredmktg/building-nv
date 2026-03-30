-- AlterTable
ALTER TABLE "LineItem" ADD COLUMN     "trade" TEXT;

-- AlterTable
ALTER TABLE "LineItemSection" ADD COLUMN     "trade" TEXT;

-- CreateTable
CREATE TABLE "SubcontractorProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "trades" TEXT[],
    "licenseNumber" TEXT,
    "bidLimit" DOUBLE PRECISION,
    "onboardingStatus" TEXT NOT NULL DEFAULT 'pending',
    "insuranceExpiry" TIMESTAMP(3),
    "w9OnFile" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubcontractorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactNote" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "preferred" BOOLEAN NOT NULL DEFAULT false,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubcontractorReview" (
    "id" TEXT NOT NULL,
    "subcontractorId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "timeliness" INTEGER NOT NULL,
    "communication" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "qualityOfWork" INTEGER NOT NULL,
    "wouldRehire" BOOLEAN NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubcontractorReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InHouseCapability" (
    "id" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "canPerform" BOOLEAN NOT NULL DEFAULT false,
    "capacityCheckAvailable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "InHouseCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidRequest" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "projectId" TEXT,
    "projectType" TEXT NOT NULL,
    "generalLocation" TEXT NOT NULL,
    "scopeOfWork" TEXT NOT NULL,
    "requiredTrade" TEXT NOT NULL,
    "responseDeadline" TIMESTAMP(3) NOT NULL,
    "startWindow" TEXT,
    "specialRequirements" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BidRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidInvitation" (
    "id" TEXT NOT NULL,
    "bidRequestId" TEXT NOT NULL,
    "subcontractorId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BidInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidResponse" (
    "id" TEXT NOT NULL,
    "bidInvitationId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "scopeNotes" TEXT,
    "estimatedDuration" TEXT,
    "availableStartDate" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'submitted',

    CONSTRAINT "BidResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubcontractorProfile_companyId_key" ON "SubcontractorProfile"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactNote_contactId_companyId_key" ON "ContactNote"("contactId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "SubcontractorReview_subcontractorId_projectId_key" ON "SubcontractorReview"("subcontractorId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "InHouseCapability_trade_key" ON "InHouseCapability"("trade");

-- CreateIndex
CREATE UNIQUE INDEX "BidInvitation_bidRequestId_subcontractorId_key" ON "BidInvitation"("bidRequestId", "subcontractorId");

-- CreateIndex
CREATE UNIQUE INDEX "BidResponse_bidInvitationId_key" ON "BidResponse"("bidInvitationId");

-- AddForeignKey
ALTER TABLE "SubcontractorProfile" ADD CONSTRAINT "SubcontractorProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactNote" ADD CONSTRAINT "ContactNote_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactNote" ADD CONSTRAINT "ContactNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractorReview" ADD CONSTRAINT "SubcontractorReview_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractorReview" ADD CONSTRAINT "SubcontractorReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidRequest" ADD CONSTRAINT "BidRequest_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidRequest" ADD CONSTRAINT "BidRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidInvitation" ADD CONSTRAINT "BidInvitation_bidRequestId_fkey" FOREIGN KEY ("bidRequestId") REFERENCES "BidRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidInvitation" ADD CONSTRAINT "BidInvitation_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidResponse" ADD CONSTRAINT "BidResponse_bidInvitationId_fkey" FOREIGN KEY ("bidInvitationId") REFERENCES "BidInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
