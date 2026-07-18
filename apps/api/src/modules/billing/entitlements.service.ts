import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Platform, PlanCode, SubscriptionStatus } from '@prisma/client'
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
  trialEndsAt: Date | null
  limits: PlanLimits
  effective: PlanLimits
  overrides: Partial<Record<FeatureKey, unknown>>
  usage: { companies: number; companiesCount: number; aiRepliesThisMonth: number }
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

  async getForWorkspace(workspaceId: string): Promise<WorkspaceEntitlements> {
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)

    const [subscription, overrides, companies, aiRepliesThisMonth, workspace] = await Promise.all([
      this.prisma.subscription.findUnique({
        where: { workspaceId },
        include: { plan: true }
      }),
      this.prisma.featureOverride.findMany({ where: { workspaceId } }),
      this.prisma.company.count({ where: { workspaceId } }),
      this.prisma.aIReplyDraft.count({
        where: { company: { workspaceId }, createdAt: { gte: monthStart } }
      }),
      this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { isActive: true } })
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
      planCode = subscription!.plan.code
      planName = subscription!.plan.name
      priceMonthly = subscription!.plan.priceMonthly
      // Merge: FREE_LIMITS (fallback) <- code defaults <- DB plan.limits
      const codeBase = CODE_DEFAULTS[planCode] ?? FREE_LIMITS
      limits = { ...FREE_LIMITS, ...codeBase, ...(subscription!.plan.limits as Partial<PlanLimits>) }
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
      trialEndsAt: subscription?.trialEndsAt ?? null,
      limits,
      effective: limits,
      overrides: overrideMap,
      usage: { companies, companiesCount: companies, aiRepliesThisMonth },
      workspaceActive: workspace?.isActive ?? true
    }
  }

  async can(workspaceId: string, feature: 'telegramNotifications' | 'advancedAnalytics'): Promise<boolean> {
    const entitlements = await this.getForWorkspace(workspaceId)
    return Boolean(entitlements.limits[feature])
  }
}
