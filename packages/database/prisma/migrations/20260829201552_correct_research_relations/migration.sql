/*
  Warnings:

  - Added the required column `companyId` to the `Research` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Research" DROP CONSTRAINT "Research_leadId_fkey";

-- DropIndex
DROP INDEX "Research_leadId_key";

-- AlterTable
ALTER TABLE "Research" ADD COLUMN     "companyId" TEXT NOT NULL,
ALTER COLUMN "leadId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Research_companyId_idx" ON "Research"("companyId");

-- CreateIndex
CREATE INDEX "Research_leadId_idx" ON "Research"("leadId");

-- AddForeignKey
ALTER TABLE "Research" ADD CONSTRAINT "Research_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Research" ADD CONSTRAINT "Research_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
