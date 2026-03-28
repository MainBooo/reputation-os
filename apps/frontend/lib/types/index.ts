export type Platform = 'YANDEX' | 'GOOGLE' | 'TWOGIS' | 'WEB' | 'CUSTOM' | 'VK'
export type Sentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'UNKNOWN'
export type MentionStatus = 'NEW' | 'REVIEWED' | 'HIDDEN' | 'ARCHIVED'
export type MentionType = 'REVIEW' | 'ARTICLE' | 'WEB_MENTION' | 'SOCIAL_MENTION' | 'COMMENT' | 'VK_POST' | 'VK_COMMENT'
export type VkMonitoringMode = 'BRAND_SEARCH' | 'PRIORITY_COMMUNITIES' | 'OWNED_COMMUNITY'
export type VkTrackedCommunityMode = 'PRIORITY_COMMUNITY' | 'OWNED_COMMUNITY'

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

export interface VkOverviewResponse {
  trackedCommunitiesCount: number
  activeSearchProfilesCount: number
  discoveredVkPostsCount: number
  relevantVkMentionsCount: number
  recentPosts: any[]
  recentMentions: any[]
}
