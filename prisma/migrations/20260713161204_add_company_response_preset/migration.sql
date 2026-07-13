-- CreateEnum
CREATE TYPE "ResponsePreset" AS ENUM ('FORMAL', 'FRIENDLY', 'CONCISE');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "responsePreset" "ResponsePreset" NOT NULL DEFAULT 'FORMAL';
