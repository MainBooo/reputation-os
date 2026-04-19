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

  private async updateJobProgress(jobLogId: string | undefined, data: any) {
    if (!jobLogId) return
    try {
      await this.prisma.jobLog.update({
        where: { id: jobLogId },
        data
      })
    } catch (e) {
      this.logger.warn(`jobLog update failed: ${e instanceof Error ? e.message : e}`)
    }
  }

  async markJobFailed(jobLogId: string | undefined, error: any) {
    if (!jobLogId) return
    try {
      await this.prisma.jobLog.update({
        where: { id: jobLogId },
        data: {
          jobStatus: 'FAILED',
          errorMessage: error?.message || 'unknown error',
          result: {
            stage: 'failed',
            progress: 100,
            errorMessage: error?.message || 'unknown error'
          } as any
        }
      })
    } catch (e) {
      this.logger.error(`failed to mark jobLog FAILED: ${e instanceof Error ? e.message : e}`)
    }
  }


  async processJob(params: { companyId: string; triggeredByUserId?: string; jobLogId?: string }) {
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

      await this.updateJobProgress(params.jobLogId, {
        sourceId: source.id,
        jobStatus: 'RUNNING',
        payload: {
          mode: 'VK_POST_SEARCH',
          stage: 'search_posts',
          progress: 10
        } as any,
        result: {
          stage: 'search_posts',
          progress: 10,
          postsFound: 0,
          relevantPosts: 0,
          relevantComments: 0
        } as any
      })
    const found = await this.searchService.searchPosts(
        aliases,
        company.workspaceId,
        company.id,
        async (progress) => {
          await this.updateJobProgress(params.jobLogId, {
            jobStatus: 'RUNNING',
            payload: {
              mode: 'VK_POST_SEARCH',
              stage: progress.stage,
              progress: progress.progress,
              aliases
            } as any,
            result: {
              stage: progress.stage,
              progress: progress.progress,
              postsFound: progress.postsFound ?? 0,
              relevantPosts: 0,
              relevantComments: 0
            } as any
          })
        }
      )

      await this.updateJobProgress(params.jobLogId, {
        jobStatus: 'RUNNING',
        itemsDiscovered: found.length,
        payload: {
          stage: 'search_posts',
          progress: 45,
          aliases
        } as any,
        result: {
          stage: 'search_posts',
          progress: 45,
          postsFound: found.length,
          relevantPosts: 0,
          relevantComments: 0
        } as any
      })

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
          url: post.url || post.postUrl,
          title: null,
          content: (post.text || '').trim(),
          author: post.author,
          publishedAt: post.publishedAt ?? new Date(),
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
        const commentText = (comment.text || '').trim()
        if (!commentText) continue

        const commentScore = this.relevanceService.score(commentText, aliases, profile)

        await this.mentionService.persistExternalMention({
          companyId: company.id,
          sourceId: source.id,
          platform: Platform.VK,
          type: MentionType.VK_COMMENT,
          externalMentionId: `vk:comment:${post.ownerId}:${post.postId}:${comment.commentId || 'unknown'}`,
          url: comment.url || `${post.url || post.postUrl}?reply=${comment.commentId || 'unknown'}`,
          title: null,
          content: commentText,
          author: comment.author || undefined,
          publishedAt: comment.publishedAt ?? post.publishedAt ?? new Date(),
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

      await this.updateJobProgress(params.jobLogId, {
        jobStatus: 'RUNNING',
        itemsDiscovered: found.length,
        itemsCreated: relevantPosts + relevantComments,
        payload: {
          stage: 'persist_mentions',
          progress: 80,
          aliases
        } as any,
        result: {
          stage: 'persist_mentions',
          progress: 80,
          postsFound: found.length,
          relevantPosts,
          relevantComments
        } as any
      })

        if (params.jobLogId) {
        await this.prisma.jobLog.update({
          where: { id: params.jobLogId },
          data: {
            sourceId: source.id,
            jobStatus: 'SUCCESS',
            itemsDiscovered: found.length,
            itemsCreated: relevantPosts + relevantComments,
            payload: {
              aliases
            } as any,
            result: {
              postsFound: found.length,
              relevantPosts,
              relevantComments,
              stage: 'completed',
              progress: 100
            } as any
          }
        })
      } else {
        this.logger.warn('jobLogId missing, fallback create')
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
              relevantComments,
              stage: 'completed',
              progress: 100
            } as any
          }
        })
      }

    return {
      ok: true,
      postsFound: found.length,
      relevantPosts,
      relevantComments
    }
  }
}
