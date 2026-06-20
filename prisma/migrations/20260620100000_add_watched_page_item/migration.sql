CREATE TABLE "WatchedPageItem" (
  "id" TEXT NOT NULL,
  "watchedPageId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "itemHash" TEXT NOT NULL,
  "itemType" TEXT NOT NULL,
  "title" TEXT,
  "content" TEXT,
  "author" TEXT,
  "ratingValue" INTEGER,
  "publishedAt" TIMESTAMP(3),
  "url" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WatchedPageItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WatchedPageItem_watchedPageId_itemHash_key" ON "WatchedPageItem"("watchedPageId", "itemHash");
CREATE INDEX "WatchedPageItem_companyId_idx" ON "WatchedPageItem"("companyId");
ALTER TABLE "WatchedPageItem" ADD CONSTRAINT "WatchedPageItem_watchedPageId_fkey" FOREIGN KEY ("watchedPageId") REFERENCES "WatchedPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchedPageItem" ADD CONSTRAINT "WatchedPageItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
