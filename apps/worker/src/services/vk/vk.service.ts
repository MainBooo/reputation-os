import { Injectable, Logger } from '@nestjs/common'
import { createHash } from 'crypto'
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

  private normalizeText(text: string | null | undefined): string {
    return String(text || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
  }

  private uniqStrings(values: Array<string | null | undefined>): string[] {
    return Array.from(
      new Set(
        values
          .map((v) => String(v || '').trim())
          .filter((v): v is string => v.length > 0)
      )
    )
  }

  private isTextRelevant(text: string | null | undefined, companyNames: string[]): { isRelevant: boolean; score: number; matchedTerms: string[] } {
    const normalizedText = this.normalizeText(text)

    if (!normalizedText) {
      return { isRelevant: false, score: 0, matchedTerms: [] }
    }

    const matchedTerms = companyNames.filter((name) => normalizedText.includes(this.normalizeText(name)))

    if (matchedTerms.length === 0) {
      return { isRelevant: false, score: 0, matchedTerms: [] }
    }

    return {
      isRelevant: true,
      score: Math.min(1, 0.5 + matchedTerms.length * 0.2),
      matchedTerms
    }
  }

  private async getCompanyMatchTerms(companyId: string): Promise<{
    company: {
      id: string
      workspaceId: string
      name: string
      aliases: Array<{ value: string }>
    } | null
    names: string[]
  }> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        aliases: {
          select: { value: true }
        }
      }
    })

    if (!company) {
      return { company: null, names: [] }
    }

    const names = this.uniqStrings([
      company.name,
      ...company.aliases.map((alias) => alias.value)
    ])

    return {
      company: {
        id: company.id,
        workspaceId: company.workspaceId,
        name: company.name,
        aliases: company.aliases
      },
      names
    }
  }

  private async resolveVkSourceId(workspaceId: string, preferredSourceId?: string): Promise<string | null> {
    if (preferredSourceId) {
      return preferredSourceId
    }

    const source = await this.prisma.source.findFirst({
      where: {
        workspaceId,
        platform: 'VK',
        isEnabled: true
      },
      orderBy: { createdAt: 'asc' }
    })

    return source?.id ?? null
  }

  private buildPostUrl(ownerId: string, postId: string): string {
    return `https://vk.com/wall${ownerId}_${postId}`
  }

  private buildCommentUrl(ownerId: string, postId: string, commentId: string): string {
    return `https://vk.com/wall${ownerId}_${postId}?reply=${commentId}`
  }

  private buildHash(parts: Array<string | number | boolean | null | undefined>): string {
    return createHash('sha256')
      .update(parts.map((part) => String(part ?? '')).join('|'))
      .digest('hex')
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

    const ownerId = String(input.post?.owner_id ?? input.post?.ownerId ?? '')
    const postId = String(input.post?.id ?? '')
    const postKey = `${ownerId}_${postId}`

    if (!ownerId || !postId) {
      this.logger.warn('upsertTrackedPost: owner_id or post.id is missing')
      return null
    }

    const text = input.post?.text ?? null
    const url = this.buildPostUrl(ownerId, postId)
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
        ownerId,
        postId,
        trackedCommunityId: input.trackedCommunityId ?? null,
        text,
        url,
        publishedAt,
        rawPayload: input.post
      },
      create: {
        ownerId,
        postId,
        companyId: input.companyId,
        trackedCommunityId: input.trackedCommunityId ?? null,
        postKey,
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

    const { company, names } = await this.getCompanyMatchTerms(input.companyId)

    if (!company) {
      return {
        ok: false,
        skipped: true,
        reason: 'company_not_found',
        vkTrackedPostId: input.vkTrackedPostId
      }
    }

    const sourceId = await this.resolveVkSourceId(company.workspaceId, input.sourceId)

    if (!sourceId) {
      this.logger.warn(`processRelevantPost: VK source not found for companyId=${input.companyId}`)
      return {
        ok: false,
        skipped: true,
        reason: 'vk_source_not_found',
        vkTrackedPostId: input.vkTrackedPostId
      }
    }

    const ownerId = String(input.post?.owner_id ?? input.post?.ownerId ?? '')
    const postId = String(input.post?.id ?? '')
    const content = String(input.post?.text ?? '')
    const normalizedContent = this.normalizeText(content)
    const publishedAt =
      input.post?.date
        ? new Date(Number(input.post.date) * 1000)
        : new Date()
    const externalMentionId = `vk_post:${ownerId}:${postId}`
    const url = ownerId && postId ? this.buildPostUrl(ownerId, postId) : null

    const result = this.isTextRelevant(content, names)
    const hash = this.buildHash([
      input.companyId,
      'VK_POST',
      ownerId,
      postId,
      normalizedContent
    ])

    await this.prisma.mention.upsert({
      where: {
        companyId_platform_externalMentionId: {
          companyId: input.companyId,
          platform: 'VK',
          externalMentionId
        }
      },
      update: {
        sourceId,
        vkTrackedPostId: input.vkTrackedPostId,
        url,
        title: null,
        content,
        normalizedContent,
        publishedAt,
        sentiment: 'UNKNOWN',
        isRelevant: result.isRelevant,
        relevanceScore: result.score,
        hash,
        rawPayload: input.post ?? null,
        metadata: {
          kind: 'vk_post',
          matchedTerms: result.matchedTerms
        }
      },
      create: {
        companyId: input.companyId,
        platform: 'VK',
        type: 'VK_POST',
        sourceId,
        vkTrackedPostId: input.vkTrackedPostId,
        externalMentionId,
        url,
        title: null,
        content,
        normalizedContent,
        publishedAt,
        sentiment: 'UNKNOWN',
        isRelevant: result.isRelevant,
        relevanceScore: result.score,
        hash,
        rawPayload: input.post ?? null,
        metadata: {
          kind: 'vk_post',
          matchedTerms: result.matchedTerms
        }
      }
    })

    await this.prisma.vkTrackedPost.update({
      where: { id: input.vkTrackedPostId },
      data: {
        discoveryStatus: result.isRelevant ? 'RELEVANT' : 'IRRELEVANT',
        relevanceScore: result.score
      }
    }).catch(() => null)

    return {
      ok: true,
      isRelevant: result.isRelevant,
      score: result.score,
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

    const { company, names } = await this.getCompanyMatchTerms(input.companyId)

    if (!company) {
      return {
        ok: false,
        skipped: true,
        reason: 'company_not_found',
        vkTrackedPostId: input.vkTrackedPostId ?? null
      }
    }

    const sourceId = await this.resolveVkSourceId(company.workspaceId, input.sourceId)

    if (!sourceId) {
      this.logger.warn(`processRelevantComment: VK source not found for companyId=${input.companyId}`)
      return {
        ok: false,
        skipped: true,
        reason: 'vk_source_not_found',
        vkTrackedPostId: input.vkTrackedPostId ?? null
      }
    }

    const ownerId = String(
      input.comment?.owner_id ??
      input.comment?.post_owner_id ??
      input.post?.owner_id ??
      ''
    )

    const postId = String(
      input.comment?.post_id ??
      input.post?.id ??
      ''
    )

    const commentId = String(input.comment?.id ?? '')
    const content = String(input.comment?.text ?? '')
    const normalizedContent = this.normalizeText(content)
    const publishedAt =
      input.comment?.date
        ? new Date(Number(input.comment.date) * 1000)
        : new Date()
    const externalMentionId = `vk_comment:${ownerId}:${postId}:${commentId}`
    const url =
      ownerId && postId && commentId
        ? this.buildCommentUrl(ownerId, postId, commentId)
        : null

      input.comment?.from_id !== undefined && input.comment?.from_id !== null
        ? String(input.comment.from_id)
        : null

    const result = this.isTextRelevant(content, names)
    const hash = this.buildHash([
      input.companyId,
      'VK_COMMENT',
      ownerId,
      postId,
      commentId,
      normalizedContent
    ])

    await this.prisma.mention.upsert({
      where: {
        companyId_platform_externalMentionId: {
          companyId: input.companyId,
          platform: 'VK',
          externalMentionId
        }
      },
      update: {
        sourceId,
        vkTrackedPostId: input.vkTrackedPostId ?? null,
        url,
        title: null,
        content,
        normalizedContent,
        publishedAt,
        sentiment: 'UNKNOWN',
        isRelevant: result.isRelevant,
        relevanceScore: result.score,
        hash,
        rawPayload: input.comment ?? null,
        metadata: {
          kind: 'vk_comment',
          matchedTerms: result.matchedTerms
        }
      },
      create: {
        companyId: input.companyId,
        platform: 'VK',
        type: 'VK_COMMENT',
        sourceId,
        vkTrackedPostId: input.vkTrackedPostId ?? null,
        externalMentionId,
        url,
        title: null,
        content,
        normalizedContent,
        publishedAt,
        sentiment: 'UNKNOWN',
        isRelevant: result.isRelevant,
        relevanceScore: result.score,
        hash,
        rawPayload: input.comment ?? null,
        metadata: {
          kind: 'vk_comment',
          matchedTerms: result.matchedTerms
        }
      }
    })

    return {
      ok: true,
      isRelevant: result.isRelevant,
      score: result.score,
      vkTrackedPostId: input.vkTrackedPostId ?? null
    }
  }
}


function sanitizeVkPostData(data: any) {
  if (!data) return data
  delete data.authorName
  delete data.author
  delete data.authorExternalId
  delete data.authorVkId
  return data
}
