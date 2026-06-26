-- CreateEnum
CREATE TYPE "TelegramDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "TelegramMentionDelivery" (
    "id" TEXT NOT NULL,
    "mentionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "status" "TelegramDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramMentionDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TelegramMentionDelivery_mentionId_idx" ON "TelegramMentionDelivery"("mentionId");

-- CreateIndex
CREATE INDEX "TelegramMentionDelivery_userId_idx" ON "TelegramMentionDelivery"("userId");

-- CreateIndex
CREATE INDEX "TelegramMentionDelivery_status_idx" ON "TelegramMentionDelivery"("status");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_delivery_mention_user_unique" ON "TelegramMentionDelivery"("mentionId", "userId");

-- AddForeignKey
ALTER TABLE "TelegramMentionDelivery" ADD CONSTRAINT "TelegramMentionDelivery_mentionId_fkey" FOREIGN KEY ("mentionId") REFERENCES "Mention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramMentionDelivery" ADD CONSTRAINT "TelegramMentionDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
