import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { Queue } from 'bullmq'
import { PrismaService } from '../../common/prisma/prisma.service'
import { SYNC_JOB_OPTIONS } from '../../common/queues/job-options'

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('SYNC_QUEUE_SOURCE_DISCOVERY')
    private readonly sourceDiscoveryQueue: Queue,
    @Inject('SYNC_QUEUE_MENTIONS_SYNC')
    private readonly mentionsSyncQueue: Queue,
    @Inject('SYNC_QUEUE_REVIEWS_SYNC')
    private readonly reviewsSyncQueue: Queue,
    @Inject('SYNC_QUEUE_RATING_REFRESH')
    private readonly ratingRefreshQueue: Queue,
    @Inject('SYNC_QUEUE_RECONCILE')
    private readonly reconcileQueue: Queue
  ) {}

  private async assertCompanyAccess(userId: string, companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, workspaceId: true }
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

    return company
  }

  async discoverSources(userId: string, companyId: string) {
    await this.assertCompanyAccess(userId, companyId)

    const job = await this.sourceDiscoveryQueue.add(
      'source.discovery',
      {
        companyId,
        triggeredByUserId: userId,
        requestedAt: new Date().toISOString()
      },
      SYNC_JOB_OPTIONS
    )

    const log = await this.prisma.jobLog.create({
      data: {
        companyId,
        triggeredByUserId: userId,
        queueName: 'source_discovery',
        jobName: 'source.discovery',
        jobStatus: 'PENDING',
        result: {
          bullJobId: String(job.id)
        }
      }
    })

    return {
      queued: true,
      jobs: [
        {
          queueName: 'source_discovery',
          jobName: 'source.discovery',
          bullJobId: String(job.id)
        }
      ],
      logs: [log]
    }
  }

  async startSync(userId: string, companyId: string) {
    await this.assertCompanyAccess(userId, companyId)

    const requestedAt = new Date().toISOString()

    const reviewsJob = await this.reviewsSyncQueue.add(
      'reviews.sync',
      {
        companyId,
        triggeredByUserId: userId,
        requestedAt,
        scope: 'REVIEWS'
      },
      SYNC_JOB_OPTIONS
    )

    const log = await this.prisma.jobLog.create({
      data: {
        companyId,
        triggeredByUserId: userId,
        queueName: 'reviews_sync',
        jobName: 'reviews.sync',
        jobStatus: 'PENDING',
        result: {
          bullJobId: String(reviewsJob.id),
          scope: 'REVIEWS'
        }
      }
    })

    return {
      queued: true,
      jobs: [
        {
          queueName: 'reviews_sync',
          jobName: 'reviews.sync',
          bullJobId: String(reviewsJob.id)
        }
      ],
      logs: [log]
    }
  }

  async startWebSync(userId: string, companyId: string) {
    await this.ensureWebBootstrapTarget(companyId)
    await this.assertCompanyAccess(userId, companyId)

    const requestedAt = new Date().toISOString()

    const mentionsJob = await this.mentionsSyncQueue.add(
      'mentions.sync',
      {
        companyId,
        triggeredByUserId: userId,
        requestedAt,
        scope: 'WEB'
      },
      SYNC_JOB_OPTIONS
    )

    const log = await this.prisma.jobLog.create({
      data: {
        companyId,
        triggeredByUserId: userId,
        queueName: 'mentions_sync',
        jobName: 'mentions.sync',
        jobStatus: 'PENDING',
        result: {
          bullJobId: String(mentionsJob.id),
          scope: 'WEB'
        }
      }
    })

    return {
      queued: true,
      jobs: [
        {
          queueName: 'mentions_sync',
          jobName: 'mentions.sync',
          bullJobId: String(mentionsJob.id)
        }
      ],
      logs: [log]
    }
  }

  private getBullJobIdFromLog(log: any) {
    const result = log?.result as Record<string, unknown> | null
    const bullJobId = result?.bullJobId

    return bullJobId === undefined || bullJobId === null ? null : String(bullJobId)
  }

  private async getQueueJobState(queue: Queue, jobId?: string | null) {
    if (!jobId) return null

    try {
      const job = await queue.getJob(jobId)
      if (!job) return null

      return {
        id: String(job.id),
        state: await job.getState()
      }
    } catch {
      return null
    }
  }

  async getSyncStatus(userId: string, companyId: string) {
    await this.assertCompanyAccess(userId, companyId)

    const relevantQueues = ['mentions_sync', 'reviews_sync', 'rating_refresh']

    const logs = await this.prisma.jobLog.findMany({
      where: {
        companyId,
        queueName: { in: relevantQueues }
      },
      orderBy: { createdAt: 'desc' },
      take: 30
    })

    const latestByQueue = new Map<string, (typeof logs)[number]>()

    for (const log of logs) {
      if (!latestByQueue.has(log.queueName)) {
        latestByQueue.set(log.queueName, log)
      }
    }

    const queueEntries = [
      { queueName: 'mentions_sync', queue: this.mentionsSyncQueue },
      { queueName: 'reviews_sync', queue: this.reviewsSyncQueue },
      { queueName: 'rating_refresh', queue: this.ratingRefreshQueue }
    ]

    const resolveEffectiveStatus = (log: (typeof logs)[number] | null, bullJob: Awaited<ReturnType<typeof this.getQueueJobState>>) => {
      const state = bullJob?.state || null

      if (['active', 'waiting', 'delayed', 'prioritized', 'waiting-children'].includes(state || '')) return 'RUNNING'
      if (state === 'completed' && log?.jobStatus === 'PENDING') return 'SUCCESS'
      if (state === 'failed' && log?.jobStatus === 'PENDING') return 'FAILED'

      return log?.jobStatus || 'PENDING'
    }

    const queues = await Promise.all(
      queueEntries.map(async ({ queueName, queue }) => {
        const latestLog = latestByQueue.get(queueName) || null
        const bullJob = await this.getQueueJobState(queue, this.getBullJobIdFromLog(latestLog))
        const effectiveStatus = resolveEffectiveStatus(latestLog, bullJob)

        return {
          queueName,
          latestLog,
          bullJob,
          effectiveStatus
        }
      })
    )

    const hasActiveJob = queues.some((item) => item.effectiveStatus === 'RUNNING')
    const latestRelevantLogs = queues.map((item) => item.latestLog).filter(Boolean) as typeof logs
    const lastFailedLog = latestRelevantLogs.find((log) => log.jobStatus === 'FAILED') || null
    const lastSuccessLog = latestRelevantLogs.find((log) => log.jobStatus === 'SUCCESS') || null
    const hasFailedLatest = queues.some((item) => item.effectiveStatus === 'FAILED')
    const hasSuccessLatest = queues.some((item) => item.effectiveStatus === 'SUCCESS')
    const hasAnyLatest = queues.some((item) => item.latestLog)

    return {
      companyId,
      status: hasActiveJob ? 'RUNNING' : hasFailedLatest ? 'FAILED' : hasSuccessLatest ? 'SUCCESS' : hasAnyLatest ? 'PENDING' : 'PENDING',
      hasActiveJob,
      lastFailedLog,
      lastSuccessLog,
      queues,
      logs
    }
  }

  async tick() {
    return this.prisma.jobLog.create({
      data: {
        queueName: 'mentions_sync',
        jobName: 'internal.jobs.tick',
        jobStatus: 'SUCCESS',
        result: { tickedAt: new Date().toISOString() }
      }
    })
  }

  async reconcile() {
    const job = await this.reconcileQueue.add(
      'reconcile.run',
      {
        requestedAt: new Date().toISOString()
      },
      SYNC_JOB_OPTIONS
    )

    const log = await this.prisma.jobLog.create({
      data: {
        queueName: 'reconcile',
        jobName: 'reconcile.run',
        jobStatus: 'PENDING',
        result: {
          bullJobId: String(job.id)
        }
      }
    })

    return {
      queued: true,
      jobs: [
        {
          queueName: 'reconcile',
          jobName: 'reconcile.run',
          bullJobId: String(job.id)
        }
      ],
      logs: [log]
    }
  }
  private async ensureWebBootstrapTarget(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        normalizedName: true,
        city: true,
        normalizedCity: true,
        website: true,
        normalizedWebsite: true,
      },
    })

    if (!company) {
      throw new Error(`Company not found: ${companyId}`)
    }

    let webSource = await this.prisma.source.findFirst({
      where: {
        workspaceId: company.workspaceId,
        platform: 'WEB',
        type: 'WEB_MENTION_FEED',
      },
    })

    if (!webSource) {
      webSource = await this.prisma.source.create({
        data: {
          workspaceId: company.workspaceId,
          name: 'WEB monitoring',
          platform: 'WEB',
          type: 'WEB_MENTION_FEED',
          baseUrl: null,
          isEnabled: true,
          config: {
            origin: 'auto-bootstrap',
          },
        },
      })
    }

    const externalPlaceId = `web-bootstrap:${company.id}`

    const existingTarget = await this.prisma.companySourceTarget.findFirst({
      where: {
        companyId: company.id,
        sourceId: webSource.id,
        externalPlaceId,
      },
    })

    if (existingTarget) return existingTarget

    return this.prisma.companySourceTarget.create({
      data: {
        companyId: company.id,
        sourceId: webSource.id,
        externalPlaceId,
        externalUrl: company.website || null,
        displayName: `${company.name} · WEB discovery`,
        isActive: true,
        syncReviewsEnabled: false,
        syncRatingsEnabled: false,
        syncMentionsEnabled: true,
        config: {
          origin: 'auto-bootstrap',
          mode: 'discovery',
          querySeeds: [
            company.name,
            company.city ? `${company.name} ${company.city}` : company.name,
            company.normalizedName,
            company.normalizedCity ? `${company.normalizedName} ${company.normalizedCity}` : company.normalizedName,
          ].filter(Boolean),
          scanIntervalHours: 24,
        },
      },
    })
  }


}
