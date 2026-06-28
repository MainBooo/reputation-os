-- Add DIRECT to ChatThreadType enum
ALTER TYPE "ChatThreadType" ADD VALUE IF NOT EXISTS 'DIRECT';

-- Make workspaceId nullable in ChatThread
ALTER TABLE "ChatThread" ALTER COLUMN "workspaceId" DROP NOT NULL;

-- Make workspaceId nullable in ChatMessage
ALTER TABLE "ChatMessage" ALTER COLUMN "workspaceId" DROP NOT NULL;

-- Make workspaceId nullable in ChatReadState
ALTER TABLE "ChatReadState" ALTER COLUMN "workspaceId" DROP NOT NULL;

-- Add index on ChatThread.type
CREATE INDEX IF NOT EXISTS "ChatThread_type_idx" ON "ChatThread"("type");

-- Create ChatParticipant table
CREATE TABLE IF NOT EXISTS "ChatParticipant" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatParticipant_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint and indexes for ChatParticipant
CREATE UNIQUE INDEX IF NOT EXISTS "ChatParticipant_threadId_userId_key" ON "ChatParticipant"("threadId", "userId");
CREATE INDEX IF NOT EXISTS "ChatParticipant_userId_idx" ON "ChatParticipant"("userId");

-- Add foreign keys for ChatParticipant
ALTER TABLE "ChatParticipant" ADD CONSTRAINT "ChatParticipant_threadId_fkey"
    FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatParticipant" ADD CONSTRAINT "ChatParticipant_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
