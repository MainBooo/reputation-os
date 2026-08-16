import { Prisma } from '@prisma/client'

export const IRRELEVANT_BUCKET: Prisma.MentionWhereInput = {
  OR: [
    {
      AND: [
        { messageClassification: 'IRRELEVANT' },
        { OR: [{ reviewDecision: null }, { NOT: { reviewDecision: 'RELEVANT' } }] }
      ]
    },
    { reviewDecision: 'IRRELEVANT' }
  ]
}

export const RELEVANT_BUCKET: Prisma.MentionWhereInput = {
  AND: [
    { OR: [{ reviewDecision: null }, { NOT: { reviewDecision: 'IRRELEVANT' } }] },
    {
      OR: [
        { messageClassification: null },
        { NOT: { messageClassification: 'IRRELEVANT' } },
        { reviewDecision: 'RELEVANT' }
      ]
    }
  ]
}

/** Canonical set used by Inbox, analytics and reports. */
export const USER_RELEVANT_MENTION: Prisma.MentionWhereInput = {
  isInboxVisible: true,
  needsManualReview: false,
  AND: [RELEVANT_BUCKET]
}
