import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { VkAdapter } from '../../adapters/vk.adapter'

@Injectable()
export class VkService {
  private readonly logger = new Logger(VkService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly adapter: VkAdapter
  ) {}

  getAdapter(): VkAdapter {
    return this.adapter
  }

  getPrisma(): PrismaService {
    return this.prisma
  }

  async upsertTrackedPost(input: {
    companyId: string
    trackedCommunityId?: string
    post: any
  }) {
    const prismaAny = this.prisma as any

    if (!prismaAny?.vkTrackedPost?.upsert) {
      this.logger.warn('vkTrackedPost.upsert is not available on PrismaService')
      return {
        id: `${input.companyId}:${input.post?.owner_id ?? 'unknown'}:${input.post?.id ?? Date.now()}`
      }
    }

    const ownerId = String(
      input.post?.owner_id ??
      input.post?.ownerId ??
      ''
    )

    const postId = String(
      input.post?.id ??
      ''
    )

    const postKey = `${ownerId}_${postId}`

    if (!ownerId || !postId) {
      this.logger.warn('upsertTrackedPost: owner_id or post.id is missing')
      return null
    }

    const text = input.post?.text ?? null
    const url = `https://vk.com/wall${postKey}`
    const publishedAt =
      input.post?.date
        ? new Date(Number(input.post.date) * 1000)
        : new Date()

    return prismaAny.vkTrackedPost.upsert({
      where: {
        companyId_postKey: {
          companyId: input.companyId,
          postKey
        }
      },
      update: {
        trackedCommunityId: input.trackedCommunityId ?? null,
        authorName: null,
        authorVkId: ownerId,
        text,
        url,
        publishedAt,
        rawPayload: input.post
      },
      create: {
        companyId: input.companyId,
        trackedCommunityId: input.trackedCommunityId ?? null,
        postKey,
        authorName: null,
        authorVkId: ownerId,
        text,
        url,
        publishedAt,
        rawPayload: input.post
      }
    }).catch((error: any) => {
      this.logger.error(`upsertTrackedPost failed: ${error?.message || error}`)
      return null
    })
  }

  async processRelevantPost(input: {
    companyId: string
    sourceId?: string
    vkTrackedPostId: string
    post: any
  }) {
    this.logger.log(
      `processRelevantPost companyId=${input.companyId} sourceId=${input.sourceId || '-'} vkTrackedPostId=${input.vkTrackedPostId}`
    )

    return {
      ok: true,
      vkTrackedPostId: input.vkTrackedPostId
    }
  }

  async processRelevantComment(input: {
    companyId: string
    sourceId?: string
    vkTrackedPostId?: string
    comment: any
    post?: any
  }) {
    this.logger.log(
      `processRelevantComment companyId=${input.companyId} sourceId=${input.sourceId || '-'} vkTrackedPostId=${input.vkTrackedPostId || '-'}`
    )

    return {
      ok: true,
      vkTrackedPostId: input.vkTrackedPostId ?? null
    }
  }

}
