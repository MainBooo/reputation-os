import { Injectable } from '@nestjs/common'
import { Platform } from '@prisma/client'
import { PrismaService } from '../common/prisma/prisma.service'

@Injectable()
export class RatingService {
  constructor(private readonly prisma: PrismaService) {}

  async persistSnapshot(params: {
    companyId: string
    sourceId: string
    companySourceTargetId?: string | null
    platform: Platform
    ratingValue: number
    reviewsCount?: number | null
    capturedAt: Date
    rawPayload?: unknown
    metadata?: unknown
  }) {
    const day = params.capturedAt.toISOString().slice(0, 10)
    const dedupeKey = `${params.companySourceTargetId || `${params.companyId}:${params.sourceId}`}:${day}`
    const data = {
      companyId: params.companyId,
      sourceId: params.sourceId,
      companySourceTargetId: params.companySourceTargetId || null,
      platform: params.platform,
      ratingValue: params.ratingValue,
      reviewsCount: params.reviewsCount ?? null,
      capturedAt: params.capturedAt,
      dedupeKey,
      rawPayload: params.rawPayload as any,
      metadata: params.metadata as any
    }
    return this.prisma.ratingSnapshot.upsert({
      where: { dedupeKey },
      create: data,
      update: {
        ratingValue: data.ratingValue,
        reviewsCount: data.reviewsCount,
        capturedAt: data.capturedAt,
        rawPayload: data.rawPayload,
        metadata: data.metadata
      }
    })
  }
}
