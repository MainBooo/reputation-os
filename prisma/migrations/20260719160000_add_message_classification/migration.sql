-- CreateEnum
CREATE TYPE "MessageClassification" AS ENUM ('OWNED_PROMO', 'CUSTOMER_REVIEW', 'CUSTOMER_COMPLAINT', 'CUSTOMER_QUESTION', 'CHAT_DISCUSSION', 'NEWS_MENTION', 'IRRELEVANT', 'SPAM');

-- CreateEnum
CREATE TYPE "MessageUrgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "Mention" ADD COLUMN     "classifiedAt" TIMESTAMP(3),
ADD COLUMN     "isInboxVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "messageClassConfidence" DECIMAL(3,2),
ADD COLUMN     "messageClassModel" TEXT,
ADD COLUMN     "messageClassReason" TEXT,
ADD COLUMN     "messageClassification" "MessageClassification",
ADD COLUMN     "messageUrgency" "MessageUrgency",
ADD COLUMN     "needsManualReview" BOOLEAN NOT NULL DEFAULT false;
