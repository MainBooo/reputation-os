import { Injectable, Logger } from '@nestjs/common'
import { MentionType, Platform, SourceType, VkMonitoringMode } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { MentionService } from '../mention.service'
import { VkPlaywrightSearchService } from './vk-playwright-search.service'
import { VkRelevanceService, VkCompanySearchProfile } from './vk-relevance.service'

@Injectable()
export class VkPostSearchService {
  private readonly logger = new Logger(VkPostSearchService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly mentionService: MentionService,
    private readonly searchService: VkPlaywrightSearchService,
    private readonly relevanceService: VkRelevanceService
  ) {}

  private uniq(values: Array<string | null | undefined>): string[] {
    return Array.from(
      new Set(
        values
          .map((v) => String(v || '').trim())
          .filter(Boolean)
      )
    )
  }

  private async ensureSource(workspaceId: string) {
    const existing = await this.prisma.source.findFirst({
      where: {
        workspaceId,
        platform: 'VK',
        type: 'VK_BRAND_SEARCH'
      },
      orderBy: { createdAt: 'asc' }
    })

    if (existing) return existing

    return this.prisma.source.create({
      data: {
        workspaceId,
        name: 'VK Post Search',
        platform: Platform.VK,
        type: SourceType.VK_BRAND_SEARCH,
        baseUrl: 'https://vk.com',
        isEnabled: true,
        config: {
          kind: 'playwright_post_search'
        } as any
      }
    })
  }

  async processJob(params: { companyId: string; triggeredByUserId?: string }) {
    const company = await this.prisma.company.findUnique({
      where: { id: params.companyId },
      include: {
        aliases: {
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }]
        },
        vkSearchProfiles: {
          where: {
            isActive: true,
            mode: VkMonitoringMode.BRAND_SEARCH
          },
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }]
        }
      }
    })

    if (!company) {
      this.logger.warn(`company not found: ${params.companyId}`)
      return { ok: false, skipped: true, reason: 'company_not_found' }
    }

    const config = (company.vkPostSearchConfig || {}) as Record<string, unknown>

    const profile: VkCompanySearchProfile = {
      includeKeywords: company.vkSearchProfiles.map((item) => item.query),
      excludeKeywords: Array.isArray(config.excludeKeywords) ? config.excludeKeywords as string[] : [],
      contextKeywords: Array.isArray(config.contextKeywords) ? config.contextKeywords as string[] : [],
      geoKeywords: Array.isArray(config.geoKeywords) ? config.geoKeywords as string[] : [],
      category: typeof config.category === 'string' ? config.category : null
    }

    const aliases = this.uniq([
      company.name,
      ...company.aliases.map((alias) => alias.value),
      ...company.vkSearchProfiles.map((item) => item.query)
    ])

    if (aliases.length === 0) {
      return { ok: false, skipped: true, reason: 'empty_queries' }
    }

    const source = await this.ensureSource(company.workspaceId)
    const found = await this.searchService.searchPosts(aliases, company.workspaceId)

    let relevantPosts = 0
    let relevantComments = 0

    for (const post of found) {
      const postScore = this.relevanceService.score(post.text || '', aliases, profile)

      if (postScore.decision === 'RELEVANT') {
        await this.mentionService.persistExternalMention({
          companyId: company.id,
          sourceId: source.id,
          platform: Platform.VK,
          type: MentionType.VK_POST,
          externalMentionId: `vk:post:${post.ownerId}:${post.postId}`,
          url: post.url,
          title: null,
          content: post.text || '',
          author: post.author,
          publishedAt: post.publishedAt,
          rawPayload: post.rawPayload,
          metadata: {
            relevanceScore: postScore.score,
            relevanceDecision: postScore.decision,
            via: 'vk_post_search'
          }
        })

        relevantPosts += 1
      }

      for (const comment of post.comments) {
        const commentScore = this.relevanceService.score(comment.text || '', aliases, profile)
        if (commentScore.decision !== 'RELEVANT') continue

        await this.mentionService.persistExternalMention({
          companyId: company.id,
          sourceId: source.id,
          platform: Platform.VK,
          type: MentionType.VK_COMMENT,
          externalMentionId: `vk:comment:${post.ownerId}:${post.postId}:${comment.commentId}`,
          url: comment.url,
          title: null,
          content: comment.text || '',
          author: comment.author,
          publishedAt: comment.publishedAt,
          rawPayload: {
            post,
            comment
          },
          metadata: {
            relevanceScore: commentScore.score,
            relevanceDecision: commentScore.decision,
            via: 'vk_post_search'
          }
        })

        relevantComments += 1
      }
    }

    await this.prisma.jobLog.create({
      data: {
        companyId: company.id,
        sourceId: source.id,
        triggeredByUserId: params.triggeredByUserId || null,
        queueName: 'vk_post_search',
        jobName: 'vk.post-search',
        jobStatus: 'SUCCESS',
        itemsDiscovered: found.length,
        itemsCreated: relevantPosts + relevantComments,
        payload: {
          aliases
        } as any,
        result: {
          postsFound: found.length,
          relevantPosts,
          relevantComments
        } as any
      }
    })

    return {
      ok: true,
      postsFound: found.length,
      relevantPosts,
      relevantComments
    }
  }
}
