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

  private mergeMentionData(existing: {
    title?: string | null
    content?: string | null
    normalizedContent?: string | null
    author?: string | null
    url?: string | null
    publishedAt?: Date | null
    ratingValue?: any
    sentiment?: Sentiment | null
    rawPayload?: any
    metadata?: any
  }, params: {
    title?: string | null
    content: string
    normalizedContent: string
    author?: string | null
    url?: string | null
    publishedAt: Date
    ratingValue?: number | null
    rawPayload?: unknown
    metadata?: unknown
  }) {
    const nextRating = params.ratingValue ?? existing.ratingValue ?? null
    const nextPublishedAt = existing.publishedAt && params.ratingValue == null
      ? existing.publishedAt
      : params.publishedAt

    return {
      title: params.title || existing.title || null,
      content: params.content || existing.content || '',
      normalizedContent: params.normalizedContent || existing.normalizedContent || '',
      author: params.author || existing.author || null,
      url: params.url || existing.url || null,
      publishedAt: nextPublishedAt,
      ratingValue: nextRating,
      sentiment: this.classifyMentionSentiment(params.normalizedContent || existing.normalizedContent || '', nextRating),
      rawPayload: params.rawPayload as any,
      metadata: params.metadata as any,
    }
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
          data: this.mergeMentionData(existingByExternal, {
            ...params,
            normalizedContent,
          })
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

    if (existingByHash) {
      return this.prisma.mention.update({
        where: { id: existingByHash.id },
        data: this.mergeMentionData(existingByHash, {
          ...params,
          normalizedContent,
        })
      })
    }

    const contentPrefix = normalizedContent.slice(0, 160)

    const existingByAuthorAndContent = params.author && contentPrefix.length >= 80
      ? await this.prisma.mention.findFirst({
          where: {
            companyId: params.companyId,
            platform: params.platform,
            author: params.author,
            normalizedContent: {
              startsWith: contentPrefix,
            },
          },
          orderBy: { createdAt: 'asc' },
        })
      : null

    if (existingByAuthorAndContent) {
      return this.prisma.mention.update({
        where: { id: existingByAuthorAndContent.id },
        data: this.mergeMentionData(existingByAuthorAndContent, {
          ...params,
          normalizedContent,
        })
      })
    }

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
          companySourceTargetId: params.companySourceTargetId || null
      }
    })
  }
}