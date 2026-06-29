-- AlterTable: add YooKassa-related fields to Payment
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "confirmationUrl" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "canceledAt" TIMESTAMP(3);
