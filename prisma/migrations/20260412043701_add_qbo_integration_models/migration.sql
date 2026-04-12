-- CreateEnum
CREATE TYPE "QboEntityType" AS ENUM ('CUSTOMER', 'PROJECT', 'INVOICE', 'PAYMENT');

-- CreateEnum
CREATE TYPE "QboSyncStatus" AS ENUM ('SUCCESS', 'FAILED', 'PENDING');

-- CreateTable
CREATE TABLE "QboConnection" (
    "id" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "companyName" TEXT NOT NULL,
    "connectedBy" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QboConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QboSyncRecord" (
    "id" TEXT NOT NULL,
    "entityType" "QboEntityType" NOT NULL,
    "localId" TEXT NOT NULL,
    "qboId" TEXT NOT NULL,
    "qboSyncToken" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncStatus" "QboSyncStatus" NOT NULL,
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QboSyncRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QboConnection_realmId_key" ON "QboConnection"("realmId");

-- CreateIndex
CREATE UNIQUE INDEX "QboSyncRecord_entityType_localId_key" ON "QboSyncRecord"("entityType", "localId");
