-- Backward-safe billing lifecycle fields. Existing subscriptions keep their
-- current plan and nullable period start; new writes populate the fields.
ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "billingPeriod" TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS "currentPeriodStart" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "scheduledPlanId" TEXT,
  ADD COLUMN IF NOT EXISTS "scheduledBillingPeriod" TEXT,
  ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "checkoutKey" TEXT;

ALTER TABLE "AIReplyDraft"
  ADD COLUMN IF NOT EXISTS "requestId" TEXT;

ALTER TABLE "RatingSnapshot"
  ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_checkoutKey_key" ON "Payment"("checkoutKey");
CREATE UNIQUE INDEX IF NOT EXISTS "AIReplyDraft_companyId_requestId_key" ON "AIReplyDraft"("companyId", "requestId");
CREATE UNIQUE INDEX IF NOT EXISTS "RatingSnapshot_dedupeKey_key" ON "RatingSnapshot"("dedupeKey");
CREATE INDEX IF NOT EXISTS "Subscription_scheduledAt_idx" ON "Subscription"("scheduledAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_scheduledPlanId_fkey'
  ) THEN
    ALTER TABLE "Subscription"
      ADD CONSTRAINT "Subscription_scheduledPlanId_fkey"
      FOREIGN KEY ("scheduledPlanId") REFERENCES "Plan"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
