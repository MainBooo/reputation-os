-- AlterEnum
-- Two new JobStatus values for Telegram Scout only (see JobStatus enum comment in
-- schema.prisma). Split into its own migration file, deliberately containing only
-- the ADD VALUE statements and nothing that uses them — Postgres forbids using a
-- newly added enum value inside the same transaction it was added in (55P04
-- "unsafe use of new value"). Application code referencing these values runs in
-- separate later transactions, so this is safe as long as this file stays
-- ADD-VALUE-only.
ALTER TYPE "JobStatus" ADD VALUE 'SKIPPED_ALREADY_RUNNING';
ALTER TYPE "JobStatus" ADD VALUE 'BLOCKED_TELEGRAM_CONNECTION';
