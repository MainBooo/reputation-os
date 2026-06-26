import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PlanCode, SubscriptionStatus } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { FEATURE_KEYS, FREE_LIMITS, FeatureKey, PlanLimits } from './billing.constants'

export interface WorkspaceEntitlements {
  workspaceId: string
  planCode: PlanCode
  planName: string
  priceMonthly: number
  subscriptionStatus: SubscriptionStatus | null
  currentPeriodEnd: Date | null
  limits: PlanLimits
  effective: PlanLimits
  overrides: Partial<Record<FeatureKey, unknown>>
  usage: { companies: number; companiesCount: number; aiRepliesThisMonth: number }
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

    const [subscription, overrides, companies, aiRepliesThisMonth] = await Promise.all([
      this.prisma.subscription.findUnique({
        where: { workspaceId },
        include: { plan: true }
      }),
      this.prisma.featureOverride.findMany({ where: { workspaceId } }),
      this.prisma.company.count({ where: { workspaceId } }),
      this.prisma.aIReplyDraft.count({
        where: { company: { workspaceId }, createdAt: { gte: monthStart } }
      })
    ])

    let planCode: PlanCode = PlanCode.FREE
    let planName = 'Бесплатный'
    let priceMonthly = 0
    let limits: PlanLimits = { ...FREE_LIMITS }

    if (
      subscription &&
      subscription.status === SubscriptionStatus.ACTIVE &&
      subscription.currentPeriodEnd > new Date()
    ) {
      planCode = subscription.plan.code
      planName = subscription.plan.name
      priceMonthly = subscription.plan.priceMonthly
      limits = { ...FREE_LIMITS, ...(subscription.plan.limits as Partial<PlanLimits>) }
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
      limits,
      effective: limits,
      overrides: overrideMap,
      usage: { companies, companiesCount: companies, aiRepliesThisMonth }
    }
  }

  async can(workspaceId: string, feature: 'telegramNotifications' | 'advancedAnalytics'): Promise<boolean> {
    const entitlements = await this.getForWorkspace(workspaceId)
    return Boolean(entitlements.limits[feature])
  }
}
