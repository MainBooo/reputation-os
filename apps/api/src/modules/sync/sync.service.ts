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

    const [mentionsJob, reviewsJob, ratingJob] = await Promise.all([
      this.mentionsSyncQueue.add(
        'mentions.sync',
        {
          companyId,
          triggeredByUserId: userId,
          requestedAt
        },
        SYNC_JOB_OPTIONS
      ),
      this.reviewsSyncQueue.add(
        'reviews.sync',
        {
          companyId,
          triggeredByUserId: userId,
          requestedAt
        },
        SYNC_JOB_OPTIONS
      ),
      this.ratingRefreshQueue.add(
        'rating.refresh',
        {
          companyId,
          triggeredByUserId: userId,
          requestedAt
        },
        SYNC_JOB_OPTIONS
      )
    ])

    const logs = await Promise.all([
      this.prisma.jobLog.create({
        data: {
          companyId,
          triggeredByUserId: userId,
          queueName: 'mentions_sync',
          jobName: 'mentions.sync',
          jobStatus: 'PENDING',
          result: {
            bullJobId: String(mentionsJob.id)
          }
        }
      }),
      this.prisma.jobLog.create({
        data: {
          companyId,
          triggeredByUserId: userId,
          queueName: 'reviews_sync',
          jobName: 'reviews.sync',
          jobStatus: 'PENDING',
          result: {
            bullJobId: String(reviewsJob.id)
          }
        }
      }),
      this.prisma.jobLog.create({
        data: {
          companyId,
          triggeredByUserId: userId,
          queueName: 'rating_refresh',
          jobName: 'rating.refresh',
          jobStatus: 'PENDING',
          result: {
            bullJobId: String(ratingJob.id)
          }
        }
      })
    ])

    return {
      queued: true,
      jobs: [
        {
          queueName: 'mentions_sync',
          jobName: 'mentions.sync',
          bullJobId: String(mentionsJob.id)
        },
        {
          queueName: 'reviews_sync',
          jobName: 'reviews.sync',
          bullJobId: String(reviewsJob.id)
        },
        {
          queueName: 'rating_refresh',
          jobName: 'rating.refresh',
          bullJobId: String(ratingJob.id)
        }
      ],
      logs
    }
  }


  private getBullJobIdFromLog(log: { result?: unknown } | null) {
    const result = log?.result as Record<string, unknown> | null
    const bullJobId = result?.bullJobId
    return bullJobId === undefined || bullJobId === null ? null : String(bullJobId)
  }

  private async getQueueJobState(queue: Queue, bullJobId: string | null) {
    if (!bullJobId) return null

    try {
      const job = await queue.getJob(bullJobId)
      if (!job) return null

      return {
        id: String(job.id),
        state: await job.getState(),
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason || null,
        timestamp: job.timestamp,
        processedOn: job.processedOn || null,
        finishedOn: job.finishedOn || null
      }
    } catch {
      return null
    }
  }

  async getSyncStatus(userId: string, companyId: string) {
    await this.assertCompanyAccess(userId, companyId)

    const logs = await this.prisma.jobLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    const latestByQueue = new Map<string, (typeof logs)[number]>()

    for (const log of logs) {
      if (!latestByQueue.has(log.queueName)) {
        latestByQueue.set(log.queueName, log)
      }
    }

    const queueEntries = [
      { queueName: 'source_discovery', queue: this.sourceDiscoveryQueue },
      { queueName: 'mentions_sync', queue: this.mentionsSyncQueue },
      { queueName: 'reviews_sync', queue: this.reviewsSyncQueue },
      { queueName: 'rating_refresh', queue: this.ratingRefreshQueue },
      { queueName: 'reconcile', queue: this.reconcileQueue }
    ]

    const queues = await Promise.all(
      queueEntries.map(async ({ queueName, queue }) => {
        const latestLog = latestByQueue.get(queueName) || null
        const bullJob = await this.getQueueJobState(queue, this.getBullJobIdFromLog(latestLog))

        return {
          queueName,
          latestLog,
          bullJob
        }
      })
    )

    const lastFailedLog = logs.find((log) => log.jobStatus === 'FAILED') || null
    const lastSuccessLog = logs.find((log) => log.jobStatus === 'SUCCESS') || null
    const hasActiveJob = queues.some((item) =>
      ['active', 'waiting', 'delayed', 'prioritized', 'waiting-children'].includes(item.bullJob?.state || '')
    )

    return {
      companyId,
      status: hasActiveJob ? 'RUNNING' : lastFailedLog ? 'FAILED' : lastSuccessLog ? 'SUCCESS' : 'PENDING',
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
}
