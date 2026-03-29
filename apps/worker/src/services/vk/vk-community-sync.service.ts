import { Injectable, Logger } from '@nestjs/common'
import { VkTrackedCommunityMode } from '@prisma/client'
import axios, { AxiosInstance } from 'axios'
import { PrismaService } from '../../common/prisma/prisma.service'

type ProcessCommunityJobParams = {
  companyId: string
  trackedCommunityId?: string
  communityId?: string
  mode: VkTrackedCommunityMode
}

type VkTrackedCommunityItem = {
  id: string
  mode: VkTrackedCommunityMode
  vkCommunityId: string
  screenName?: string | null
  title?: string | null
  url?: string | null
  isActive: boolean
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
export class VkCommunitySyncService {
  private readonly logger = new Logger(VkCommunitySyncService.name)
  private readonly vk: AxiosInstance

  private static readonly WALL_PAGE_SIZE = 30
  private static readonly WALL_MAX_PAGES = 3
  private static readonly COMMENTS_PAGE_SIZE = 100
  private static readonly COMMENTS_MAX_PAGES = 20

  constructor(private readonly prisma: PrismaService) {
    this.vk = axios.create({
      baseURL: 'https://api.vk.com/method',
      timeout: 15000
    })
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

  private extractVkErrorMessage(error: any): string {
    const apiMsg = error?.response?.data?.error?.error_msg
    if (apiMsg) {
      return String(apiMsg)
    }
    return error instanceof Error ? error.message : String(error)
  }

  private normalizeScreenName(value?: string | null): string {
    const raw = String(value || '').trim()
    if (!raw) {
      return ''
    }

    return raw
      .replace(/^https?:\/\/vk\.com\//i, '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '')
      .replace(/^club/i, '')
      .replace(/^public/i, '')
      .trim()
  }

  private buildPostUrl(ownerId: number, postId: number): string {
    return `https://vk.com/wall${ownerId}_${postId}`
  }

  async processJob(params: ProcessCommunityJobParams) {
    const companyId = params?.companyId
    const trackedCommunityId = params?.trackedCommunityId || params?.communityId
    const mode = params?.mode

    if (!companyId) {
      this.logger.warn('VkCommunitySyncService processJob missing companyId')
      return {
        ok: false,
        skipped: true,
        reason: 'missing_company_id'
      }
    }

    if (!mode) {
      this.logger.warn(`VkCommunitySyncService processJob missing mode companyId=${companyId}`)
      return {
        ok: false,
        skipped: true,
        reason: 'missing_mode'
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
      where: { id: companyId },
      select: { id: true, name: true }
    })

    if (!company) {
      this.logger.warn(`VkCommunitySyncService company not found: ${companyId}`)
      return {
        ok: false,
        skipped: true,
        reason: 'company_not_found'
      }
    }

    const communities = await this.prisma.vkTrackedCommunity.findMany({
      where: {
        companyId,
        isActive: true,
        mode,
        ...(trackedCommunityId ? { id: trackedCommunityId } : {})
      },
      orderBy: { createdAt: 'asc' }
    })

    if (!communities.length) {
      this.logger.warn(
        `VkCommunitySyncService no active communities companyId=${companyId} mode=${mode} trackedCommunityId=${trackedCommunityId || '-'}`
      )
      return {
        ok: true,
        companyId,
        mode,
        trackedCommunityId,
        communitiesScanned: 0,
        postsFound: 0,
        postsSaved: 0,
        commentsProcessed: 0
      }
    }

    this.logger.log(
      `VkCommunitySyncService start companyId=${companyId} mode=${mode} communities=${communities.length} trackedCommunityId=${trackedCommunityId || '-'}`
    )

    let communitiesScanned = 0
    let postsFound = 0
    let postsSaved = 0
    let commentsProcessed = 0

    for (const community of communities as unknown as VkTrackedCommunityItem[]) {
      const ownerId = await this.resolveOwnerId(community, token)

      if (ownerId === null) {
        this.logger.warn(
          `VkCommunitySyncService skip community without resolved ownerId companyId=${companyId} trackedCommunityId=${community.id} vkCommunityId=${community.vkCommunityId}`
        )
        continue
      }

      communitiesScanned += 1

      const posts = await this.fetchWallPosts(ownerId, token)
      postsFound += posts.length

      for (const post of posts) {
        const saved = await this.upsertTrackedPost(companyId, community, post)
        if (saved) {
          postsSaved += 1
        }

        const comments = await this.fetchCommentsSafe(ownerId, post.id, token)
        commentsProcessed += comments.length

        await this.attachCommentsToTrackedPost(companyId, community, post, comments)
      }
    }

    this.logger.log(
      `VkCommunitySyncService done companyId=${companyId} mode=${mode} communities=${communitiesScanned} postsFound=${postsFound} postsSaved=${postsSaved} comments=${commentsProcessed}`
    )

    return {
      ok: true,
      companyId,
      mode,
      trackedCommunityId,
      communitiesScanned,
      postsFound,
      postsSaved,
      commentsProcessed
    }
  }

  private async resolveOwnerId(community: VkTrackedCommunityItem, token: string): Promise<number | null> {
    const rawId = String(community.vkCommunityId || '').trim()

    if (/^-?\d+$/.test(rawId)) {
      return -Math.abs(Number(rawId))
    }

    const screenName = this.normalizeScreenName(community.screenName || community.url || rawId)
    if (!screenName) {
      return null
    }

    try {
      const response = await this.vk.get('/groups.getById', {
        params: {
          group_ids: screenName,
          access_token: token,
          v: '5.199'
        }
      })

      if (response.data?.error) {
        const msg = String(response.data.error?.error_msg || 'Unknown VK error')

        if (
          msg.includes('access_token has expired') ||
          msg.includes('invalid access_token') ||
          msg.includes('User authorization failed')
        ) {
          throw new Error(`VK_AUTH_TOKEN_INVALID: ${msg}`)
        }

        this.logger.warn(`VK groups.getById failed for ${screenName}: ${msg}`)
        return null
      }

      const rawItems = response.data?.response
      const items = Array.isArray(rawItems)
        ? rawItems
        : Array.isArray(rawItems?.groups)
          ? rawItems.groups
          : []

      const first = items[0]
      if (!first || Number(first.id) <= 0) {
        return null
      }

      return -Math.abs(Number(first.id))
    } catch (error: any) {
      if (this.isVkAuthTokenError(error)) {
        this.logger.error(`VK groups.getById request failed: ${String(error)}`, error?.stack)
        throw error
      }

      this.logger.warn(`VK groups.getById request failed for ${screenName}: ${this.extractVkErrorMessage(error)}`)
      return null
    }
  }

  private async fetchWallPosts(ownerId: number, token: string): Promise<VkPostItem[]> {
    const result: VkPostItem[] = []

    for (let page = 0; page < VkCommunitySyncService.WALL_MAX_PAGES; page += 1) {
      try {
        const response = await this.vk.get('/wall.get', {
          params: {
            owner_id: ownerId,
            filter: 'all',
            count: VkCommunitySyncService.WALL_PAGE_SIZE,
            offset: page * VkCommunitySyncService.WALL_PAGE_SIZE,
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

        if (items.length < VkCommunitySyncService.WALL_PAGE_SIZE) {
          return result
        }
      } catch (error: any) {
        if (this.isVkAuthTokenError(error)) {
          this.logger.error(`VK wall.get request failed ownerId=${ownerId}: ${String(error)}`, error?.stack)
          throw error
        }

        this.logger.warn(`VK wall.get request failed ownerId=${ownerId}: ${this.extractVkErrorMessage(error)}`)
        return result
      }
    }

    return result
  }

  private async fetchCommentsSafe(ownerId: number, postId: number, token: string): Promise<any[]> {
    const comments: any[] = []

    for (let page = 0; page < VkCommunitySyncService.COMMENTS_MAX_PAGES; page += 1) {
      try {
        const response = await this.vk.get('/wall.getComments', {
          params: {
            owner_id: ownerId,
            post_id: postId,
            need_likes: 0,
            sort: 'asc',
            count: VkCommunitySyncService.COMMENTS_PAGE_SIZE,
            offset: page * VkCommunitySyncService.COMMENTS_PAGE_SIZE,
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

          if (
            msg.includes('wall is disabled') ||
            msg.includes('Wall is disabled') ||
            msg.includes('Access denied')
          ) {
            this.logger.warn(`VK wall.getComments skipped ownerId=${ownerId} postId=${postId}: ${msg}`)
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

        if (items.length < VkCommunitySyncService.COMMENTS_PAGE_SIZE) {
          return comments
        }
      } catch (error: any) {
        if (this.isVkAuthTokenError(error)) {
          this.logger.error(`VK wall.getComments request failed ownerId=${ownerId} postId=${postId}: ${String(error)}`, error?.stack)
          throw error
        }

        this.logger.warn(
          `VK wall.getComments request failed ownerId=${ownerId} postId=${postId}: ${this.extractVkErrorMessage(error)}`
        )
        return comments
      }
    }

    this.logger.warn(
      `VK comments truncated ownerId=${ownerId} postId=${postId} limit=${VkCommunitySyncService.COMMENTS_MAX_PAGES * VkCommunitySyncService.COMMENTS_PAGE_SIZE}`
    )

    return comments
  }

  private async upsertTrackedPost(
    companyId: string,
    community: VkTrackedCommunityItem,
    post: VkPostItem
  ): Promise<boolean> {
    try {
      const postKey = `${post.owner_id}_${post.id}`
      const postUrl = this.buildPostUrl(post.owner_id, post.id)

      const rawPayload = {
        ...(post || {}),
        communitySyncMeta: {
          source: 'tracked_community',
          trackedCommunityId: community.id,
          trackedCommunityMode: community.mode,
          trackedCommunityVkId: community.vkCommunityId,
          trackedCommunityScreenName: community.screenName || null,
          trackedCommunityTitle: community.title || null
        }
      }

      const publishedAt = post.date ? new Date(post.date * 1000) : undefined

      const createData: any = {
        companyId,
        trackedCommunityId: community.id,
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
          trackedCommunityId: community.id,
          text: post.text || null,
          url: postUrl,
          ...(publishedAt ? { publishedAt } : {}),
          rawPayload
        },
        create: createData
      })

      return true
    } catch (error: any) {
      this.logger.error(`Failed to upsert community vkTrackedPost: ${String(error)}`, error?.stack)
      return false
    }
  }

  private async attachCommentsToTrackedPost(
    companyId: string,
    community: VkTrackedCommunityItem,
    post: VkPostItem,
    comments: any[]
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
        communitySyncMeta: {
          ...(prevRaw.communitySyncMeta || {}),
          source: 'tracked_community',
          trackedCommunityId: community.id,
          trackedCommunityMode: community.mode,
          trackedCommunityVkId: community.vkCommunityId,
          trackedCommunityScreenName: community.screenName || null,
          trackedCommunityTitle: community.title || null
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
          trackedCommunityId: community.id,
          rawPayload: nextRaw
        }
      })
    } catch (error: any) {
      this.logger.error(`Failed to attach community comments to post ${postKey}: ${String(error)}`, error?.stack)
    }
  }
}
