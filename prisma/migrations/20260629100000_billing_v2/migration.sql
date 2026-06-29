-- Part 1: Add priceYearly to Plan
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "priceYearly" INTEGER;

-- Part 2: Add billingPeriod to Payment
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "billingPeriod" TEXT NOT NULL DEFAULT 'monthly';

-- Part 3: Add SUBSCRIPTION_REMINDER to NotificationType enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SUBSCRIPTION_REMINDER' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType')) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_REMINDER';
  END IF;
END $$;

-- Part 4: Add index on Subscription.trialEndsAt
CREATE INDEX IF NOT EXISTS "Subscription_status_trialEndsAt_idx" ON "Subscription"("status", "trialEndsAt");

-- Part 5: Create SubscriptionReminderLog table
CREATE TABLE IF NOT EXISTS "SubscriptionReminderLog" (
  "id"             TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "reminderType"   TEXT NOT NULL,
  "daysBefore"     INTEGER NOT NULL,
  "periodEndDate"  TIMESTAMP(3) NOT NULL,
  "sentAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "channels"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  CONSTRAINT "SubscriptionReminderLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionReminderLog_unique_key"
  ON "SubscriptionReminderLog"("subscriptionId", "reminderType", "daysBefore", "periodEndDate");

CREATE INDEX IF NOT EXISTS "SubscriptionReminderLog_sentAt_idx"
  ON "SubscriptionReminderLog"("sentAt" DESC);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SubscriptionReminderLog_subscriptionId_fkey'
  ) THEN
    ALTER TABLE "SubscriptionReminderLog"
      ADD CONSTRAINT "SubscriptionReminderLog_subscriptionId_fkey"
      FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
