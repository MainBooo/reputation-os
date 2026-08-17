import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Platform, PlanCode, Prisma, SubscriptionStatus } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { FEATURE_KEYS, FREE_LIMITS, FeatureKey, PlanLimits } from './billing.constants'

/** Дефолтные лимиты по коду плана — используются как база поверх FREE_LIMITS,
 *  затем перекрываются реальными limits из БД. */
const CODE_DEFAULTS: Partial<Record<PlanCode, PlanLimits>> = {
  [PlanCode.FREE]: {
    maxCompanies: 1,
    maxAiRepliesPerMonth: 5,
    platforms: [Platform.YANDEX, Platform.TWOGIS],
    telegramNotifications: false,
    advancedAnalytics: false,
    pushNotificationsEnabled: true,
    webMonitoringEnabled: false,
    maxSources: 2,
    maxMembers: 1,
    maxWebPages: 0,
    telegramMonitoringEnabled: false
  },
  [PlanCode.START]: {
    maxCompanies: 3,
    maxAiRepliesPerMonth: 50,
    platforms: [Platform.YANDEX, Platform.TWOGIS],
    telegramNotifications: false,
    advancedAnalytics: false,
    pushNotificationsEnabled: true,
    webMonitoringEnabled: false,
    maxSources: 6,
    maxMembers: 2,
    maxWebPages: 0,
    telegramMonitoringEnabled: false
  },
  [PlanCode.PRO]: {
    maxCompanies: 10,
    maxAiRepliesPerMonth: -1,
    platforms: [Platform.YANDEX, Platform.TWOGIS, Platform.WEB, Platform.TELEGRAM],
    telegramNotifications: true,
    advancedAnalytics: true,
    pushNotificationsEnabled: true,
    webMonitoringEnabled: true,
    maxSources: 40,
    maxMembers: 5,
    maxWebPages: 50,
    telegramMonitoringEnabled: true
  },
  [PlanCode.AGENCY]: {
    maxCompanies: 100,
    maxAiRepliesPerMonth: -1,
    platforms: [Platform.YANDEX, Platform.TWOGIS, Platform.WEB, Platform.TELEGRAM],
    telegramNotifications: true,
    advancedAnalytics: true,
    pushNotificationsEnabled: true,
    webMonitoringEnabled: true,
    maxSources: 500,
    maxMembers: 20,
    maxWebPages: 200,
    telegramMonitoringEnabled: true
  }
}

export interface WorkspaceEntitlements {
  workspaceId: string
  planCode: PlanCode
  planName: string
  priceMonthly: number
  subscriptionStatus: SubscriptionStatus | null
  currentPeriodEnd: Date | null
  currentPeriodStart: Date | null
  billingPeriod: string | null
  scheduledPlanCode: PlanCode | null
  scheduledAt: Date | null
  trialEndsAt: Date | null
  limits: PlanLimits
  effective: PlanLimits
  overrides: Partial<Record<FeatureKey, unknown>>
  usage: { companies: number; companiesCount: number; aiRepliesThisMonth: number; sourcesCount: number }
  workspaceActive: boolean
}

@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name)

  constructor(private readonly prisma: PrismaService) {}

  async resolveWorkspaceId(userId: string): Promise<string> {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { workspaceId: true }
    })

    if (!member) throw new NotFoundException('Workspace not found for user')

    return member.workspaceId
  }

  async getForUser(userId: string): Promise<WorkspaceEntitlements> {
    const workspaceId = await this.resolveWorkspaceId(userId)
    return this.getForWorkspace(workspaceId)
  }

  /** Проверяет, что пользователь состоит в указанном workspace — для явного workspaceId с фронтенда. */
  async assertMember(userId: string, workspaceId: string): Promise<void> {
    const member = await this.prisma.workspaceMember.findFirst({ where: { userId, workspaceId } })
    if (!member) throw new ForbiddenException('No access to workspace')
  }

  // Единственное место, считающее источники против maxSources — раньше эта
  // ровно одна и та же выборка (TELEGRAM исключён: Scout гейтится отдельно
  // через telegramMonitoringEnabled и не расходует maxSources) была
  // продублирована в CompaniesService, SyncService и здесь же по отдельности,
  // с риском разъехаться при следующем изменении тарифных правил.
  async countBillableSources(
    workspaceId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma
  ): Promise<number> {
    return client.companySourceTarget.count({
      where: {
        company: { workspaceId },
        isActive: true,
        source: { platform: { not: 'TELEGRAM' } }
      }
    })
  }

  async hasSourceSlotAvailable(workspaceId: string, maxSources: number): Promise<boolean> {
    const limit = Number(maxSources)
    if (limit < 0) return true
    return (await this.countBillableSources(workspaceId)) < limit
  }

  /**
   * Serializes every billable source-target reservation for a workspace. The
   * count and mutation must share the same transaction; a standalone
   * `hasSourceSlotAvailable()` check is advisory only and is unsafe for writes.
   */
  async runWithSourceSlot<T>(
    workspaceId: string,
    maxSources: number,
    action: (tx: Prisma.TransactionClient) => Promise<T>,
    options: {
      skipIfFull: true
      consumeSlot?: boolean
      findExisting?: (tx: Prisma.TransactionClient) => Promise<T | null>
    }
  ): Promise<T | null>
  async runWithSourceSlot<T>(
    workspaceId: string,
    maxSources: number,
    action: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: {
      skipIfFull?: false
      consumeSlot?: boolean
      findExisting?: (tx: Prisma.TransactionClient) => Promise<T | null>
    }
  ): Promise<T>
  async runWithSourceSlot<T>(
    workspaceId: string,
    maxSources: number,
    action: (tx: Prisma.TransactionClient) => Promise<T>,
    options: {
      skipIfFull?: boolean
      consumeSlot?: boolean
      findExisting?: (tx: Prisma.TransactionClient) => Promise<T | null>
    } = {}
  ): Promise<T | null> {
    const limit = Number(maxSources)

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reputation-os:source-slot:${workspaceId}`}))`

      const existing = options.findExisting ? await options.findExisting(tx) : null
      if (existing) return existing

      if (options.consumeSlot !== false && limit >= 0 && (await this.countBillableSources(workspaceId, tx)) >= limit) {
        if (options.skipIfFull) return null
        throw new ForbiddenException({ code: 'PLAN_LIMIT', feature: 'maxSources', limit })
      }

      return action(tx)
    })
  }

  async runWithWebPageSlotInTransaction<T>(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    maxWebPages: number,
    consumesSlot: (tx: Prisma.TransactionClient) => Promise<boolean>,
    action: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    const limit = Number(maxWebPages)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reputation-os:web-page-slot:${workspaceId}`}))`

    if (limit >= 0 && await consumesSlot(tx)) {
      const activePages = await tx.watchedPage.count({
        where: { enabled: true, company: { workspaceId } }
      })
      if (activePages >= limit) {
        throw new ForbiddenException({ code: 'PLAN_LIMIT', feature: 'maxWebPages', limit })
      }
    }

    return action(tx)
  }

  /** Serializes company creation so concurrent requests cannot exceed maxCompanies. */
  async runWithCompanySlot<T>(
    workspaceId: string,
    maxCompanies: number,
    action: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    const limit = Number(maxCompanies)

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reputation-os:company-slot:${workspaceId}`}))`

      if (limit >= 0) {
        const companiesCount = await tx.company.count({ where: { workspaceId } })
        if (companiesCount >= limit) {
          throw new ForbiddenException({ code: 'PLAN_LIMIT', feature: 'maxCompanies', limit })
        }
      }

      return action(tx)
    })
  }

  async getForWorkspace(workspaceId: string): Promise<WorkspaceEntitlements> {
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)
    const activeReservationSince = new Date(Date.now() - 2 * 60 * 1000)

    const [subscription, overrides, companies, aiRepliesThisMonth, workspace, sourcesCount] = await Promise.all([
      this.prisma.subscription.findUnique({
        where: { workspaceId },
        include: { plan: true, scheduledPlan: true }
      }),
      this.prisma.featureOverride.findMany({ where: { workspaceId } }),
      this.prisma.company.count({ where: { workspaceId } }),
      this.prisma.aIReplyDraft.count({
        where: {
          company: { workspaceId },
          createdAt: { gte: monthStart },
          OR: [
            { status: 'READY' },
            { status: 'GENERATING', createdAt: { gte: activeReservationSince } }
          ]
        }
      }),
      this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { isActive: true } }),
      this.countBillableSources(workspaceId)
    ])

    let planCode: PlanCode = PlanCode.FREE
    let planName = 'Бесплатный'
    let priceMonthly = 0
    let limits: PlanLimits = { ...FREE_LIMITS }

    const now = new Date()
    const isSubActive =
      subscription &&
      ((subscription.status === SubscriptionStatus.ACTIVE &&
        subscription.currentPeriodEnd != null &&
        subscription.currentPeriodEnd > now) ||
        subscription.status === SubscriptionStatus.MANUAL ||
        (subscription.status === SubscriptionStatus.TRIAL &&
          subscription.trialEndsAt != null &&
          subscription.trialEndsAt > now))

    if (isSubActive) {
      const effectivePlan =
        subscription!.scheduledPlan && subscription!.scheduledAt && subscription!.scheduledAt <= now
          ? subscription!.scheduledPlan
          : subscription!.plan

      planCode = effectivePlan.code
      planName = effectivePlan.name
      priceMonthly = effectivePlan.priceMonthly
      // Merge: FREE_LIMITS (fallback) <- code defaults <- DB plan.limits
      const codeBase = CODE_DEFAULTS[planCode] ?? FREE_LIMITS
      limits = { ...FREE_LIMITS, ...codeBase, ...(effectivePlan.limits as Partial<PlanLimits>) }
    }

    const overrideMap: Partial<Record<FeatureKey, unknown>> = {}
    const mutableLimits = limits as unknown as Record<string, unknown>

    for (const override of overrides) {
      const key = override.featureKey as FeatureKey
      if (!FEATURE_KEYS.includes(key)) continue
      overrideMap[key] = override.value
      mutableLimits[key] = override.value
    }

    return {
      workspaceId,
      planCode,
      planName,
      priceMonthly,
      subscriptionStatus: subscription?.status ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      currentPeriodStart: subscription?.currentPeriodStart ?? null,
      billingPeriod:
        subscription?.scheduledPlan && subscription?.scheduledAt && subscription.scheduledAt <= now
          ? subscription.scheduledBillingPeriod ?? subscription.billingPeriod
          : subscription?.billingPeriod ?? null,
      scheduledPlanCode:
        subscription?.scheduledPlan && subscription?.scheduledAt && subscription.scheduledAt > now
          ? subscription.scheduledPlan.code
          : null,
      scheduledAt: subscription?.scheduledAt ?? null,
      trialEndsAt: subscription?.trialEndsAt ?? null,
      limits,
      effective: limits,
      overrides: overrideMap,
      usage: { companies, companiesCount: companies, aiRepliesThisMonth, sourcesCount },
      workspaceActive: workspace?.isActive ?? true
    }
  }

  async can(workspaceId: string, feature: 'telegramNotifications' | 'advancedAnalytics'): Promise<boolean> {
    const entitlements = await this.getForWorkspace(workspaceId)
    return Boolean(entitlements.limits[feature])
  }
}
