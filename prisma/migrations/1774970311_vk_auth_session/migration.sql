CREATE TABLE "VkAuthSession" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "storageStatePath" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL,

  CONSTRAINT "VkAuthSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VkAuthSession_workspaceId_idx" ON "VkAuthSession"("workspaceId");
CREATE INDEX "VkAuthSession_userId_idx" ON "VkAuthSession"("userId");
