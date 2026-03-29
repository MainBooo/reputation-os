import { Injectable, Logger } from '@nestjs/common'
import axios, { AxiosInstance } from 'axios'

type VkApiResponse<T> = {
  response?: T
  error?: {
    error_code: number
    error_msg: string
  }
}

@Injectable()
export class VkAdapter {
  private readonly logger = new Logger(VkAdapter.name)
  private readonly baseUrl = 'https://api.vk.com/method'
  private readonly version = '5.199'
  private readonly token = process.env.VK_TOKEN
  private readonly http: AxiosInstance

  constructor() {
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000
    })
  }

  private normalizeOwnerId(input: string | number): string | number {
    if (typeof input === 'number') return input

    const raw = String(input).trim()
    if (!raw) return raw

    if (/^-?\d+$/.test(raw)) {
      return raw
    }

    const clubMatch = raw.match(/^club(\d+)$/i)
    if (clubMatch) return `-${clubMatch[1]}`

    const publicMatch = raw.match(/^public(\d+)$/i)
    if (publicMatch) return `-${publicMatch[1]}`

    const eventMatch = raw.match(/^event(\d+)$/i)
    if (eventMatch) return `-${eventMatch[1]}`

    return raw
  }

  private async call<T = any>(
    method: string,
    params: Record<string, any>
  ): Promise<T | null> {
    if (!this.token) {
      this.logger.warn('VK_TOKEN is not set')
      return null
    }

    try {
      const { data } = await this.http.get<VkApiResponse<T>>(`/${method}`, {
        params: {
          ...params,
          access_token: this.token,
          v: this.version
        }
      })

      if (data?.error) {
        this.logger.error(
          `VK API error ${data.error.error_code}: ${data.error.error_msg}`
        )
        return null
      }

      return data?.response ?? null
    } catch (error: any) {
      this.logger.error(`VK request failed: ${error?.message || error}`)
      return null
    }
  }

  async searchPosts(input: string | { query?: string }) {
    const query =
      typeof input === 'string'
        ? input
        : typeof input?.query === 'string'
          ? input.query
          : ''

    this.logger.log(`searchPosts query="${query}"`)

    return this.call('newsfeed.search', {
      q: query,
      count: 20,
      extended: 0
    })
  }

  async getCommunityPosts(input: string | number | { communityId?: string | number }) {
    const communityIdRaw =
      typeof input === 'string' || typeof input === 'number'
        ? input
        : input?.communityId

    if (communityIdRaw === undefined || communityIdRaw === null || communityIdRaw === '') {
      this.logger.warn('getCommunityPosts: communityId is missing')
      return { items: [] }
    }

    const ownerId = this.normalizeOwnerId(communityIdRaw)

    this.logger.log(`getCommunityPosts communityId=${communityIdRaw} normalizedOwnerId=${ownerId}`)

    const result = await this.call<any>('wall.get', {
      owner_id: ownerId,
      count: 20
    })

    return result ?? { items: [] }
  }

  async getComments(
    input:
      | { ownerId?: string | number; postId?: string | number }
      | string
      | number,
    maybePostId?: string | number
  ) {
    let ownerIdRaw: string | number | undefined
    let postIdRaw: string | number | undefined

    if (typeof input === 'object' && input !== null && !Array.isArray(input)) {
      ownerIdRaw = input.ownerId
      postIdRaw = input.postId
    } else {
      ownerIdRaw = input as string | number
      postIdRaw = maybePostId
    }

    const ownerId =
      ownerIdRaw !== undefined && ownerIdRaw !== null && ownerIdRaw !== ''
        ? this.normalizeOwnerId(ownerIdRaw)
        : undefined

    const postId =
      typeof postIdRaw === 'number'
        ? postIdRaw
        : typeof postIdRaw === 'string' && postIdRaw.trim() !== ''
          ? Number(postIdRaw)
          : NaN

    if (
      ownerId === undefined ||
      ownerId === null ||
      ownerId === '' ||
      !Number.isFinite(postId)
    ) {
      this.logger.warn('getComments: ownerId or postId is missing/invalid')
      return { items: [] }
    }

    this.logger.log(`getComments ownerId=${ownerId} postId=${postId}`)

    const result = await this.call<any>('wall.getComments', {
      owner_id: ownerId,
      post_id: postId,
      count: 50,
      thread_items_count: 10,
      extended: 0
    })

    return result ?? { items: [] }
  }

  async fetchCommentsForPost(
    ownerId: string | number,
    postId: string | number
  ) {
    const result = await this.getComments({ ownerId, postId })
    return Array.isArray((result as any)?.items) ? (result as any).items : []
  }
}
