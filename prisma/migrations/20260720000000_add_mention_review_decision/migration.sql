-- CreateEnum
CREATE TYPE "MentionReviewDecision" AS ENUM ('RELEVANT', 'IRRELEVANT');

-- AlterTable
ALTER TABLE "Mention" ADD COLUMN     "reviewDecision" "MentionReviewDecision",
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "Mention_companyId_needsManualReview_idx" ON "Mention"("companyId", "needsManualReview");

-- CreateIndex
CREATE INDEX "Mention_companyId_messageClassification_idx" ON "Mention"("companyId", "messageClassification");

-- CreateIndex
CREATE INDEX "Mention_reviewedByUserId_idx" ON "Mention"("reviewedByUserId");

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
