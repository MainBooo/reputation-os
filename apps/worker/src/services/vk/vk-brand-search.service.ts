import { Injectable, Logger, Inject } from '@nestjs/common'
import axios, { AxiosInstance } from 'axios'
import { PrismaService } from '../../common/prisma/prisma.service'
import { Queue } from 'bullmq'
import { QUEUES } from '../../queues/queue.names'

type ProcessJobParams = {
  companyId: string
  query?: string
  searchProfileId?: string
}

type VkGroupItem = {
  id: number
  name?: string
  screen_name?: string
  is_closed?: number
  deactivated?: string | null
  [key: string]: any
}

type VkPostItem = {
  id: number
  owner_id: number
  text?: string
  date?: number
  copy_history?: Array<{ text?: string }>
  [key: string]: any
}

@Injectable()
export class VkBrandSearchService {
  private readonly logger = new Logger(VkBrandSearchService.name)
  private readonly vk: AxiosInstance

  private static readonly GROUPS_LIMIT = 8
  private static readonly GROUPS_SEARCH_COUNT = 40
  private static readonly WALL_PAGE_SIZE = 30
  private static readonly WALL_MAX_PAGES = 2
  private static readonly COMMENTS_PAGE_SIZE = 100
  private static readonly COMMENTS_MAX_PAGES = 20

  constructor(
    @Inject(`QUEUE_${QUEUES.VK_COMMENTS_SYNC}`) private readonly commentsQueue: Queue,
    private readonly prisma: PrismaService
  ) {
    this.vk = axios.create({
      baseURL: 'https://api.vk.com/method',
      timeout: 15000
    })
  }

  private isVkProfileTypeRestricted(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error)
    return (
      message.includes('VK_PROFILE_TYPE_RESTRICTED') ||
      message.includes('Method is not available for this profile type')
    )
  }

  private isVkAuthTokenError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error)
    return (
      message.includes('VK_AUTH_TOKEN_INVALID') ||
      message.includes('access_token has expired') ||
      message.includes('invalid access_token') ||
      message.includes('User authorization failed')
    )
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

    const token = (process.env.VK_TOKEN || '').trim()
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

  private async searchPosts(query: string, token: string): Promise<VkPostItem[]> {
    const groups = await this.searchOpenGroups(query, token)
    if (!groups.length) {
      this.logger.log(`VkBrandSearchService fallback groups=0 scannedPosts=0 matchedPosts=0 query="${query}"`)
      return []
    }

    const needles = this.buildNeedles(query)
    const dedup = new Map<string, VkPostItem>()
    let scannedPosts = 0

    for (const group of groups) {
      const ownerId = -Math.abs(Number(group.id))
      const wallPosts = await this.fetchGroupWallPosts(ownerId, token)
      scannedPosts += wallPosts.length

      for (const post of wallPosts) {
        if (!post || typeof post.id !== 'number' || typeof post.owner_id !== 'number') {
          continue
        }

        const haystack = this.extractPostSearchText(post)
        if (!this.matchesAnyNeedle(haystack, needles)) {
          continue
        }

        const key = `${post.owner_id}_${post.id}`
        dedup.set(key, {
          ...post,
          brandSearchMeta: {
            source: 'groups_wall',
            matchedQuery: query,
            groupId: group.id,
            groupName: group.name || null,
            groupScreenName: group.screen_name || null
          }
        })
      }
    }

    const matched = Array.from(dedup.values())

    this.logger.log(
      `VkBrandSearchService fallback groups=${groups.length} scannedPosts=${scannedPosts} matchedPosts=${matched.length} query="${query}"`
    )

    return matched
  }

  private async searchOpenGroups(query: string, token: string): Promise<VkGroupItem[]> {
    try {
      const response = await this.vk.get('/groups.search', {
        params: {
          q: query,
          type: 'group',
          sort: 0,
          count: VkBrandSearchService.GROUPS_SEARCH_COUNT,
          access_token: token,
          v: '5.199'
        }
      })

      if (response.data?.error) {
        const msg = String(response.data.error?.error_msg || 'Unknown VK error')
        this.logger.error(`VK groups.search error: ${msg}`)

        if (
          msg.includes('access_token has expired') ||
          msg.includes('invalid access_token') ||
          msg.includes('User authorization failed')
        ) {
          throw new Error(`VK_AUTH_TOKEN_INVALID: ${msg}`)
        }

        return []
      }

      const items = response.data?.response?.items
      if (!Array.isArray(items)) {
        return []
      }

      const openGroups = items.filter((group: VkGroupItem) => {
        return (
          Number(group?.id) > 0 &&
          Number(group?.is_closed ?? 1) === 0 &&
          !group?.deactivated
        )
      })

      return openGroups.slice(0, VkBrandSearchService.GROUPS_LIMIT)
    } catch (error: any) {
      if (this.isVkAuthTokenError(error)) {
        this.logger.error(`VK groups.search request failed: ${String(error)}`, (error as any)?.stack)
        throw error
      }

      this.logger.error(`VK groups.search request failed: ${String(error)}`, (error as any)?.stack)
      return []
    }
  }

  private async fetchGroupWallPosts(ownerId: number, token: string): Promise<VkPostItem[]> {
    const result: VkPostItem[] = []

    for (let page = 0; page < VkBrandSearchService.WALL_MAX_PAGES; page += 1) {
      try {
        const response = await this.vk.get('/wall.get', {
          params: {
            owner_id: ownerId,
            filter: 'all',
            count: VkBrandSearchService.WALL_PAGE_SIZE,
            offset: page * VkBrandSearchService.WALL_PAGE_SIZE,
            access_token: token,
            v: '5.199'
          }
        })

        if (response.data?.error) {
          const msg = String(response.data.error?.error_msg || '')

          if (
            msg.includes('access_token has expired') ||
            msg.includes('invalid access_token') ||
            msg.includes('User authorization failed')
          ) {
            throw new Error(`VK_AUTH_TOKEN_INVALID: ${msg}`)
          }

          if (
            msg.includes('Access denied') ||
            msg.includes('wall is disabled') ||
            msg.includes('Wall is disabled')
          ) {
            this.logger.warn(`VK wall.get skipped ownerId=${ownerId}: ${msg}`)
            return result
          }

          this.logger.error(`VK wall.get error ownerId=${ownerId}: ${msg}`)
          return result
        }

        const items = response.data?.response?.items
        if (!Array.isArray(items) || items.length === 0) {
          return result
        }

        const normalized = items.filter((post: VkPostItem) => {
          return typeof post?.id === 'number' && typeof post?.owner_id === 'number'
        })

        result.push(...normalized)

        if (items.length < VkBrandSearchService.WALL_PAGE_SIZE) {
          return result
        }
      } catch (error: any) {
        if (this.isVkAuthTokenError(error)) {
          this.logger.error(`VK wall.get request failed ownerId=${ownerId}: ${String(error)}`, (error as any)?.stack)
          throw error
        }

        this.logger.warn(`VK wall.get request failed ownerId=${ownerId}: ${String(error)}`)
        return result
      }
    }

    return result
  }

  private async upsertTrackedPost(
    companyId: string,
    post: VkPostItem,
    meta: { query: string; searchProfileId?: string }
  ): Promise<boolean> {
    try {
      const postKey = `${post.owner_id}_${post.id}`
      const postUrl = this.buildPostUrl(post.owner_id, post.id)

      const rawPayload = {
        ...(post || {}),
        brandSearchMeta: {
          ...(post?.brandSearchMeta || {}),
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
    const comments: any[] = []

    for (let page = 0; page < VkBrandSearchService.COMMENTS_MAX_PAGES; page += 1) {
      try {
        const response = await this.vk.get('/wall.getComments', {
          params: {
            owner_id: ownerId,
            post_id: postId,
            need_likes: 0,
            sort: 'asc',
            count: VkBrandSearchService.COMMENTS_PAGE_SIZE,
            offset: page * VkBrandSearchService.COMMENTS_PAGE_SIZE,
            preview_length: 0,
            access_token: token,
            v: '5.199'
          }
        })

        if (response.data?.error) {
          const msg = String(response.data.error?.error_msg || '')

          if (
            msg.includes('access_token has expired') ||
            msg.includes('invalid access_token') ||
            msg.includes('User authorization failed')
          ) {
            throw new Error(`VK_AUTH_TOKEN_INVALID: ${msg}`)
          }

          if (msg.includes('wall is disabled') || msg.includes('Access denied')) {
            this.logger.warn(`VK comments skipped ownerId=${ownerId} postId=${postId}: ${msg}`)
            return comments
          }

          this.logger.error(`VK wall.getComments error ownerId=${ownerId} postId=${postId}: ${msg}`)
          return comments
        }

        const items = response.data?.response?.items
        if (!Array.isArray(items) || items.length === 0) {
          return comments
        }

        comments.push(...items)

        if (items.length < VkBrandSearchService.COMMENTS_PAGE_SIZE) {
          return comments
        }
      } catch (error: any) {
        if (this.isVkAuthTokenError(error)) {
          this.logger.error(`VK comments request failed ownerId=${ownerId} postId=${postId}: ${String(error)}`, (error as any)?.stack)
          throw error
        }

        const msg = String(error || '')
        this.logger.warn(`VK comments request failed ownerId=${ownerId} postId=${postId}: ${msg}`)
        return comments
      }
    }

    this.logger.warn(
      `VK comments truncated ownerId=${ownerId} postId=${postId} limit=${VkBrandSearchService.COMMENTS_MAX_PAGES * VkBrandSearchService.COMMENTS_PAGE_SIZE}`
    )

    return comments
  }

  private async attachCommentsToTrackedPost(
    companyId: string,
    post: VkPostItem,
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
          ...(prevRaw.brandSearchMeta || {}),
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

  private buildNeedles(query: string): string[] {
    const normalizedQuery = this.normalizeText(query)
    const parts = normalizedQuery.split(' ').filter(Boolean)

    const stopWords = new Set([
      'ooo',
      'ооо',
      'ao',
      'ао',
      'oao',
      'оао',
      'zao',
      'зао',
      'llc',
      'ltd',
      'inc',
      'corp',
      'company',
      'co',
      'group',
      'official',
      'market'
    ])

    const needles = new Set<string>()

    if (normalizedQuery) {
      needles.add(normalizedQuery)
    }

    for (const part of parts) {
      if (part.length < 4) {
        continue
      }
      if (stopWords.has(part)) {
        continue
      }
      needles.add(part)
    }

    return Array.from(needles)
  }

  private normalizeText(value: string): string {
    return String(value || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9]+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private extractPostSearchText(post: VkPostItem): string {
    const parts: string[] = []

    if (post?.text) {
      parts.push(post.text)
    }

    if (Array.isArray(post?.copy_history)) {
      for (const item of post.copy_history) {
        if (item?.text) {
          parts.push(item.text)
        }
      }
    }

    return parts.join('\n').trim()
  }

  private matchesAnyNeedle(text: string, needles: string[]): boolean {
    const normalized = this.normalizeText(text)
    if (!normalized) {
      return false
    }

    for (const needle of needles) {
      if (needle && normalized.includes(needle)) {
        return true
      }
    }

    return false
  }

  private buildPostUrl(ownerId: number, postId: number): string {
    return `https://vk.com/wall${ownerId}_${postId}`
  }
}
