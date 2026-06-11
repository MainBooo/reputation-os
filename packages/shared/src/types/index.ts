import {
  MentionStatus,
  MentionType,
  Platform,
  Sentiment,
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
