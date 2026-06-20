CREATE TABLE "WatchedPage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceTargetId" TEXT,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "pageType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" TIMESTAMP(3),
    "lastChangedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "contentHash" TEXT,
    "checkIntervalMin" INTEGER NOT NULL DEFAULT 1440,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WatchedPage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WatchedPage_companyId_url_key" ON "WatchedPage"("companyId", "url");
CREATE INDEX "WatchedPage_companyId_idx" ON "WatchedPage"("companyId");
CREATE INDEX "WatchedPage_enabled_lastCheckedAt_idx" ON "WatchedPage"("enabled", "lastCheckedAt");

ALTER TABLE "WatchedPage" ADD CONSTRAINT "WatchedPage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchedPage" ADD CONSTRAINT "WatchedPage_sourceTargetId_fkey" FOREIGN KEY ("sourceTargetId") REFERENCES "CompanySourceTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;
