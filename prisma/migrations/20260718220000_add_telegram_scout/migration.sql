-- CreateEnum
CREATE TYPE "TelegramDiscoveryMethod" AS ENUM ('GLOBAL_CHANNEL_SEARCH', 'GLOBAL_GROUP_SEARCH', 'PUBLIC_POST_SEARCH', 'ENTITY_SEARCH', 'WEB_DISCOVERY', 'MANUAL', 'AI_DISCOVERY');

-- AlterEnum
ALTER TYPE "Platform" ADD VALUE 'TELEGRAM';

-- AlterEnum
ALTER TYPE "SourceType" ADD VALUE 'SOCIAL_MENTION_FEED';

-- AlterTable
ALTER TABLE "CompanyAlias" ADD COLUMN     "isExcluded" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Mention" ADD COLUMN     "matchedQuery" TEXT;

-- CreateTable
CREATE TABLE "TelegramChannel" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "username" TEXT,
    "title" TEXT,
    "entityType" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "lastFetchedMessageId" INTEGER,
    "lastFetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyTelegramChannel" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "telegramChannelId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "discoveryMethod" "TelegramDiscoveryMethod" NOT NULL,
    "matchedQuery" TEXT,
    "lastMessageId" INTEGER,
    "checkIntervalMin" INTEGER NOT NULL DEFAULT 360,
    "nextCheckAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "consecutiveErrors" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastDecisionReason" TEXT,
    "relevanceScore" DECIMAL(5,2),
    "mentionsFoundCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyTelegramChannel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramChannel_chatId_key" ON "TelegramChannel"("chatId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramChannel_username_key" ON "TelegramChannel"("username");

-- CreateIndex
CREATE INDEX "TelegramChannel_entityType_idx" ON "TelegramChannel"("entityType");

-- CreateIndex
CREATE INDEX "CompanyTelegramChannel_enabled_nextCheckAt_idx" ON "CompanyTelegramChannel"("enabled", "nextCheckAt");

-- CreateIndex
CREATE INDEX "CompanyTelegramChannel_companyId_idx" ON "CompanyTelegramChannel"("companyId");

-- CreateIndex
CREATE INDEX "CompanyTelegramChannel_telegramChannelId_idx" ON "CompanyTelegramChannel"("telegramChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyTelegramChannel_companyId_telegramChannelId_key" ON "CompanyTelegramChannel"("companyId", "telegramChannelId");

-- AddForeignKey
ALTER TABLE "CompanyTelegramChannel" ADD CONSTRAINT "CompanyTelegramChannel_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyTelegramChannel" ADD CONSTRAINT "CompanyTelegramChannel_telegramChannelId_fkey" FOREIGN KEY ("telegramChannelId") REFERENCES "TelegramChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
