import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
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
    @Inject(`QUEUE_${QUEUES.VK_OWNED_COMMUNITY_SYNC}`) private readonly vkOwnedQueue: Queue,
    @Inject(`QUEUE_${QUEUES.VK_POST_SEARCH}`) private readonly vkPostSearchQueue: Queue
  ) {}

  private async assertCompanyAccess(userId: string, companyId: string) {
    console.log('[VK COMPLETE] before company lookup')
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { workspaceId: true }
    })

    console.log('[VK COMPLETE] company lookup result', company)
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

  private async isTcpPortFree(port: number): Promise<boolean> {
    const net = require('net') as typeof import('net')

    return new Promise((resolve) => {
      const server = net.createServer()

      server.unref()

      server.once('error', () => {
        resolve(false)
      })

      server.listen(port, '0.0.0.0', () => {
        server.close(() => resolve(true))
      })
    })
  }

  private isDisplayFree(displayNum: number): boolean {
    console.log('[VK COMPLETE][STAGE] before require fs');
      const fs = require('fs') as typeof import('fs')
    return !fs.existsSync(`/tmp/.X11-unix/X${displayNum}`)
  }

  private async allocateVkConnectResources() {
    for (let displayNum = 120; displayNum <= 199; displayNum += 1) {
      const offset = displayNum - 120
      const vncPort = 5901 + offset
      const noVncPort = 6081 + offset
      const debugPort = 9223 + offset

      if (!this.isDisplayFree(displayNum)) {
        continue
      }

      const [vncFree, noVncFree, debugFree] = await Promise.all([
        this.isTcpPortFree(vncPort),
        this.isTcpPortFree(noVncPort),
        this.isTcpPortFree(debugPort)
      ])

      if (vncFree && noVncFree && debugFree) {
        return {
          displayNum,
          vncPort,
          noVncPort,
          debugPort
        }
      }
    }

    throw new BadRequestException('Нет свободных ресурсов для VK connect flow')
  }

    private resolveVkConnectBaseUrl() {
      const fallbackHost = 'reputation.generationweb.ru'
      const raw =
        process.env.VK_CONNECT_BASE_URL ||
        process.env.APP_BASE_URL ||
        `http://${fallbackHost}`

      try {
        const url = new URL(raw)
        const host = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
          ? fallbackHost
          : url.hostname

        return `${url.protocol}//${host}`
      } catch {
        return raw
          .replace('localhost', fallbackHost)
          .replace('127.0.0.1', fallbackHost)
          .replace(/:\d+$/, '')
          .replace(/\/+$/, '')
      }
    }

  private resolveChromiumExecutablePath() {
    console.log('[VK COMPLETE][STAGE] before require fs');
      const fs = require('fs') as typeof import('fs')
    const childProcess = require('child_process') as typeof import('child_process')

    const candidates = [
      process.env.CHROMIUM_PATH,
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome'
    ].filter(Boolean) as string[]

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate
      }
    }

    try {
      const found = String(
        childProcess.execSync(
          'bash -lc "which chromium || which chromium-browser || which google-chrome-stable || which google-chrome"',
          { encoding: 'utf8' }
        )
      ).trim()

      if (found) {
        return found
      }
    } catch {}

    throw new BadRequestException('Chromium executable not found on server')
  }

  private isProcessAlive(pid?: number | null) {
    if (!pid) return false

    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }

  private stopProcess(pid?: number | null) {
    if (!pid) return

    try {
      process.kill(pid, 'SIGTERM')
    } catch {}
  }

  private cleanupVkConnectAttemptProcesses(attempt: {
    xvfbPid?: number | null
    x11vncPid?: number | null
    websockifyPid?: number | null
    browserPid?: number | null
  }) {
    this.stopProcess(attempt.browserPid)
    this.stopProcess(attempt.websockifyPid)
    this.stopProcess(attempt.x11vncPid)
    this.stopProcess(attempt.xvfbPid)
  }

  private isAttemptExpired(attempt: { expiresAt?: Date | null }) {
    return Boolean(attempt.expiresAt && attempt.expiresAt.getTime() <= Date.now())
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
      console.log('[VK COMPLETE] before company lookup')
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: {
          id: true,
          name: true
        }
      })
      console.log('[VK] runBrandSearch:company:after', { company })

      console.log('[VK COMPLETE] company found', company)
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

  async getCompanySearchProfile(userId: string, companyId: string) {
    await this.assertCompanyAccess(userId, companyId)

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        vkPostSearchConfig: true
      }
    })

    const profiles = await this.prisma.vkSearchProfile.findMany({
      where: {
        companyId,
        mode: VkMonitoringMode.BRAND_SEARCH,
        isActive: true
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }]
    })

    const config = (company?.vkPostSearchConfig || {}) as Record<string, unknown>

    return {
      includeKeywords: profiles.map((item) => item.query),
      excludeKeywords: Array.isArray(config.excludeKeywords) ? config.excludeKeywords : [],
      contextKeywords: Array.isArray(config.contextKeywords) ? config.contextKeywords : [],
      geoKeywords: Array.isArray(config.geoKeywords) ? config.geoKeywords : [],
      category: typeof config.category === 'string' ? config.category : null
    }
  }

  async updateCompanySearchProfile(userId: string, companyId: string, payload: Record<string, unknown>) {
    await this.assertCompanyAccess(userId, companyId)

    const includeKeywords = Array.from(
      new Set(
        (Array.isArray(payload.includeKeywords) ? payload.includeKeywords : [])
          .map((item) => String(item || '').trim())
          .filter(Boolean)
      )
    )

    const excludeKeywords = Array.from(
      new Set(
        (Array.isArray(payload.excludeKeywords) ? payload.excludeKeywords : [])
          .map((item) => String(item || '').trim())
          .filter(Boolean)
      )
    )

    const contextKeywords = Array.from(
      new Set(
        (Array.isArray(payload.contextKeywords) ? payload.contextKeywords : [])
          .map((item) => String(item || '').trim())
          .filter(Boolean)
      )
    )

    const geoKeywords = Array.from(
      new Set(
        (Array.isArray(payload.geoKeywords) ? payload.geoKeywords : [])
          .map((item) => String(item || '').trim())
          .filter(Boolean)
      )
    )

    const category =
      typeof payload.category === 'string' && payload.category.trim()
        ? payload.category.trim()
        : null

    await this.prisma.vkSearchProfile.deleteMany({
      where: {
        companyId,
        mode: VkMonitoringMode.BRAND_SEARCH
      }
    })

    if (includeKeywords.length > 0) {
      await this.prisma.vkSearchProfile.createMany({
        data: includeKeywords.map((query, index) => ({
          companyId,
          query,
          normalizedQuery: this.normalize(query),
          priority: (index + 1) * 10,
          isActive: true,
          mode: VkMonitoringMode.BRAND_SEARCH
        })),
        skipDuplicates: true
      })
    }

    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        vkPostSearchConfig: {
          excludeKeywords,
          contextKeywords,
          geoKeywords,
          category
        } as any
      }
    })

    return {
      includeKeywords,
      excludeKeywords,
      contextKeywords,
      geoKeywords,
      category
    }
  }

  async runPostSearch(userId: string, companyId: string) {
    await this.assertCompanyAccess(userId, companyId)

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { workspaceId: true }
    })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    const session = await this.prisma.vkAuthSession.findFirst({
      where: {
        workspaceId: company.workspaceId,
        status: 'ACTIVE'
      },
      orderBy: { updatedAt: 'desc' }
    })

    if (!session) {
      throw new BadRequestException('VK session is not connected')
    }

    const job = await this.vkPostSearchQueue.add(
      JOBS.VK_POST_SEARCH,
      { companyId, triggeredByUserId: userId },
      {
        removeOnComplete: 100,
        removeOnFail: 100,
        jobId: `manual__vk-post-search__${companyId}__${Date.now()}`
      }
    )

    await this.prisma.jobLog.create({
      data: {
        companyId,
        triggeredByUserId: userId,
        queueName: QUEUES.VK_POST_SEARCH,
        jobName: JOBS.VK_POST_SEARCH,
        jobStatus: 'PENDING',
        payload: {
          mode: 'VK_POST_SEARCH'
        }
      }
    })

    return {
      ok: true,
      queue: QUEUES.VK_POST_SEARCH,
      jobId: String(job.id)
    }
  }

  async getPostSearchRuns(userId: string, companyId: string) {
    await this.assertCompanyAccess(userId, companyId)

    return this.prisma.jobLog.findMany({
      where: {
        companyId,
        queueName: QUEUES.VK_POST_SEARCH
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })
  }




  async getVkSessionStatus(userId: string, companyId: string) {
    await this.assertCompanyAccess(userId, companyId)

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { workspaceId: true }
    })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    const session = await this.prisma.vkAuthSession.findFirst({
      where: {
        workspaceId: company.workspaceId,
        status: 'ACTIVE'
      },
      orderBy: { updatedAt: 'desc' }
    })

    if (!session) {
      return { connected: false }
    }

    const exists = require('fs').existsSync(session.storageStatePath)

    if (!exists) {
      await this.prisma.vkAuthSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED' }
      })

      return { connected: false }
    }

    return {
      connected: true,
      updatedAt: session.updatedAt
    }
  }

  

  async startVkConnect(userId: string, companyId: string) {
    await this.assertCompanyAccess(userId, companyId)

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { workspaceId: true }
    })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    console.log('[VK COMPLETE][STAGE] before require fs');
      const fs = require('fs') as typeof import('fs')
    const childProcess = require('child_process') as typeof import('child_process')
    const { randomUUID } = require('crypto') as typeof import('crypto')

    const staleAttempts = await this.prisma.vkConnectAttempt.findMany({
      where: {
        workspaceId: company.workspaceId,
        companyId,
        userId,
        status: { in: ['PENDING', 'AWAITING_AUTH'] }
      },
      orderBy: { createdAt: 'desc' }
    })

    for (const staleAttempt of staleAttempts) {
      this.cleanupVkConnectAttemptProcesses(staleAttempt)
    }

    if (staleAttempts.length) {
      await this.prisma.vkConnectAttempt.updateMany({
        where: {
          workspaceId: company.workspaceId,
          companyId,
          userId,
          status: { in: ['PENDING', 'AWAITING_AUTH'] }
        },
        data: {
          status: 'CANCELLED',
          errorMessage: 'Superseded by a newer connect attempt',
          completedAt: new Date(),
          lastSeenAt: new Date()
        }
      })
    }

    const resources = await this.allocateVkConnectResources()
    const attemptToken = randomUUID().replace(/-/g, '')
    const baseDir = `/opt/reputation-os/storage/vk-connect/${attemptToken}`
    const userDataDir = `${baseDir}/profile`
    const browserUrl = `${this.resolveVkConnectBaseUrl()}/vk-connect/${resources.noVncPort}/${attemptToken}/vnc.html?autoconnect=true&resize=scale&path=vk-connect/${resources.noVncPort}/${attemptToken}/websockify`
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

    fs.mkdirSync(baseDir, { recursive: true })
    fs.mkdirSync(userDataDir, { recursive: true })

    const attempt = await this.prisma.vkConnectAttempt.create({
      data: {
        workspaceId: company.workspaceId,
        companyId,
        userId,
        status: 'PENDING',
        attemptToken,
        displayNum: resources.displayNum,
        vncPort: resources.vncPort,
        noVncPort: resources.noVncPort,
        debugPort: resources.debugPort,
        userDataDir,
        browserUrl,
        expiresAt,
        lastSeenAt: new Date()
      }
    })

    const xvfbLog = fs.openSync(`${baseDir}/xvfb.log`, 'a')
    const x11vncLog = fs.openSync(`${baseDir}/x11vnc.log`, 'a')
    const websockifyLog = fs.openSync(`${baseDir}/websockify.log`, 'a')
    const browserLog = fs.openSync(`${baseDir}/browser.log`, 'a')
    const chromiumPath = this.resolveChromiumExecutablePath()

    try {
      const xvfb = childProcess.spawn(
        '/usr/bin/Xvfb',
        [`:${resources.displayNum}`, '-screen', '0', '430x932x24', '-nolisten', 'tcp'],
        {
          detached: true,
          stdio: ['ignore', xvfbLog, xvfbLog]
        }
      )
      xvfb.unref()

      await new Promise((resolve) => setTimeout(resolve, 800))

      const x11vnc = childProcess.spawn(
        '/usr/bin/x11vnc',
        [
          '-display',
          `:${resources.displayNum}`,
          '-rfbport',
          String(resources.vncPort),
          '-localhost',
          '-forever',
          '-shared',
          '-nopw'
        ],
        {
          detached: true,
          stdio: ['ignore', x11vncLog, x11vncLog]
        }
      )
      x11vnc.unref()

      await new Promise((resolve) => setTimeout(resolve, 800))

      const websockify = childProcess.spawn(
        '/usr/bin/websockify',
          ['--web', '/usr/share/novnc', String(resources.noVncPort), `localhost:${resources.vncPort}`],
        {
          detached: true,
          stdio: ['ignore', websockifyLog, websockifyLog]
        }
      )
      websockify.unref()

      await new Promise((resolve) => setTimeout(resolve, 800))

      const browser = childProcess.spawn(
        chromiumPath,
        [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-setuid-sandbox',
          '--no-first-run',
          '--no-default-browser-check',
          '--window-size=430,932',

          '--window-position=0,0',

          '--force-device-scale-factor=1',

          '--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
          `--remote-debugging-port=${resources.debugPort}`,
          `--user-data-dir=${userDataDir}`,
          'https://vk.com'
        ],
        {
          detached: true,
          stdio: ['ignore', browserLog, browserLog],
          env: {
            ...process.env,
            DISPLAY: `:${resources.displayNum}`
          }
        }
      )
      browser.unref()

      await this.prisma.vkConnectAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'AWAITING_AUTH',
          xvfbPid: xvfb.pid ?? null,
          x11vncPid: x11vnc.pid ?? null,
          websockifyPid: websockify.pid ?? null,
          browserPid: browser.pid ?? null,
          lastSeenAt: new Date()
        }
      })

      return {
        ok: true,
        status: 'AWAITING_AUTH',
        attemptToken,
        browserUrl,
        expiresAt
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'VK connect start failed'

      await this.prisma.vkConnectAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'FAILED',
          errorMessage: message,
          completedAt: new Date(),
          lastSeenAt: new Date()
        }
      })

      throw error
    }
  }

  async getVkConnectStatus(userId: string, companyId: string, attemptToken?: string) {
    await this.assertCompanyAccess(userId, companyId)

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { workspaceId: true }
    })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    const session = await this.getVkSessionStatus(userId, companyId)

    console.log('[VK COMPLETE] before attempt lookup')
    const attempt = await this.prisma.vkConnectAttempt.findFirst({
      where: {
        workspaceId: company.workspaceId,
        companyId,
        userId,
        ...(attemptToken ? { attemptToken } : {})
      },
      orderBy: { createdAt: 'desc' }
    })

    console.log('[VK COMPLETE] attempt lookup result', attempt ? { id: attempt.id, status: attempt.status, debugPort: attempt.debugPort, expiresAt: attempt.expiresAt } : null)
    if (!attempt) {
      return {
        status: session.connected ? 'CONNECTED' : 'NOT_CONNECTED',
        connected: session.connected === true,
        updatedAt: session.updatedAt ?? null,
        attemptToken: null,
        browserUrl: null,
        expiresAt: null,
        errorMessage: null
      }
    }

    if (this.isAttemptExpired(attempt) && ['PENDING', 'AWAITING_AUTH'].includes(attempt.status)) {
      try {
          this.cleanupVkConnectAttemptProcesses(attempt)
        } catch (e) {
          console.error('[VK COMPLETE] cleanup failed', e)
        }

      const expired = await this.prisma.vkConnectAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'EXPIRED',
          errorMessage: 'VK connect attempt expired',
          completedAt: new Date(),
          lastSeenAt: new Date()
        }
      })

      return {
        status: session.connected ? 'CONNECTED' : expired.status,
        connected: session.connected === true,
        updatedAt: session.updatedAt ?? null,
        attemptToken: expired.attemptToken,
        browserUrl: expired.browserUrl ?? null,
        expiresAt: expired.expiresAt ?? null,
        errorMessage: expired.errorMessage ?? null
      }
    }

    if (
      attempt.status === 'AWAITING_AUTH' &&
      attempt.browserPid &&
      !this.isProcessAlive(attempt.browserPid)
    ) {
      const failed = await this.prisma.vkConnectAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'FAILED',
          errorMessage: 'VK connect browser process is no longer running',
          completedAt: new Date(),
          lastSeenAt: new Date()
        }
      })

      return {
        status: session.connected ? 'CONNECTED' : failed.status,
        connected: session.connected === true,
        updatedAt: session.updatedAt ?? null,
        attemptToken: failed.attemptToken,
        browserUrl: failed.browserUrl ?? null,
        expiresAt: failed.expiresAt ?? null,
        errorMessage: failed.errorMessage ?? null
      }
    }

    await this.prisma.vkConnectAttempt.update({
      where: { id: attempt.id },
      data: {
        lastSeenAt: new Date()
      }
    })

    return {
      status: session.connected ? 'CONNECTED' : attempt.status,
      connected: session.connected === true,
      updatedAt: session.updatedAt ?? null,
      attemptToken: attempt.attemptToken,
      browserUrl: attempt.browserUrl ?? null,
      expiresAt: attempt.expiresAt ?? null,
      errorMessage: attempt.errorMessage ?? null
    }
  }

  async completeVkConnect(userId: string, companyId: string, attemptToken?: string) {
    console.log('[VK COMPLETE] ENTER METHOD', { userId, companyId, attemptToken })
    await this.assertCompanyAccess(userId, companyId)

    if (!attemptToken) {
      throw new BadRequestException('attemptToken is required')
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { workspaceId: true }
    })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    const attempt = await this.prisma.vkConnectAttempt.findFirst({
      where: {
        workspaceId: company.workspaceId,
        companyId,
        userId,
        attemptToken
      }
    })

    if (!attempt) {
      throw new NotFoundException('VK connect attempt not found')
    }

    if (this.isAttemptExpired(attempt)) {
      try {
          this.cleanupVkConnectAttemptProcesses(attempt)
        } catch (e) {
          console.error('[VK COMPLETE] cleanup failed', e)
        }

      await this.prisma.vkConnectAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'EXPIRED',
          errorMessage: 'VK connect attempt expired',
          completedAt: new Date(),
          lastSeenAt: new Date()
        }
      })

      throw new BadRequestException('VK connect attempt expired')
    }

    console.log('[VK COMPLETE] before debugPort check', { debugPort: attempt?.debugPort })
    if (!attempt.debugPort) {
      throw new BadRequestException('VK connect attempt is not ready')
    }

    console.log('[VK COMPLETE][STAGE] before require fs');
      const fs = require('fs') as typeof import('fs')
    console.log('[VK COMPLETE][STAGE] before require playwright');
      const { chromium } = require('playwright')

    let browser: any = null

    try {
      console.log('[VK COMPLETE][STAGE] before connectOverCDP', attempt.debugPort);
        browser = await chromium.connectOverCDP(`http://127.0.0.1:${attempt.debugPort}`)

      console.log('[VK COMPLETE][STAGE] after connectOverCDP');
        console.log('[VK COMPLETE] connectedOverCDP')

        const context = browser.contexts()[0]
      if (!context) {
        throw new BadRequestException('VK browser context not found')
      }

      const page = context.pages()[0] || (await context.newPage())

      await page.waitForTimeout(1200)

      const cookies = await context.cookies()
      const currentUrl = page.url()

      console.log('[VK COMPLETE] currentUrl', currentUrl)
        console.log('[VK COMPLETE] cookiesCount', cookies.length)

        const hasSessionCookie = cookies.some((cookie: any) => {
        const name = String(cookie?.name || '').toLowerCase()
        const domain = String(cookie?.domain || '').toLowerCase()
        return (
          name.startsWith('remix') &&
          Boolean(cookie?.value) &&
          domain.includes('vk.com')
        )
      })

      console.log('[VK COMPLETE] hasSessionCookie', hasSessionCookie)

        if (!hasSessionCookie || /login|auth|recover/i.test(currentUrl)) {
        throw new BadRequestException('Сначала завершите вход в VK в открытой вкладке')
      }

      const storageDir = '/opt/reputation-os/storage/vk-sessions'
      const storageStatePath = `${storageDir}/vk-session-${company.workspaceId}.json`

      fs.mkdirSync(storageDir, { recursive: true })
      await context.storageState({ path: storageStatePath })
        console.log('[VK COMPLETE] storageStateSaved', storageStatePath)

      await this.prisma.vkAuthSession.updateMany({
        where: {
          workspaceId: company.workspaceId,
          status: 'ACTIVE'
        },
        data: {
          status: 'EXPIRED'
        }
      })

      console.log('[VK COMPLETE] creating vkAuthSession', {
          workspaceId: company.workspaceId,
          userId,
          storageStatePath
        })

        await this.prisma.vkAuthSession.create({
        data: {
          workspaceId: company.workspaceId,
          userId,
          status: 'ACTIVE',
          storageStatePath
        }
      })

      await this.prisma.vkConnectAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'COMPLETED',
          storageStatePath,
          errorMessage: null,
          completedAt: new Date(),
          lastSeenAt: new Date()
        }
      })

      try {
          this.cleanupVkConnectAttemptProcesses(attempt)
        } catch (e) {
          console.error('[VK COMPLETE] cleanup failed', e)
        }

      return {
        ok: true,
        connected: true,
        updatedAt: new Date().toISOString()
      }
    } catch (error) {
        console.error('[VK COMPLETE][STAGE] ERROR', error, (error as any)?.stack)

        try {
          await this.prisma.vkConnectAttempt.update({
            where: { id: attempt.id },
            data: {
              status: 'FAILED',
              errorMessage: String(
              (error && typeof error === 'object' && 'message' in error)
                ? (error as any).message
                : error
            ),
              lastSeenAt: new Date()
            }
          })
        } catch (e) {
          console.error('[VK COMPLETE] ERROR saving attempt', e)
        }

        throw error
      } finally {
      if (browser) {
        try {
          await browser.close()
        } catch {}
      }
    }
  }

  async connectVkManual(userId: string, companyId: string) {
    await this.assertCompanyAccess(userId, companyId)

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { workspaceId: true },
    })

    if (!company) {
      throw new Error('Company not found')
    }

    const storagePath = '/opt/reputation-os/storage/vk-sessions/vk-session.json'

    const fs = await import('fs')
    if (!fs.existsSync(storagePath)) {
      throw new Error('VK session file not found')
    }

    // deactivate old sessions
    await this.prisma.vkAuthSession.updateMany({
      where: {
        workspaceId: company.workspaceId,
        status: 'ACTIVE',
      },
      data: {
        status: 'EXPIRED',
      },
    })

    // create new session
    console.log('[VK COMPLETE] creating vkAuthSession', {
          workspaceId: company.workspaceId,
          userId,
          storagePath
        })

        await this.prisma.vkAuthSession.create({
      data: {
        workspaceId: company.workspaceId,
        userId,
        status: 'ACTIVE',
        storageStatePath: storagePath,
      },
    })

    return { ok: true, connected: true }
  }

async disconnectVk(userId: string, companyId: string) {
    await this.assertCompanyAccess(userId, companyId)

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { workspaceId: true }
    })

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    await this.prisma.vkAuthSession.updateMany({
      where: {
        workspaceId: company.workspaceId,
        status: 'ACTIVE'
      },
      data: { status: 'EXPIRED' }
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
