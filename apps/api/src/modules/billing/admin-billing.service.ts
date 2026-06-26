import { Injectable, NotFoundException } from '@nestjs/common'
import { PlanCode, Prisma, SubscriptionStatus } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { AdminUpdateSubscriptionDto } from './dto/admin-update-subscription.dto'
import { AdminSetOverrideDto } from './dto/admin-set-override.dto'

const DEFAULT_PERIOD_DAYS = 30

@Injectable()
export class AdminBillingService {
  constructor(private readonly prisma: PrismaService) {}

  getPlans() {
    return this.prisma.plan.findMany({ orderBy: { priceMonthly: 'asc' } })
  }

  async getWorkspaces() {
    const workspaces = await this.prisma.workspace.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        subscription: { include: { plan: true } },
        featureOverrides: true,
        _count: { select: { companies: true, members: true } }
      }
    })

    return workspaces.map((ws) => ({
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      createdAt: ws.createdAt,
      companies: ws._count.companies,
      members: ws._count.members,
      planCode: ws.subscription?.plan?.code ?? PlanCode.FREE,
      subscriptionStatus: ws.subscription?.status ?? null,
      currentPeriodEnd: ws.subscription?.currentPeriodEnd ?? null,
      overrides: ws.featureOverrides.map((override) => ({
        featureKey: override.featureKey,
        value: override.value,
        note: override.note
      }))
    }))
  }

  async updateSubscription(workspaceId: string, dto: AdminUpdateSubscriptionDto) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } })

    if (!workspace) throw new NotFoundException('Workspace not found')

    if (dto.planCode === PlanCode.FREE) {
      await this.prisma.subscription.deleteMany({ where: { workspaceId } })
      return { ok: true, planCode: PlanCode.FREE }
    }

    const plan = await this.prisma.plan.findUnique({ where: { code: dto.planCode } })

    if (!plan) throw new NotFoundException('Plan not found')

    const currentPeriodEnd = dto.currentPeriodEnd
      ? new Date(dto.currentPeriodEnd)
      : new Date(Date.now() + DEFAULT_PERIOD_DAYS * 24 * 60 * 60 * 1000)

    const status = dto.status ?? SubscriptionStatus.ACTIVE

    const subscription = await this.prisma.subscription.upsert({
      where: { workspaceId },
      create: { workspaceId, planId: plan.id, status, currentPeriodEnd },
      update: { planId: plan.id, status, currentPeriodEnd }
    })

    return { ok: true, subscription }
  }

  async setOverride(workspaceId: string, dto: AdminSetOverrideDto) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } })

    if (!workspace) throw new NotFoundException('Workspace not found')

    if (dto.value === undefined || dto.value === null) {
      await this.prisma.featureOverride.deleteMany({ where: { workspaceId, featureKey: dto.featureKey } })
      return { ok: true, removed: dto.featureKey }
    }

    const override = await this.prisma.featureOverride.upsert({
      where: { workspaceId_featureKey: { workspaceId, featureKey: dto.featureKey } },
      create: {
        workspaceId,
        featureKey: dto.featureKey,
        value: dto.value as Prisma.InputJsonValue,
        note: dto.note
      },
      update: {
        value: dto.value as Prisma.InputJsonValue,
        note: dto.note
      }
    })

    return { ok: true, override }
  }
}
