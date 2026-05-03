export type Platform = 'YANDEX' | 'GOOGLE' | 'TWOGIS' | 'WEB' | 'CUSTOM'
export type Sentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'UNKNOWN'
export type MentionStatus = 'NEW' | 'REVIEWED' | 'HIDDEN' | 'ARCHIVED'
export type MentionType = 'REVIEW' | 'ARTICLE' | 'WEB_MENTION' | 'SOCIAL_MENTION' | 'COMMENT'

export interface Company {
  id: string
  name: string
  website?: string | null
  city?: string | null
  industry?: string | null
  aliases?: { id: string; value: string }[]
  sourceTargets?: any[]
  _count?: { mentions: number; ratingSnapshots: number }
}

export interface Mention {
  id: string
  platform: Platform
  type: MentionType
  content: string
  author?: string | null
  publishedAt: string
  sentiment: Sentiment
  status: MentionStatus
  ratingValue?: number | null
  url?: string | null
}

