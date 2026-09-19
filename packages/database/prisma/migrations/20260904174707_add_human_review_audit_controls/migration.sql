-- CreateEnum
CREATE TYPE "AIControlState" AS ENUM ('AI_ACTIVE', 'PAUSED', 'TAKEN_OVER');

-- CreateEnum
CREATE TYPE "HumanReviewTriggerSource" AS ENUM ('RESTRICTION_CHECK', 'AI_REPLY_FLAG', 'MANUAL');

-- AlterTable
ALTER TABLE "AuditEvent" ADD COLUMN     "actorId" TEXT,
ADD COLUMN     "actorType" TEXT NOT NULL DEFAULT 'USER',
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "HumanReview" ADD COLUMN     "messageId" TEXT,
ADD COLUMN     "resolutionJustification" TEXT,
ADD COLUMN     "resolvedByUserId" TEXT,
ADD COLUMN     "restrictionCheckId" TEXT,
ADD COLUMN     "triggerSource" "HumanReviewTriggerSource" NOT NULL DEFAULT 'RESTRICTION_CHECK';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "aiControlState" "AIControlState" NOT NULL DEFAULT 'AI_ACTIVE';

-- CreateIndex
CREATE INDEX "AuditEvent_actorType_idx" ON "AuditEvent"("actorType");

-- CreateIndex
CREATE INDEX "HumanReview_messageId_idx" ON "HumanReview"("messageId");

-- CreateIndex
CREATE INDEX "HumanReview_restrictionCheckId_idx" ON "HumanReview"("restrictionCheckId");

-- CreateIndex
CREATE INDEX "HumanReview_resolvedByUserId_idx" ON "HumanReview"("resolvedByUserId");

-- CreateIndex
CREATE INDEX "HumanReview_triggerSource_idx" ON "HumanReview"("triggerSource");

-- CreateIndex
CREATE INDEX "Lead_aiControlState_idx" ON "Lead"("aiControlState");

-- AddForeignKey
ALTER TABLE "HumanReview" ADD CONSTRAINT "HumanReview_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanReview" ADD CONSTRAINT "HumanReview_restrictionCheckId_fkey" FOREIGN KEY ("restrictionCheckId") REFERENCES "RestrictionCheck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanReview" ADD CONSTRAINT "HumanReview_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
