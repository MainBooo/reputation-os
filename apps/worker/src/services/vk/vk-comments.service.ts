import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { VkService } from './vk.service'

type RunForPostPayload = {
  vkTrackedPostId?: string
  companyId?: string
  postKey?: string
}

@Injectable()
export class VkCommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vkService: VkService
  ) {}

  async runForPost(payload: string | RunForPostPayload) {
    const normalized: RunForPostPayload =
      typeof payload === 'string'
        ? { vkTrackedPostId: payload }
        : (payload ?? {})

    const trackedPost = normalized.vkTrackedPostId
      ? await this.prisma.vkTrackedPost.findUnique({
          where: { id: normalized.vkTrackedPostId },
          include: { company: true }
        })
      : normalized.companyId && normalized.postKey
        ? await this.prisma.vkTrackedPost.findUnique({
            where: {
              companyId_postKey: {
                companyId: normalized.companyId,
                postKey: normalized.postKey
              }
            },
            include: { company: true }
          })
        : null

    if (!trackedPost) return { commentsCount: 0 }

    const source = await this.prisma.source.findFirst({
      where: { workspaceId: trackedPost.company.workspaceId, platform: 'VK' }
    })
    if (!source) return { commentsCount: 0 }

    const adapter = this.vkService.getAdapter()
    const comments = await adapter.fetchCommentsForPost(trackedPost.ownerId, trackedPost.postId)

    for (const comment of comments) {
      await this.vkService.processRelevantComment({
        companyId: trackedPost.companyId,
        sourceId: source.id,
        vkTrackedPostId: trackedPost.id,
        comment
      })
    }

    await this.prisma.vkTrackedPost.update({
      where: { id: trackedPost.id },
      data: {
        commentsSyncedAt: new Date(),
        discoveryStatus: 'COMMENTS_SYNCED'
      }
    })

    return { commentsCount: comments.length }
  }
}
