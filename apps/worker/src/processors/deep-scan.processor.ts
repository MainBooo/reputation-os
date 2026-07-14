import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Job, Queue, Worker } from 'bullmq'
import { PrismaService } from '../common/prisma/prisma.service'
import { QUEUES } from '../queues/queue.names'
import { JOBS } from '../queues/job.names'
import { CRON_JOB_OPTIONS } from '../queues/job-options'

const AUTO_ORIGINS = ['auto', 'auto-bootstrap', 'auto-bootstrap-backfill']
const DEEP_SCAN_CHECK_INTERVAL_MIN = 7 * 24 * 60 // 7 дней — отличает DeepScan-происхождение от ручных 1440

// Дефолты по плану — держать в синхроне с apps/api/src/modules/billing/entitlements.service.ts
// (CODE_DEFAULTS) и billing.constants.ts (FREE_LIMITS). Нужны только 2 поля из полного PlanLimits.
const FREE_WEB_LIMITS = { webMonitoringEnabled: false, maxWebPages: 0 }
const PLAN_WEB_LIMITS: Record<string, { webMonitoringEnabled: boolean; maxWebPages: number }> = {
  FREE: FREE_WEB_LIMITS,
  START: { webMonitoringEnabled: false, maxWebPages: 0 },
  PRO: { webMonitoringEnabled: true, maxWebPages: 50 },
  AGENCY: { webMonitoringEnabled: true, maxWebPages: 200 }
}

// DeepScan: раз в неделю промоутит уже найденные WebMentionAdapter'ом (mentions-sync,
// scope=WEB) необработанные источники в постоянный мониторинг WatchedPage — не ищет
// сам, никаких новых вызовов Yandex Search API.
@Injectable()
export class DeepScanProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeepScanProcessor.name)
  private worker!: Worker

  constructor(
    @Inject('BULLMQ_CONNECTION') private readonly connection: any,
    private readonly prisma: PrismaService
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

  // Мини-версия entitlements.service.ts::getForWorkspace, только webMonitoringEnabled/maxWebPages.
  private async getEffectiveWebLimits(workspaceId: string) {
    const [subscription, overrides] = await Promise.all([
      (this.prisma as any).subscription.findUnique({ where: { workspaceId }, include: { plan: true } }),
      (this.prisma as any).featureOverride.findMany({ where: { workspaceId, featureKey: { in: ['webMonitoringEnabled', 'maxWebPages'] } } })
    ])

    const now = new Date()
    const isSubActive =
      subscription &&
      ((subscription.status === 'ACTIVE' && subscription.currentPeriodEnd != null && subscription.currentPeriodEnd > now) ||
        subscription.status === 'MANUAL' ||
        (subscription.status === 'TRIAL' && subscription.trialEndsAt != null && subscription.trialEndsAt > now))

    let limits = { ...FREE_WEB_LIMITS }
    if (isSubActive) {
      const codeDefaults = PLAN_WEB_LIMITS[subscription.plan.code] ?? FREE_WEB_LIMITS
      const dbLimits = subscription.plan.limits as Record<string, any> | null
      limits = {
        webMonitoringEnabled: dbLimits?.webMonitoringEnabled ?? codeDefaults.webMonitoringEnabled,
        maxWebPages: dbLimits?.maxWebPages ?? codeDefaults.maxWebPages
      }
    }

    for (const override of overrides) {
      if (override.featureKey === 'webMonitoringEnabled') limits.webMonitoringEnabled = override.value as boolean
      if (override.featureKey === 'maxWebPages') limits.maxWebPages = override.value as number
    }

    return limits
  }

  async handle(_job: Job) {
    const candidates = await (this.prisma as any).companySourceTarget.findMany({
      where: {
        isActive: false,
        externalUrl: { not: null },
        company: { isActive: true },
        source: { platform: 'WEB' }
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
      const limits = await this.getEffectiveWebLimits(workspaceId)

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

      for (const target of targets) {
        if (!this.isPromotable(target.config)) {
          skipped++
          continue
        }

        if (headroom !== -1 && headroom <= 0) {
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
