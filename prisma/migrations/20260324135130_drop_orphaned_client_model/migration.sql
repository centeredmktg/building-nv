-- DropForeignKey
ALTER TABLE "Quote" DROP CONSTRAINT "Quote_clientId_fkey";

-- AlterTable
ALTER TABLE "Quote" DROP COLUMN "clientId";

-- DropTable
DROP TABLE "Client";
