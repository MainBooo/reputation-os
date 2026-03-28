import {
  MentionStatus,
  MentionType,
  Platform,
  Sentiment,
  VkMonitoringMode,
  VkTrackedCommunityMode
} from '../enums'

export interface AuthUser {
  id: string
  email: string
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

export interface MentionFilters {
  page?: number
  limit?: number
  platform?: Platform
  sentiment?: Sentiment
  status?: MentionStatus
  from?: string
  to?: string
  type?: MentionType
}

export interface VkPostsFilters {
  mode?: VkMonitoringMode
  communityId?: string
  discoveredFrom?: string
  discoveredTo?: string
}

export interface CreateVkTrackedCommunityInput {
  mode: VkTrackedCommunityMode
  vkCommunityId: string
  screenName?: string
  title?: string
  url?: string
  isActive?: boolean
}
