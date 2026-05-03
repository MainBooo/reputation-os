import { Injectable } from '@nestjs/common'
import { MentionType, Platform } from '@prisma/client'
import { DedupService } from './dedup.service'

@Injectable()
export class MentionService {
  constructor(private readonly dedupService: DedupService) {}

  async persistExternalMention(params: {
    companyId: string
    sourceId: string
    platform: Platform
    type: MentionType
    externalMentionId?: string | null
    url?: string | null
    title?: string | null
    content: string
    author?: string | null
    publishedAt: Date
    ratingValue?: number | null
    rawPayload?: unknown
    metadata?: unknown
    companySourceTargetId?: string | null
  }) {
    return this.dedupService.persistMention(params)
  }
}