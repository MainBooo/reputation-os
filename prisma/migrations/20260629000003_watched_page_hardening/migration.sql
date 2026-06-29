-- AlterTable: add hardening fields to WatchedPage
ALTER TABLE "WatchedPage" ADD COLUMN IF NOT EXISTS "nextCheckAt" TIMESTAMP(3);
ALTER TABLE "WatchedPage" ADD COLUMN IF NOT EXISTS "etag" TEXT;
ALTER TABLE "WatchedPage" ADD COLUMN IF NOT EXISTS "lastModifiedHeader" TEXT;
ALTER TABLE "WatchedPage" ADD COLUMN IF NOT EXISTS "consecutiveErrors" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WatchedPage" ADD COLUMN IF NOT EXISTS "disabledReason" TEXT;

-- CreateIndex: for dispatcher O(log n) lookup
CREATE INDEX IF NOT EXISTS "WatchedPage_enabled_nextCheckAt_idx" ON "WatchedPage"("enabled", "nextCheckAt");
