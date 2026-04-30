import { Injectable } from '@nestjs/common'
import { MentionType, Platform, Sentiment } from '@prisma/client'
import { PrismaService } from '../common/prisma/prisma.service'
import { buildMentionHash } from '../common/utils/hash.util'
import { normalizeText } from '../common/utils/normalize.util'
import { classifySentiment } from '../common/utils/sentiment.util'

@Injectable()
export class DedupService {
  constructor(private readonly prisma: PrismaService) {}

  private classifyMentionSentiment(content: string, ratingValue?: number | null): Sentiment {
    if (ratingValue !== null && ratingValue !== undefined) {
      const rating = Number(ratingValue)

      if (Number.isFinite(rating)) {
        if (rating <= 2) return 'NEGATIVE'
        if (rating >= 4) return 'POSITIVE'
        return 'NEUTRAL'
      }
    }

    return classifySentiment(content)
  }

  async persistMention(params: {
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
    vkTrackedPostId?: string | null
      companySourceTargetId?: string | null
    rawPayload?: unknown
    metadata?: unknown
  }) {
    const normalizedContent = normalizeText(params.content)

    if (params.externalMentionId) {
      const existingByExternal = await this.prisma.mention.findFirst({
        where: {
          companyId: params.companyId,
          platform: params.platform,
          externalMentionId: params.externalMentionId
        }
      })

      if (existingByExternal) {
        return this.prisma.mention.update({
          where: { id: existingByExternal.id },
          data: {
            title: params.title,
            content: params.content,
            normalizedContent,
            author: params.author,
            url: params.url,
            publishedAt: params.publishedAt,
            ratingValue: params.ratingValue,
            sentiment: this.classifyMentionSentiment(normalizedContent, params.ratingValue),
            rawPayload: params.rawPayload as any,
            metadata: params.metadata as any,
            vkTrackedPostId: params.vkTrackedPostId
          }
        })
      }
    }

    const hash = buildMentionHash({
      sourceId: params.sourceId,
      url: params.url,
      normalizedText: normalizedContent,
      publishedAt: params.publishedAt
    })

    const existingByHash = await this.prisma.mention.findFirst({
      where: { companyId: params.companyId, hash }
    })

    if (existingByHash) return existingByHash

    return this.prisma.mention.create({
      data: {
        companyId: params.companyId,
        sourceId: params.sourceId,
        platform: params.platform,
        type: params.type,
        externalMentionId: params.externalMentionId || null,
        url: params.url || null,
        title: params.title || null,
        content: params.content,
        normalizedContent,
        author: params.author || null,
        publishedAt: params.publishedAt,
        ratingValue: params.ratingValue ?? null,
        sentiment: this.classifyMentionSentiment(normalizedContent, params.ratingValue),
        status: 'NEW',
        hash,
        rawPayload: params.rawPayload as any,
        metadata: params.metadata as any,
        vkTrackedPostId: params.vkTrackedPostId || null,
          companySourceTargetId: params.companySourceTargetId || null
      }
    })
  }
}