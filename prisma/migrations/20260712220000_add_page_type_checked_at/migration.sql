-- AlterTable
ALTER TABLE "WatchedPage" ADD COLUMN "pageTypeCheckedAt" TIMESTAMP(3);

-- Backfill: use updatedAt as the last-known detection time for existing rows,
-- so they don't all become "stale" (and get re-detected) at once right after deploy.
UPDATE "WatchedPage" SET "pageTypeCheckedAt" = "updatedAt" WHERE "pageTypeCheckedAt" IS NULL;
