-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('YANDEX', 'GOOGLE', 'TWOGIS', 'WEB', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('REVIEW_FEED', 'RATING_FEED', 'WEB_MENTION_FEED', 'CUSTOM_FEED');

-- CreateEnum
CREATE TYPE "MentionType" AS ENUM ('REVIEW', 'ARTICLE', 'WEB_MENTION', 'SOCIAL_MENTION', 'COMMENT');

-- CreateEnum
CREATE TYPE "MentionStatus" AS ENUM ('NEW', 'REVIEWED', 'HIDDEN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('USER', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'TELEGRAM', 'WEBHOOK', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_NEGATIVE_MENTION', 'NEW_REVIEW', 'RATING_DROP', 'DAILY_DIGEST', 'AI_REPLY_READY', 'WORKSPACE_INVITE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "systemRole" "SystemRole" NOT NULL DEFAULT 'USER',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceInvite" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "token" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "website" TEXT,
    "normalizedWebsite" TEXT,
    "city" TEXT,
    "normalizedCity" TEXT,
    "industry" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "initialSyncCompletedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAlias" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "type" "SourceType" NOT NULL,
    "baseUrl" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySourceTarget" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalPlaceId" TEXT,
    "externalUrl" TEXT,
    "displayName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "syncReviewsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncRatingsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncMentionsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySourceTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mention" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "type" "MentionType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "companySourceTargetId" TEXT,
    "externalMentionId" TEXT,
    "url" TEXT,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "normalizedContent" TEXT NOT NULL,
    "author" TEXT,
    "authorExternalId" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ratingValue" DECIMAL(3,1),
    "sentiment" "Sentiment" NOT NULL DEFAULT 'UNKNOWN',
    "status" "MentionStatus" NOT NULL DEFAULT 'NEW',
    "isRelevant" BOOLEAN NOT NULL DEFAULT true,
    "relevanceScore" DECIMAL(5,2),
    "hash" TEXT NOT NULL,
    "duplicateOfId" TEXT,
    "rawPayload" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatingSnapshot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "companySourceTargetId" TEXT,
    "platform" "Platform" NOT NULL,
    "ratingValue" DECIMAL(3,1) NOT NULL,
    "reviewsCount" INTEGER,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "rawPayload" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RatingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIReplyDraft" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "mentionId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "languageCode" TEXT NOT NULL DEFAULT 'ru',
    "tone" TEXT,
    "promptVersion" TEXT,
    "draftText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "modelName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIReplyDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "companyId" TEXT,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "channel" "NotificationChannel" NOT NULL,
    "type" "NotificationType" NOT NULL,
    "platformFilter" "Platform",
    "mentionTypeFilter" "MentionType",
    "sentimentFilter" "Sentiment",
    "sourceIdFilter" TEXT,
    "minRatingValue" DECIMAL(3,1),
    "maxRatingValue" DECIMAL(3,1),
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebPushSubscription" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "alertSentiments" TEXT[] DEFAULT ARRAY['NEGATIVE']::TEXT[],
    "lastAlertCheckedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "sourceId" TEXT,
    "triggeredByUserId" TEXT,
    "queueName" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "jobStatus" "JobStatus" NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "itemsDiscovered" INTEGER,
    "itemsCreated" INTEGER,
    "itemsUpdated" INTEGER,
    "itemsDeduped" INTEGER,
    "errorMessage" TEXT,
    "payload" JSONB,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "Workspace_slug_idx" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- CreateIndex
CREATE INDEX "WorkspaceMember_workspaceId_role_idx" ON "WorkspaceMember"("workspaceId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvite_token_key" ON "WorkspaceInvite"("token");

-- CreateIndex
CREATE INDEX "WorkspaceInvite_workspaceId_idx" ON "WorkspaceInvite"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceInvite_email_idx" ON "WorkspaceInvite"("email");

-- CreateIndex
CREATE INDEX "WorkspaceInvite_token_idx" ON "WorkspaceInvite"("token");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Company_workspaceId_idx" ON "Company"("workspaceId");

-- CreateIndex
CREATE INDEX "Company_workspaceId_isActive_idx" ON "Company"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "Company_normalizedName_idx" ON "Company"("normalizedName");

-- CreateIndex
CREATE INDEX "Company_normalizedWebsite_idx" ON "Company"("normalizedWebsite");

-- CreateIndex
CREATE INDEX "Company_normalizedCity_idx" ON "Company"("normalizedCity");

-- CreateIndex
CREATE INDEX "CompanyAlias_companyId_priority_idx" ON "CompanyAlias"("companyId", "priority");

-- CreateIndex
CREATE INDEX "CompanyAlias_normalizedValue_idx" ON "CompanyAlias"("normalizedValue");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAlias_companyId_normalizedValue_key" ON "CompanyAlias"("companyId", "normalizedValue");

-- CreateIndex
CREATE INDEX "Source_workspaceId_idx" ON "Source"("workspaceId");

-- CreateIndex
CREATE INDEX "Source_workspaceId_platform_type_idx" ON "Source"("workspaceId", "platform", "type");

-- CreateIndex
CREATE INDEX "Source_platform_type_idx" ON "Source"("platform", "type");

-- CreateIndex
CREATE INDEX "CompanySourceTarget_companyId_idx" ON "CompanySourceTarget"("companyId");

-- CreateIndex
CREATE INDEX "CompanySourceTarget_sourceId_idx" ON "CompanySourceTarget"("sourceId");

-- CreateIndex
CREATE INDEX "CompanySourceTarget_companyId_isActive_idx" ON "CompanySourceTarget"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "CompanySourceTarget_companyId_sourceId_idx" ON "CompanySourceTarget"("companyId", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySourceTarget_companyId_sourceId_externalPlaceId_key" ON "CompanySourceTarget"("companyId", "sourceId", "externalPlaceId");

-- CreateIndex
CREATE INDEX "Mention_companyId_idx" ON "Mention"("companyId");

-- CreateIndex
CREATE INDEX "Mention_companyId_publishedAt_idx" ON "Mention"("companyId", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "Mention_companyId_platform_publishedAt_idx" ON "Mention"("companyId", "platform", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "Mention_companyId_type_publishedAt_idx" ON "Mention"("companyId", "type", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "Mention_companyId_sentiment_publishedAt_idx" ON "Mention"("companyId", "sentiment", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "Mention_sourceId_publishedAt_idx" ON "Mention"("sourceId", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "Mention_companySourceTargetId_idx" ON "Mention"("companySourceTargetId");

-- CreateIndex
CREATE INDEX "Mention_externalMentionId_idx" ON "Mention"("externalMentionId");

-- CreateIndex
CREATE INDEX "Mention_hash_idx" ON "Mention"("hash");

-- CreateIndex
CREATE INDEX "Mention_duplicateOfId_idx" ON "Mention"("duplicateOfId");

-- CreateIndex
CREATE UNIQUE INDEX "mention_company_platform_external_unique" ON "Mention"("companyId", "platform", "externalMentionId");

-- CreateIndex
CREATE UNIQUE INDEX "mention_company_hash_unique" ON "Mention"("companyId", "hash");

-- CreateIndex
CREATE INDEX "RatingSnapshot_companyId_idx" ON "RatingSnapshot"("companyId");

-- CreateIndex
CREATE INDEX "RatingSnapshot_companyId_capturedAt_idx" ON "RatingSnapshot"("companyId", "capturedAt" DESC);

-- CreateIndex
CREATE INDEX "RatingSnapshot_companyId_platform_capturedAt_idx" ON "RatingSnapshot"("companyId", "platform", "capturedAt" DESC);

-- CreateIndex
CREATE INDEX "RatingSnapshot_sourceId_capturedAt_idx" ON "RatingSnapshot"("sourceId", "capturedAt" DESC);

-- CreateIndex
CREATE INDEX "RatingSnapshot_companySourceTargetId_idx" ON "RatingSnapshot"("companySourceTargetId");

-- CreateIndex
CREATE INDEX "AIReplyDraft_companyId_idx" ON "AIReplyDraft"("companyId");

-- CreateIndex
CREATE INDEX "AIReplyDraft_mentionId_idx" ON "AIReplyDraft"("mentionId");

-- CreateIndex
CREATE INDEX "AIReplyDraft_createdByUserId_idx" ON "AIReplyDraft"("createdByUserId");

-- CreateIndex
CREATE INDEX "AIReplyDraft_companyId_createdAt_idx" ON "AIReplyDraft"("companyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "NotificationRule_workspaceId_idx" ON "NotificationRule"("workspaceId");

-- CreateIndex
CREATE INDEX "NotificationRule_companyId_idx" ON "NotificationRule"("companyId");

-- CreateIndex
CREATE INDEX "NotificationRule_sourceIdFilter_idx" ON "NotificationRule"("sourceIdFilter");

-- CreateIndex
CREATE INDEX "NotificationRule_workspaceId_isActive_idx" ON "NotificationRule"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "NotificationRule_workspaceId_type_channel_idx" ON "NotificationRule"("workspaceId", "type", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "WebPushSubscription_endpoint_key" ON "WebPushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "WebPushSubscription_workspaceId_idx" ON "WebPushSubscription"("workspaceId");

-- CreateIndex
CREATE INDEX "WebPushSubscription_userId_idx" ON "WebPushSubscription"("userId");

-- CreateIndex
CREATE INDEX "WebPushSubscription_workspaceId_isActive_idx" ON "WebPushSubscription"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "WebPushSubscription_userId_isActive_idx" ON "WebPushSubscription"("userId", "isActive");

-- CreateIndex
CREATE INDEX "WebPushSubscription_workspaceId_isActive_lastAlertCheckedAt_idx" ON "WebPushSubscription"("workspaceId", "isActive", "lastAlertCheckedAt");

-- CreateIndex
CREATE INDEX "JobLog_companyId_idx" ON "JobLog"("companyId");

-- CreateIndex
CREATE INDEX "JobLog_sourceId_idx" ON "JobLog"("sourceId");

-- CreateIndex
CREATE INDEX "JobLog_triggeredByUserId_idx" ON "JobLog"("triggeredByUserId");

-- CreateIndex
CREATE INDEX "JobLog_jobStatus_idx" ON "JobLog"("jobStatus");

-- CreateIndex
CREATE INDEX "JobLog_queueName_jobName_idx" ON "JobLog"("queueName", "jobName");

-- CreateIndex
CREATE INDEX "JobLog_createdAt_idx" ON "JobLog"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAlias" ADD CONSTRAINT "CompanyAlias_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySourceTarget" ADD CONSTRAINT "CompanySourceTarget_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySourceTarget" ADD CONSTRAINT "CompanySourceTarget_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_companySourceTargetId_fkey" FOREIGN KEY ("companySourceTargetId") REFERENCES "CompanySourceTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Mention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingSnapshot" ADD CONSTRAINT "RatingSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingSnapshot" ADD CONSTRAINT "RatingSnapshot_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingSnapshot" ADD CONSTRAINT "RatingSnapshot_companySourceTargetId_fkey" FOREIGN KEY ("companySourceTargetId") REFERENCES "CompanySourceTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIReplyDraft" ADD CONSTRAINT "AIReplyDraft_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIReplyDraft" ADD CONSTRAINT "AIReplyDraft_mentionId_fkey" FOREIGN KEY ("mentionId") REFERENCES "Mention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIReplyDraft" ADD CONSTRAINT "AIReplyDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRule" ADD CONSTRAINT "NotificationRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRule" ADD CONSTRAINT "NotificationRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRule" ADD CONSTRAINT "NotificationRule_sourceIdFilter_fkey" FOREIGN KEY ("sourceIdFilter") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebPushSubscription" ADD CONSTRAINT "WebPushSubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebPushSubscription" ADD CONSTRAINT "WebPushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobLog" ADD CONSTRAINT "JobLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobLog" ADD CONSTRAINT "JobLog_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobLog" ADD CONSTRAINT "JobLog_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

