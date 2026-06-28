import { Injectable, Inject } from '@nestjs/common'
import { Queue } from 'bullmq'
import { PrismaService } from '../../common/prisma/prisma.service'
import { QUEUES } from '../../common/queues/queue.names'
import { JobStatus } from '@prisma/client'

@Injectable()
export class SystemHealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('BULLMQ_CONNECTION') private readonly redis: any,
    @Inject(`QUEUE_${QUEUES.SOURCE_DISCOVERY}`) private readonly qSourceDiscovery: Queue,
    @Inject(`QUEUE_${QUEUES.REVIEWS_SYNC}`) private readonly qReviewsSync: Queue,
    @Inject(`QUEUE_${QUEUES.MENTIONS_SYNC}`) private readonly qMentionsSync: Queue,
    @Inject(`QUEUE_${QUEUES.RATING_REFRESH}`) private readonly qRatingRefresh: Queue,
    @Inject(`QUEUE_${QUEUES.RECONCILE}`) private readonly qReconcile: Queue,
    @Inject(`QUEUE_${QUEUES.NOTIFICATIONS}`) private readonly qNotifications: Queue,
    @Inject(`QUEUE_${QUEUES.PAGE_WATCH}`) private readonly qPageWatch: Queue
  ) {}

  async getHealth() {
    const [db, redis, queues, failedJobs, lastSync, worker] = await Promise.all([
      this.checkDb(),
      this.checkRedis(),
      this.checkQueues(),
      this.getFailedJobsCount(),
      this.getLastSync(),
      this.checkWorker()
    ])

    return {
      api: { status: 'ok' as const },
      database: db,
      redis,
      queues,
      failedJobs,
      lastSync,
      worker,
      telegram: { status: 'unknown' as const, reason: 'No bot health probe available' },
      push: { status: 'unknown' as const, reason: 'No probe endpoint configured' }
    }
  }

  private async checkDb() {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return { status: 'ok' as const }
    } catch (e: any) {
      return { status: 'error' as const, reason: e?.message }
    }
  }

  private async checkRedis() {
    try {
      const pong = await this.redis.ping()
      return { status: pong === 'PONG' ? ('ok' as const) : ('error' as const) }
    } catch (e: any) {
      return { status: 'error' as const, reason: e?.message }
    }
  }

  private async checkQueues() {
    const queueMap: Record<string, Queue> = {
      source_discovery: this.qSourceDiscovery,
      reviews_sync: this.qReviewsSync,
      mentions_sync: this.qMentionsSync,
      rating_refresh: this.qRatingRefresh,
      reconcile: this.qReconcile,
      notifications: this.qNotifications,
      page_watch: this.qPageWatch
    }

    const results: Record<string, any> = {}

    await Promise.all(
      Object.entries(queueMap).map(async ([name, queue]) => {
        try {
          const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed')
          results[name] = { status: 'ok', ...counts }
        } catch (e: any) {
          results[name] = { status: 'error', reason: e?.message }
        }
      })
    )

    return results
  }

  private async getFailedJobsCount() {
    try {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const count = await this.prisma.jobLog.count({
        where: { jobStatus: JobStatus.FAILED, createdAt: { gte: since24h } }
      })
      return { count, window: '24h' }
    } catch {
      return { count: 0, window: '24h' }
    }
  }

  private async checkWorker() {
    try {
      const val = await this.redis.get('worker:heartbeat')
      if (!val) return { status: 'unknown' as const, reason: 'No heartbeat — worker may not be running' }
      const ageSeconds = Math.round((Date.now() - Number(val)) / 1000)
      if (ageSeconds < 90) return { status: 'ok' as const, lastHeartbeatAgo: ageSeconds }
      return { status: 'degraded' as const, reason: `Last heartbeat ${ageSeconds}s ago`, lastHeartbeatAgo: ageSeconds }
    } catch (e: any) {
      return { status: 'error' as const, reason: e?.message }
    }
  }

  private async getLastSync() {
    try {
      const [company, jobLog] = await Promise.all([
        this.prisma.company.findFirst({
          where: { lastSyncedAt: { not: null } },
          orderBy: { lastSyncedAt: 'desc' },
          select: { lastSyncedAt: true, name: true }
        }),
        this.prisma.jobLog.findFirst({
          where: { jobStatus: JobStatus.SUCCESS, finishedAt: { not: null } },
          orderBy: { finishedAt: 'desc' },
          select: { finishedAt: true, queueName: true }
        })
      ])
      return {
        lastSyncedAt: company?.lastSyncedAt ?? null,
        company: company?.name,
        lastJobAt: jobLog?.finishedAt ?? null,
        lastJobQueue: jobLog?.queueName
      }
    } catch {
      return { lastSyncedAt: null }
    }
  }
}
