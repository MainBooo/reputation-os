import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, VkMonitoringMode, VkTrackedCommunityMode } from '@prisma/client'
import { Queue } from 'bullmq'
import { PrismaService } from '../../common/prisma/prisma.service'
import { QUEUES } from '../../common/queues/queue.names'
import { JOBS } from '../../common/queues/job.names'
import { CreateVkSearchProfileDto } from './dto/create-vk-search-profile.dto'
import { UpdateVkSearchProfileDto } from './dto/update-vk-search-profile.dto'
import { CreateVkTrackedCommunityDto } from './dto/create-vk-tracked-community.dto'
import { UpdateVkTrackedCommunityDto } from './dto/update-vk-tracked-community.dto'
import { ListVkPostsDto } from './dto/list-vk-posts.dto'

@Injectable()
export class VkService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(`QUEUE_${QUEUES.VK_BRAND_SEARCH_DISCOVERY}`) private readonly vkBrandQueue: Queue,
    @Inject(`QUEUE_${QUEUES.VK_PRIORITY_COMMUNITIES_SYNC}`) private readonly vkCommunitiesQueue: Queue,
    @Inject(`QUEUE_${QUEUES.VK_OWNED_COMMUNITY_SYNC}`) private readonly vkOwnedQueue: Queue
  ) {}

  private async assertCompanyAccess(userId: string, companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { workspaceId: true }
    })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: company.workspaceId }
    })

    if (!member) {
      throw new ForbiddenException('No access to company')
    }
  }

  private normalize(value?: string | null) {
    return value?.trim().toLowerCase() || ''
  }

  private resolveCommunityId(community: any) {
    return (
      community?.vkCommunityId ??
      community?.communityId ??
      community?.externalId ??
      community?.groupId ??
      community?.ownerId ??
      community?.vkId ??
      null
    )
  }

  async getSearchProfiles(userId: string, companyId: string) {
    await this.assertCompanyAccess(userId, companyId)

    return this.prisma.vkSearchProfile.findMany({
      where: { companyId },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }]
    })
  }

  async createSearchProfile(userId: string, companyId: string, dto: CreateVkSearchProfileDto) {
    await this.assertCompanyAccess(userId, companyId)

    return this.prisma.vkSearchProfile.create({
      data: {
        companyId,
        query: dto.query,
        normalizedQuery: this.normalize(dto.query),
        priority: dto.priority ?? 100,
        isActive: dto.isActive ?? true,
        mode: dto.mode
      }
    })
  }

  async updateSearchProfile(userId: string, companyId: string, profileId: string, dto: UpdateVkSearchProfileDto) {
    await this.assertCompanyAccess(userId, companyId)

    return this.prisma.vkSearchProfile.update({
      where: { id: profileId },
      data: {
        ...(dto.query !== undefined
          ? { query: dto.query, normalizedQuery: this.normalize(dto.query) }
          : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.mode !== undefined ? { mode: dto.mode } : {})
      }
    })
  }

  async deleteSearchProfile(userId: string, companyId: string, profileId: string) {
    await this.assertCompanyAccess(userId, companyId)

    return this.prisma.vkSearchProfile.delete({
      where: { id: profileId }
    })
  }

  async getCommunities(userId: string, companyId: string) {
    await this.assertCompanyAccess(userId, companyId)

    return this.prisma.vkTrackedCommunity.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' }
    })
  }

  async createCommunity(userId: string, companyId: string, dto: CreateVkTrackedCommunityDto) {
    await this.assertCompanyAccess(userId, companyId)

    return this.prisma.vkTrackedCommunity.create({
      data: {
        companyId,
        mode: dto.mode,
        vkCommunityId: dto.vkCommunityId,
        screenName: dto.screenName,
        title: dto.title,
        url: dto.url,
        isActive: dto.isActive ?? true
      }
    })
  }

  async updateCommunity(userId: string, companyId: string, communityId: string, dto: UpdateVkTrackedCommunityDto) {
    await this.assertCompanyAccess(userId, companyId)

    return this.prisma.vkTrackedCommunity.update({
      where: { id: communityId },
      data: {
        ...(dto.mode !== undefined ? { mode: dto.mode } : {}),
        ...(dto.vkCommunityId !== undefined ? { vkCommunityId: dto.vkCommunityId } : {}),
        ...(dto.screenName !== undefined ? { screenName: dto.screenName } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.url !== undefined ? { url: dto.url } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {})
      }
    })
  }

  async deleteCommunity(userId: string, companyId: string, communityId: string) {
    await this.assertCompanyAccess(userId, companyId)

    return this.prisma.vkTrackedCommunity.delete({
      where: { id: communityId }
    })
  }

  async getPosts(userId: string, companyId: string, query: ListVkPostsDto) {
    await this.assertCompanyAccess(userId, companyId)

    let communityIds: string[] | undefined

    if (query.mode === VkMonitoringMode.PRIORITY_COMMUNITIES) {
      const communities = await this.prisma.vkTrackedCommunity.findMany({
        where: { companyId, mode: VkTrackedCommunityMode.PRIORITY_COMMUNITY },
        select: { id: true }
      })
      communityIds = communities.map((item) => item.id)
    }

    if (query.mode === VkMonitoringMode.OWNED_COMMUNITY) {
      const communities = await this.prisma.vkTrackedCommunity.findMany({
        where: { companyId, mode: VkTrackedCommunityMode.OWNED_COMMUNITY },
        select: { id: true }
      })
      communityIds = communities.map((item) => item.id)
    }

    const where: Prisma.VkTrackedPostWhereInput = {
      companyId,
      ...(query.communityId ? { trackedCommunityId: query.communityId } : {}),
      ...(communityIds ? { trackedCommunityId: { in: communityIds } } : {}),
      ...(query.discoveredFrom || query.discoveredTo
        ? {
            createdAt: {
              ...(query.discoveredFrom ? { gte: new Date(query.discoveredFrom) } : {}),
              ...(query.discoveredTo ? { lte: new Date(query.discoveredTo) } : {})
            }
          }
        : {})
    }

    return this.prisma.vkTrackedPost.findMany({
      where,
      include: {
        trackedCommunity: true,
        mentions: true
      },
      orderBy: { publishedAt: 'desc' }
    })
  }

  async overview(userId: string, companyId: string) {
    await this.assertCompanyAccess(userId, companyId)

    const [
      trackedCommunitiesCount,
      activeSearchProfilesCount,
      discoveredVkPostsCount,
      relevantVkMentionsCount,
      recentPosts,
      recentMentions
    ] = await Promise.all([
      this.prisma.vkTrackedCommunity.count({ where: { companyId } }),
      this.prisma.vkSearchProfile.count({ where: { companyId, isActive: true } }),
      this.prisma.vkTrackedPost.count({ where: { companyId } }),
      this.prisma.mention.count({ where: { companyId, platform: 'VK' } }),
      this.prisma.vkTrackedPost.findMany({
        where: { companyId },
        orderBy: { publishedAt: 'desc' },
        take: 10,
        include: { trackedCommunity: true }
      }),
      this.prisma.mention.findMany({
        where: { companyId, platform: 'VK' },
        orderBy: { publishedAt: 'desc' },
        take: 10,
        include: { vkTrackedPost: true }
      })
    ])

    return {
      trackedCommunitiesCount,
      activeSearchProfilesCount,
      discoveredVkPostsCount,
      relevantVkMentionsCount,
      recentPosts,
      recentMentions
    }
  }

  async runBrandSearch(userId: string, companyId: string) {
    try {
      console.log('[VK] runBrandSearch:start', { companyId, userId, hasQueue: !!this.vkBrandQueue })

      console.log('[VK] runBrandSearch:assertCompanyAccess:before', { companyId, userId })
      await this.assertCompanyAccess(userId, companyId)
      console.log('[VK] runBrandSearch:assertCompanyAccess:after', { companyId, userId })

      console.log('[VK] runBrandSearch:company:before', { companyId })
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: {
          id: true,
          name: true
        }
      })
      console.log('[VK] runBrandSearch:company:after', { company })

      if (!company) {
        throw new NotFoundException('Company not found')
      }

      console.log('[VK] runBrandSearch:profiles:before', { companyId })
      const profiles = await this.prisma.vkSearchProfile.findMany({
        where: {
          companyId,
          isActive: true,
          mode: VkMonitoringMode.BRAND_SEARCH
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }]
      })
      console.log('[VK] runBrandSearch:profiles:after', {
        count: profiles.length,
        profiles: profiles.map((p) => ({
          id: p.id,
          query: p.query,
          normalizedQuery: p.normalizedQuery,
          priority: p.priority,
          isActive: p.isActive,
          mode: p.mode
        }))
      })

      const queries = profiles.length > 0
        ? profiles.map((profile) => ({
            profileId: profile.id,
            query: profile.query,
            normalizedQuery: profile.normalizedQuery || this.normalize(profile.query)
          }))
        : [{
            profileId: null,
            query: company.name,
            normalizedQuery: this.normalize(company.name)
          }]

      console.log('[VK] runBrandSearch:queries', { queries })

      const enqueuedJobs: string[] = []

      for (const item of queries) {
        const payload = {
          companyId,
          query: item.query,
          normalizedQuery: item.normalizedQuery,
          profileId: item.profileId
        }

        console.log('[VK] runBrandSearch:queue.add:before', payload)

        const job = await this.vkBrandQueue.add(
          JOBS.VK_BRAND_SEARCH,
          payload,
          {
            removeOnComplete: 100,
            removeOnFail: 100,
            jobId: `manual__vk-brand__${companyId}__${item.profileId ?? 'fallback'}__${Date.now()}`
          }
        )

        console.log('[VK] runBrandSearch:queue.add:after', {
          jobId: job.id,
          payload
        })

        enqueuedJobs.push(String(job.id))
      }

      console.log('[VK] runBrandSearch:jobLog:before', {
        companyId,
        userId,
        jobsCount: enqueuedJobs.length
      })

      await this.prisma.jobLog.create({
        data: {
          companyId,
          triggeredByUserId: userId,
          queueName: 'vk_brand_search_discovery',
          jobName: 'vk.brand-search',
          jobStatus: 'PENDING',
          payload: {
            mode: 'BRAND_SEARCH',
            jobsCount: enqueuedJobs.length
          }
        }
      })

      console.log('[VK] runBrandSearch:jobLog:after', {
        companyId,
        jobsCount: enqueuedJobs.length
      })

      return {
        ok: true,
        queue: 'vk_brand_search_discovery',
        jobsCount: enqueuedJobs.length,
        jobIds: enqueuedJobs
      }
    } catch (error) {
      console.error('[VK] runBrandSearch:error', error instanceof Error ? error.stack || error.message : error)
      throw error
    }
  }

  async runCommunitySync(userId: string, companyId: string) {
    try {
      console.log('[VK] runCommunitySync:start', { companyId, userId, hasQueue: !!this.vkCommunitiesQueue })

      console.log('[VK] runCommunitySync:assertCompanyAccess:before', { companyId, userId })
      await this.assertCompanyAccess(userId, companyId)
      console.log('[VK] runCommunitySync:assertCompanyAccess:after', { companyId, userId })

      console.log('[VK] runCommunitySync:communities:before', { companyId })
      const communities = await this.prisma.vkTrackedCommunity.findMany({
        where: {
          companyId,
          mode: VkTrackedCommunityMode.PRIORITY_COMMUNITY,
          isActive: true
        },
        orderBy: { createdAt: 'asc' }
      })
      console.log('[VK] runCommunitySync:communities:after', {
        count: communities.length,
        communities: communities.map((c) => ({
          id: c.id,
          title: c.title,
          screenName: c.screenName,
          vkCommunityId: (c as any).vkCommunityId ?? null,
          communityId: (c as any).communityId ?? null,
          externalId: (c as any).externalId ?? null,
          groupId: (c as any).groupId ?? null,
          ownerId: (c as any).ownerId ?? null,
          vkId: (c as any).vkId ?? null,
          mode: c.mode,
          isActive: c.isActive
        }))
      })

      const enqueuedJobs: string[] = []

      for (const community of communities) {
        const resolvedCommunityId = this.resolveCommunityId(community)

        console.log('[VK] runCommunitySync:resolveCommunityId', {
          trackedCommunityId: community.id,
          resolvedCommunityId
        })

        if (!resolvedCommunityId) {
          console.log('[VK] runCommunitySync:skip:no-community-id', {
            trackedCommunityId: community.id
          })
          continue
        }

        const payload = {
          companyId,
          trackedCommunityId: community.id,
          communityId: String(resolvedCommunityId)
        }

        console.log('[VK] runCommunitySync:queue.add:before', payload)

        const job = await this.vkCommunitiesQueue.add(
          JOBS.VK_PRIORITY_COMMUNITIES,
          payload,
          {
            removeOnComplete: 100,
            removeOnFail: 100,
            jobId: `manual__vk-priority__${companyId}__${community.id}__${Date.now()}`
          }
        )

        console.log('[VK] runCommunitySync:queue.add:after', {
          jobId: job.id,
          payload
        })

        enqueuedJobs.push(String(job.id))
      }

      console.log('[VK] runCommunitySync:jobLog:before', {
        companyId,
        userId,
        jobsCount: enqueuedJobs.length
      })

      await this.prisma.jobLog.create({
        data: {
          companyId,
          triggeredByUserId: userId,
          queueName: 'vk_priority_communities_sync',
          jobName: 'vk.priority-communities',
          jobStatus: 'PENDING',
          payload: {
            mode: 'PRIORITY_COMMUNITIES',
            jobsCount: enqueuedJobs.length
          }
        }
      })

      console.log('[VK] runCommunitySync:jobLog:after', {
        companyId,
        jobsCount: enqueuedJobs.length
      })

      return {
        ok: true,
        queue: 'vk_priority_communities_sync',
        jobsCount: enqueuedJobs.length,
        jobIds: enqueuedJobs
      }
    } catch (error) {
      console.error('[VK] runCommunitySync:error', error instanceof Error ? error.stack || error.message : error)
      throw error
    }
  }

  async runOwnedCommunitySync(userId: string, companyId: string) {
    try {
      console.log('[VK] runOwnedCommunitySync:start', { companyId, userId, hasQueue: !!this.vkOwnedQueue })

      console.log('[VK] runOwnedCommunitySync:assertCompanyAccess:before', { companyId, userId })
      await this.assertCompanyAccess(userId, companyId)
      console.log('[VK] runOwnedCommunitySync:assertCompanyAccess:after', { companyId, userId })

      console.log('[VK] runOwnedCommunitySync:communities:before', { companyId })
      const communities = await this.prisma.vkTrackedCommunity.findMany({
        where: {
          companyId,
          mode: VkTrackedCommunityMode.OWNED_COMMUNITY,
          isActive: true
        },
        orderBy: { createdAt: 'asc' }
      })
      console.log('[VK] runOwnedCommunitySync:communities:after', {
        count: communities.length,
        communities: communities.map((c) => ({
          id: c.id,
          title: c.title,
          screenName: c.screenName,
          vkCommunityId: (c as any).vkCommunityId ?? null,
          communityId: (c as any).communityId ?? null,
          externalId: (c as any).externalId ?? null,
          groupId: (c as any).groupId ?? null,
          ownerId: (c as any).ownerId ?? null,
          vkId: (c as any).vkId ?? null,
          mode: c.mode,
          isActive: c.isActive
        }))
      })

      const enqueuedJobs: string[] = []

      for (const community of communities) {
        const resolvedCommunityId = this.resolveCommunityId(community)

        console.log('[VK] runOwnedCommunitySync:resolveCommunityId', {
          trackedCommunityId: community.id,
          resolvedCommunityId
        })

        if (!resolvedCommunityId) {
          console.log('[VK] runOwnedCommunitySync:skip:no-community-id', {
            trackedCommunityId: community.id
          })
          continue
        }

        const payload = {
          companyId,
          trackedCommunityId: community.id,
          communityId: String(resolvedCommunityId)
        }

        console.log('[VK] runOwnedCommunitySync:queue.add:before', payload)

        const job = await this.vkOwnedQueue.add(
          JOBS.VK_OWNED_COMMUNITY,
          payload,
          {
            removeOnComplete: 100,
            removeOnFail: 100,
            jobId: `manual__vk-owned__${companyId}__${community.id}__${Date.now()}`
          }
        )

        console.log('[VK] runOwnedCommunitySync:queue.add:after', {
          jobId: job.id,
          payload
        })

        enqueuedJobs.push(String(job.id))
      }

      console.log('[VK] runOwnedCommunitySync:jobLog:before', {
        companyId,
        userId,
        jobsCount: enqueuedJobs.length
      })

      await this.prisma.jobLog.create({
        data: {
          companyId,
          triggeredByUserId: userId,
          queueName: 'vk_owned_community_sync',
          jobName: 'vk.owned-community',
          jobStatus: 'PENDING',
          payload: {
            mode: 'OWNED_COMMUNITY',
            jobsCount: enqueuedJobs.length
          }
        }
      })

      console.log('[VK] runOwnedCommunitySync:jobLog:after', {
        companyId,
        jobsCount: enqueuedJobs.length
      })

      return {
        ok: true,
        queue: 'vk_owned_community_sync',
        jobsCount: enqueuedJobs.length,
        jobIds: enqueuedJobs
      }
    } catch (error) {
      console.error('[VK] runOwnedCommunitySync:error', error instanceof Error ? error.stack || error.message : error)
      throw error
    }
  }


  async triggerBrandSearch(companyId: string) {
    await this.vkBrandQueue.add('vk.brand-search.discovery', {
      companyId,
    })

    return { ok: true }
  }

  async triggerPrioritySync(companyId: string) {
    await this.vkCommunitiesQueue.add('vk.priority-communities', {
      companyId,
    })

    return { ok: true }
  }

  async triggerOwnedSync(companyId: string) {
    await this.vkOwnedQueue.add('vk.owned-community', {
      companyId,
    })

    return { ok: true }
  }

}