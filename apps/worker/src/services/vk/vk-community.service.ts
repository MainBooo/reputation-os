import { Injectable, Logger } from '@nestjs/common'
import { VkService } from './vk.service'

@Injectable()
export class VkCommunityService {
  private readonly logger = new Logger(VkCommunityService.name)

  constructor(private readonly vkService: VkService) {}

  async run(
    data: {
      companyId: string
      sourceId?: string
      trackedCommunityId?: string
      communityId?: string | number
    },
    _job?: any,
  ) {
    return this.processJob(data)
  }

  async processJob(data: {
    companyId: string
    sourceId?: string
    trackedCommunityId?: string
    communityId?: string | number
  }) {
    const adapter = this.vkService.getAdapter()
    const adapterAny = adapter as any

    if (!adapterAny) {
      this.logger.warn('vk adapter is not configured')
      return { ok: true, skipped: true, reason: 'adapter_not_configured' }
    }

    if (!data?.companyId) {
      this.logger.warn('processJob: missing companyId')
      return { ok: true, skipped: true, reason: 'missing_company_id' }
    }

    if (!data?.communityId) {
      this.logger.warn('processJob: missing communityId')
      return { ok: true, skipped: true, reason: 'missing_community_id' }
    }

    let result: any = null

    if (typeof adapterAny.getCommunityPosts === 'function') {
      result = await adapterAny.getCommunityPosts({
        communityId: data.communityId,
      })
    } else if (typeof adapterAny.getWallPosts === 'function') {
      result = await adapterAny.getWallPosts({
        communityId: data.communityId,
      })
    } else if (typeof adapterAny.getOwnedCommunityPosts === 'function') {
      result = await adapterAny.getOwnedCommunityPosts({
        communityId: data.communityId,
      })
    } else if (typeof adapterAny.fetchCommunityPosts === 'function') {
      result = await adapterAny.fetchCommunityPosts({
        communityId: data.communityId,
      })
    } else {
      this.logger.warn('vk adapter does not support community posts fetch')
      return {
        ok: true,
        skipped: true,
        reason: 'adapter_method_not_supported',
      }
    }

    const posts = Array.isArray(result?.items) ? result.items : []

    let processed = 0
    let skipped = 0

    for (const post of posts) {
      const trackedPost = await this.vkService.upsertTrackedPost({
        companyId: data.companyId,
        trackedCommunityId: data.trackedCommunityId,
        post,
      })

      const trackedPostId = trackedPost?.id

      if (!trackedPostId) {
        skipped += 1
        continue
      }

      await this.vkService.processRelevantPost({
        companyId: data.companyId,
        sourceId: data.sourceId,
        vkTrackedPostId: trackedPostId,
        post,
      })

      processed += 1
    }

    return {
      ok: true,
      processed,
      skipped,
      total: posts.length,
    }
  }
}
