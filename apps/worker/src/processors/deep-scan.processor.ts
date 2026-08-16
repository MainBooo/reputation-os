import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Job, Queue, Worker } from 'bullmq'
import { PrismaService } from '../common/prisma/prisma.service'
import { QUEUES } from '../queues/queue.names'
import { JOBS } from '../queues/job.names'
import { CRON_JOB_OPTIONS } from '../queues/job-options'
import { JobEligibilityService } from '../services/job-eligibility.service'

const AUTO_ORIGINS = ['auto', 'auto-bootstrap', 'auto-bootstrap-backfill']
const DEEP_SCAN_CHECK_INTERVAL_MIN = 7 * 24 * 60 // 7 дней — отличает DeepScan-происхождение от ручных 1440

// DeepScan: раз в неделю промоутит уже найденные WebMentionAdapter'ом (mentions-sync,
// scope=WEB) необработанные источники в постоянный мониторинг WatchedPage — не ищет
// сам, никаких новых вызовов Yandex Search API.
@Injectable()
export class DeepScanProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeepScanProcessor.name)
  private worker!: Worker

  constructor(
    @Inject('BULLMQ_CONNECTION') private readonly connection: any,
    private readonly prisma: PrismaService,
    private readonly eligibility: JobEligibilityService
  ) {}

  async onModuleInit() {
    this.worker = new Worker(
      QUEUES.DEEP_SCAN,
      async (job: Job) => this.handle(job),
      { connection: this.connection, concurrency: 1, lockDuration: 3 * 60_000 }
    )
    this.worker.on('error', (err) => this.logger.error('Worker error', err))
    this.worker.on('failed', (_job, err) => this.logger.error(`DeepScan job failed: ${err?.message}`))
    await this.worker.waitUntilReady()
    this.logger.log('DeepScan worker READY')
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close()
  }

  private isPromotable(config: unknown) {
    const cfg = config && typeof config === 'object' && !Array.isArray(config) ? config as Record<string, any> : {}
    if (cfg.lastError) return false
    if (cfg.status === 'EXCLUDED' || cfg.excluded === true) return false
    return AUTO_ORIGINS.includes(cfg.origin)
  }

  async handle(_job: Job) {
    const candidates = await (this.prisma as any).companySourceTarget.findMany({
      where: {
        isActive: false,
        externalUrl: { not: null },
        company: { isActive: true, workspace: { isActive: true } },
        source: { platform: 'WEB', isEnabled: true }
      },
      select: { id: true, companyId: true, externalUrl: true, config: true, company: { select: { workspaceId: true } } }
    })

    const byWorkspace = new Map<string, typeof candidates>()
    for (const target of candidates) {
      const workspaceId = target.company.workspaceId
      const list = byWorkspace.get(workspaceId) || []
      list.push(target)
      byWorkspace.set(workspaceId, list)
    }

    let promoted = 0
    let skipped = 0
    let planLimited = 0

    for (const [workspaceId, targets] of byWorkspace.entries()) {
      const limits = await this.eligibility.getEffectiveWebLimits(workspaceId)

      if (!limits.webMonitoringEnabled || limits.maxWebPages === 0) {
        planLimited += targets.length
        continue
      }

      let headroom = limits.maxWebPages
      if (headroom !== -1) {
        const currentActive = await (this.prisma as any).watchedPage.count({
          where: { enabled: true, company: { workspaceId } }
        })
        headroom = Math.max(0, limits.maxWebPages - currentActive)
      }

      let sourceHeadroom = limits.maxSources
      if (sourceHeadroom !== -1) {
        const currentSources = await (this.prisma as any).companySourceTarget.count({
          where: {
            isActive: true,
            company: { workspaceId, isActive: true },
            source: { isEnabled: true, platform: { not: 'TELEGRAM' } }
          }
        })
        sourceHeadroom = Math.max(0, limits.maxSources - currentSources)
      }

      for (const target of targets) {
        if (!await this.eligibility.canRunWebCompany(workspaceId, target.companyId)) {
          planLimited++
          continue
        }
        if (!this.isPromotable(target.config)) {
          skipped++
          continue
        }

        if ((headroom !== -1 && headroom <= 0) || (sourceHeadroom !== -1 && sourceHeadroom <= 0)) {
          planLimited++
          continue
        }

        let domain: string
        try {
          domain = new URL(target.externalUrl).hostname.replace(/^www\./, '')
        } catch {
          skipped++
          continue
        }

        // isActive=true выводит таргет из кандидатов DeepScan; syncMentionsEnabled
        // НЕ включаем — иначе mentions-sync начинает гонять Yandex Search API
        // по каждому промоутнутому URL (поисковые запросы строятся из имени
        // компании, так что это чистые дубли).
        await (this.prisma as any).companySourceTarget.update({
          where: { id: target.id },
          data: { isActive: true }
        })

        await (this.prisma as any).watchedPage.upsert({
          where: { companyId_url: { companyId: target.companyId, url: target.externalUrl } },
          create: {
            companyId: target.companyId,
            sourceTargetId: target.id,
            url: target.externalUrl,
            domain,
            pageType: 'UNKNOWN',
            enabled: true,
            checkIntervalMin: DEEP_SCAN_CHECK_INTERVAL_MIN
          },
          update: {
            sourceTargetId: target.id,
            enabled: true
          }
        })

        promoted++
        if (headroom !== -1) headroom--
        if (sourceHeadroom !== -1) sourceHeadroom--
      }
    }

    this.logger.log(`DeepScan: candidates=${candidates.length} promoted=${promoted} skipped=${skipped} planLimited=${planLimited}`)
  }

  // Called by SchedulerService to register the recurring weekly cron job
  async ensureCron(deepScanQueue: Queue) {
    await deepScanQueue.add(
      JOBS.DEEP_SCAN_PROMOTE,
      { autoCron: true },
      {
        ...CRON_JOB_OPTIONS,
        repeat: { every: 7 * 24 * 60 * 60 * 1000 },
        jobId: 'deep-scan:global'
      }
    )
  }
}
