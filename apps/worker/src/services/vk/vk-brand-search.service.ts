import { Injectable, Logger, Inject } from '@nestjs/common'
import axios, { AxiosInstance } from 'axios'
import { PrismaService } from '../../common/prisma/prisma.service'
import { Queue } from 'bullmq'
import { QUEUES } from '../../queues/queue.names'
import { JOBS } from '../../queues/job.names'

type ProcessJobParams = {
  companyId: string
  query?: string
  searchProfileId?: string
}

@Injectable()
export class VkBrandSearchService {
  private readonly logger = new Logger(VkBrandSearchService.name)
  private readonly vk: AxiosInstance

  constructor(
    @Inject(`QUEUE_${QUEUES.VK_COMMENTS_SYNC}`) private readonly commentsQueue: Queue,
    private readonly prisma: PrismaService
  ) {
    this.vk = axios.create({
      baseURL: 'https://api.vk.com/method',
      timeout: 15000
    })
  }

  async processJob(params: ProcessJobParams) {
    const companyId = params?.companyId
    const rawQuery = params?.query?.trim()
    const searchProfileId = params?.searchProfileId

    if (!companyId) {
      this.logger.warn('VkBrandSearchService processJob missing companyId')
      return {
        ok: false,
        skipped: true,
        reason: 'missing_company_id'
      }
    }

    const token = process.env.VK_TOKEN
    if (!token) {
      this.logger.error('VK_TOKEN is not configured')
      return {
        ok: false,
        skipped: true,
        reason: 'missing_vk_token'
      }
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId }
    })

    if (!company) {
      this.logger.warn(`VkBrandSearchService company not found: ${companyId}`)
      return {
        ok: false,
        skipped: true,
        reason: 'company_not_found'
      }
    }

    const query = rawQuery || company.name?.trim()

    if (!query) {
      this.logger.warn(`VkBrandSearchService empty query for companyId=${companyId}`)
      return {
        ok: false,
        skipped: true,
        reason: 'empty_query'
      }
    }

    this.logger.log(
      `VkBrandSearchService start companyId=${companyId} query="${query}" searchProfileId=${searchProfileId || '-'}`
    )

    const posts = await this.searchPosts(query, token)

    let savedPosts = 0
    let processedComments = 0

    for (const post of posts) {
      const saved = await this.upsertTrackedPost(companyId, post, {
        query,
        searchProfileId
      })

      if (saved) {
        savedPosts += 1
      }

      const comments = await this.fetchCommentsSafe(post.owner_id, post.id, token)
      processedComments += comments.length

      await this.attachCommentsToTrackedPost(companyId, post, comments, {
        query,
        searchProfileId
      })
    }

    this.logger.log(
      `VkBrandSearchService done companyId=${companyId} query="${query}" posts=${savedPosts} comments=${processedComments} searchProfileId=${searchProfileId || '-'}`
    )

    return {
      ok: true,
      companyId,
      query,
      searchProfileId,
      postsFound: posts.length,
      postsSaved: savedPosts,
      commentsProcessed: processedComments
    }
  }

  private async searchPosts(query: string, token: string): Promise<any[]> {
    try {
      const response = await this.vk.get('/newsfeed.search', {
        params: {
          q: query,
          count: 20,
          extended: 0,
          access_token: token,
          v: '5.199'
        }
      })

      if (response.data?.error) {
        const msg = response.data.error?.error_msg || 'Unknown VK error'
        this.logger.error(`VK newsfeed.search error: ${msg}`)
        return []
      }

      const items = response.data?.response?.items
      if (!Array.isArray(items)) {
        return []
      }

      return items
    } catch (error: any) {
      const vkErrorCode = error?.response?.data?.error?.error_code

      if (vkErrorCode === 15) {
        this.logger.warn(`VK newsfeed.search skipped with access error 15 for query="${query}"`)
        return []
      }

      this.logger.error(`VK newsfeed.search request failed: ${String(error)}`, (error as any)?.stack)
      return []
    }
  }

  private async upsertTrackedPost(
    companyId: string,
    post: any,
    meta: { query: string; searchProfileId?: string }
  ): Promise<boolean> {
    try {
      const postKey = `${post.owner_id}_${post.id}`
      const postUrl = this.buildPostUrl(post.owner_id, post.id)
      try {
        await this.commentsQueue.add('vk.comments', {
          companyId,
          postId: post.id,
          ownerId: post.owner_id,
          postKey
        })
      } catch (e) {
        this.logger.warn(`Failed to enqueue comments job: ${String(e)}`)
      }


      const rawPayload = {
        ...(post || {}),
        brandSearchMeta: {
          query: meta.query,
          searchProfileId: meta.searchProfileId || null
        }
      }

      const publishedAt = post.date ? new Date(post.date * 1000) : undefined

      const createData: any = {
        companyId,
        postKey,
        ownerId: String(post.owner_id),
        postId: String(post.id),
        text: post.text || null,
        url: postUrl,
        rawPayload
      }

      if (publishedAt) {
        createData.publishedAt = publishedAt
      }

      await this.prisma.vkTrackedPost.upsert({

        where: {
          companyId_postKey: {
            companyId,
            postKey
          }
        },
        update: {
          text: post.text || null,
          url: postUrl,
          ...(publishedAt ? { publishedAt } : {}),
          rawPayload
        },
        create: createData
      })


      try {
        await this.commentsQueue.add('vk.comments', {
          companyId,
          postId: post.id,
          ownerId: post.owner_id,
          postKey
        })
      } catch (e) {
        this.logger.warn(`Failed to enqueue comments job: ${String(e)}`)
      }

      return true
    } catch (error: any) {
      this.logger.error(`Failed to upsert vkTrackedPost: ${String(error)}`, (error as any)?.stack)
      return false
    }
  }

  private async fetchCommentsSafe(ownerId: number, postId: number, token: string): Promise<any[]> {
    try {
      const response = await this.vk.get('/wall.getComments', {
        params: {
          owner_id: ownerId,
          post_id: postId,
          need_likes: 0,
          sort: 'asc',
          count: 100,
          preview_length: 0,
          access_token: token,
          v: '5.199'
        }
      })

      if (response.data?.error) {
        const msg = String(response.data.error?.error_msg || '')

        if (msg.includes('wall is disabled') || msg.includes('Access denied')) {
          this.logger.warn(`VK comments skipped ownerId=${ownerId} postId=${postId}: ${msg}`)
          return []
        }

        this.logger.error(`VK wall.getComments error ownerId=${ownerId} postId=${postId}: ${msg}`)
        return []
      }

      const items = response.data?.response?.items
      if (!Array.isArray(items)) {
        return []
      }

      return items
    } catch (error: any) {
      const msg = String(error || '')
      this.logger.warn(`VK comments request failed ownerId=${ownerId} postId=${postId}: ${msg}`)
      return []
    }
  }

  private async attachCommentsToTrackedPost(
    companyId: string,
    post: any,
    comments: any[],
    meta: { query: string; searchProfileId?: string }
  ) {
    const postKey = `${post.owner_id}_${post.id}`

    try {
      const existing = await this.prisma.vkTrackedPost.findUnique({
        where: {
          companyId_postKey: {
            companyId,
            postKey
          }
        }
      })

      if (!existing) {
        return
      }

      const prevRaw =
        existing.rawPayload && typeof existing.rawPayload === 'object'
          ? (existing.rawPayload as Record<string, any>)
          : {}

      const nextRaw = {
        ...prevRaw,
        brandSearchMeta: {
          query: meta.query,
          searchProfileId: meta.searchProfileId || null
        },
        commentsCount: comments.length,
        commentsPreview: comments.slice(0, 20)
      }

      await this.prisma.vkTrackedPost.update({
        where: {
          companyId_postKey: {
            companyId,
            postKey
          }
        },
        data: {
          rawPayload: nextRaw
        }
      })
    } catch (error: any) {
      this.logger.error(`Failed to attach comments to post ${postKey}: ${String(error)}`, (error as any)?.stack)
    }
  }

  private buildPostUrl(ownerId: number, postId: number): string {
    return `https://vk.com/wall${ownerId}_${postId}`
  }
}
