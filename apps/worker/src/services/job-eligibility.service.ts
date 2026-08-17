import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../common/prisma/prisma.service'

type SyncCapability = 'reviews' | 'mentions' | 'ratings'

interface EffectiveSyncLimits {
  platforms: string[]
  webMonitoringEnabled: boolean
  telegramMonitoringEnabled: boolean
  maxWebPages: number
  maxCompanies: number
  maxSources: number
  pushNotificationsEnabled: boolean
  telegramNotifications: boolean
}

const FREE_SYNC_LIMITS: EffectiveSyncLimits = {
  platforms: ['YANDEX', 'TWOGIS'],
  webMonitoringEnabled: false,
  telegramMonitoringEnabled: false,
  maxWebPages: 0,
  maxCompanies: 1,
  maxSources: 2,
  pushNotificationsEnabled: true,
  telegramNotifications: false
}

const PLAN_SYNC_LIMITS: Record<string, EffectiveSyncLimits> = {
  FREE: FREE_SYNC_LIMITS,
  START: { ...FREE_SYNC_LIMITS, maxCompanies: 3, maxSources: 6 },
  STARTER: { ...FREE_SYNC_LIMITS, maxCompanies: 3, maxSources: 6 },
  PRO: {
    platforms: ['YANDEX', 'TWOGIS', 'WEB', 'TELEGRAM'],
    webMonitoringEnabled: true,
    telegramMonitoringEnabled: true,
    maxWebPages: 50,
    maxCompanies: 10,
    maxSources: 40,
    pushNotificationsEnabled: true,
    telegramNotifications: true
  },
  BUSINESS: {
    platforms: ['YANDEX', 'TWOGIS', 'WEB', 'TELEGRAM'],
    webMonitoringEnabled: true,
    telegramMonitoringEnabled: true,
    maxWebPages: 50,
    maxCompanies: 10,
    maxSources: 40,
    pushNotificationsEnabled: true,
    telegramNotifications: true
  },
  AGENCY: {
    platforms: ['YANDEX', 'TWOGIS', 'WEB', 'TELEGRAM'],
    webMonitoringEnabled: true,
    telegramMonitoringEnabled: true,
    maxWebPages: 200,
    maxCompanies: 100,
    maxSources: 500,
    pushNotificationsEnabled: true,
    telegramNotifications: true
  },
  ENTERPRISE: {
    platforms: ['YANDEX', 'TWOGIS', 'WEB', 'TELEGRAM'],
    webMonitoringEnabled: true,
    telegramMonitoringEnabled: true,
    maxWebPages: -1,
    maxCompanies: -1,
    maxSources: -1,
    pushNotificationsEnabled: true,
    telegramNotifications: true
  },
  CUSTOM: {
    platforms: ['YANDEX', 'TWOGIS', 'WEB', 'TELEGRAM'],
    webMonitoringEnabled: true,
    telegramMonitoringEnabled: true,
    maxWebPages: -1,
    maxCompanies: -1,
    maxSources: -1,
    pushNotificationsEnabled: true,
    telegramNotifications: true
  }
}

/**
 * The last server-side gate before a background job is allowed to perform an
 * external request. Queue payloads and repeatable registrations are never a
 * source of authority: current workspace/subscription/entity state is read
 * from Postgres for every run.
 */
@Injectable()
export class JobEligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  private async getEffectiveLimits(workspaceId: string): Promise<EffectiveSyncLimits> {
    const prisma = this.prisma as any
    const [subscription, overrides] = await Promise.all([
      prisma.subscription.findUnique({
        where: { workspaceId },
        include: { plan: true, scheduledPlan: true }
      }),
      prisma.featureOverride.findMany({
        where: {
          workspaceId,
          featureKey: {
            in: [
              'platforms',
              'webMonitoringEnabled',
              'telegramMonitoringEnabled',
              'maxWebPages',
              'maxCompanies',
              'maxSources',
              'pushNotificationsEnabled',
              'telegramNotifications'
            ]
          }
        }
      })
    ])

    const now = new Date()
    const active =
      subscription &&
      ((subscription.status === 'ACTIVE' && subscription.currentPeriodEnd && subscription.currentPeriodEnd > now) ||
        subscription.status === 'MANUAL' ||
        (subscription.status === 'TRIAL' && subscription.trialEndsAt && subscription.trialEndsAt > now))

    const dueScheduledPlan =
      active && subscription.scheduledPlan && subscription.scheduledAt && subscription.scheduledAt <= now
        ? subscription.scheduledPlan
        : null
    const plan = dueScheduledPlan ?? (active ? subscription.plan : null)
    const defaults = plan ? PLAN_SYNC_LIMITS[plan.code] ?? FREE_SYNC_LIMITS : FREE_SYNC_LIMITS
    const db = plan?.limits && typeof plan.limits === 'object' ? plan.limits : {}

    const limits: EffectiveSyncLimits = {
      platforms: Array.isArray(db.platforms) ? db.platforms.map(String) : [...defaults.platforms],
      webMonitoringEnabled:
        typeof db.webMonitoringEnabled === 'boolean' ? db.webMonitoringEnabled : defaults.webMonitoringEnabled,
      telegramMonitoringEnabled:
        typeof db.telegramMonitoringEnabled === 'boolean'
          ? db.telegramMonitoringEnabled
          : defaults.telegramMonitoringEnabled,
      maxWebPages: Number.isFinite(Number(db.maxWebPages)) ? Number(db.maxWebPages) : defaults.maxWebPages,
      maxCompanies: Number.isFinite(Number(db.maxCompanies)) ? Number(db.maxCompanies) : defaults.maxCompanies,
      maxSources: Number.isFinite(Number(db.maxSources)) ? Number(db.maxSources) : defaults.maxSources,
      pushNotificationsEnabled:
        typeof db.pushNotificationsEnabled === 'boolean'
          ? db.pushNotificationsEnabled
          : defaults.pushNotificationsEnabled,
      telegramNotifications:
        typeof db.telegramNotifications === 'boolean' ? db.telegramNotifications : defaults.telegramNotifications
    }

    for (const override of overrides) {
      if (override.featureKey === 'platforms' && Array.isArray(override.value)) {
        limits.platforms = override.value.map(String)
      }
      if (override.featureKey === 'webMonitoringEnabled') {
        limits.webMonitoringEnabled = Boolean(override.value)
      }
      if (override.featureKey === 'telegramMonitoringEnabled') {
        limits.telegramMonitoringEnabled = Boolean(override.value)
      }
      if (override.featureKey === 'maxWebPages' && Number.isFinite(Number(override.value))) {
        limits.maxWebPages = Number(override.value)
      }
      if (override.featureKey === 'maxCompanies' && Number.isFinite(Number(override.value))) {
        limits.maxCompanies = Number(override.value)
      }
      if (override.featureKey === 'maxSources' && Number.isFinite(Number(override.value))) {
        limits.maxSources = Number(override.value)
      }
      if (override.featureKey === 'pushNotificationsEnabled') limits.pushNotificationsEnabled = Boolean(override.value)
      if (override.featureKey === 'telegramNotifications') limits.telegramNotifications = Boolean(override.value)
    }

    return limits
  }

  async getEffectiveWebLimits(workspaceId: string) {
    const limits = await this.getEffectiveLimits(workspaceId)
    return {
      webMonitoringEnabled: limits.webMonitoringEnabled,
      maxWebPages: limits.maxWebPages,
      maxCompanies: limits.maxCompanies,
      maxSources: limits.maxSources
    }
  }

  async canWorkspaceFeature(workspaceId: string, feature: 'pushNotificationsEnabled' | 'telegramNotifications') {
    const workspace = await (this.prisma as any).workspace.findUnique({
      where: { id: workspaceId }, select: { isActive: true }
    })
    if (!workspace?.isActive) return false
    const limits = await this.getEffectiveLimits(workspaceId)
    return limits[feature]
  }

  async canRunWebCompany(workspaceId: string, companyId: string) {
    const limits = await this.getEffectiveLimits(workspaceId)
    return limits.webMonitoringEnabled && this.companyWithinLimit(workspaceId, companyId, limits.maxCompanies)
  }

  private platformAllowed(limits: EffectiveSyncLimits, platform: string) {
    if (!limits.platforms.includes(platform)) return false
    if (platform === 'WEB') return limits.webMonitoringEnabled
    if (platform === 'TELEGRAM') return limits.telegramMonitoringEnabled
    return true
  }

  private async companyWithinLimit(workspaceId: string, companyId: string, maxCompanies: number) {
    if (maxCompanies < 0) return true
    if (maxCompanies === 0) return false
    const allowed = await (this.prisma as any).company.findMany({
      where: { workspaceId, isActive: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: maxCompanies,
      select: { id: true }
    })
    return allowed.some((company: any) => company.id === companyId)
  }

  private async allowedBillableTargetIds(workspaceId: string, maxSources: number) {
    if (maxSources < 0) return null
    if (maxSources === 0) return new Set<string>()
    const targets = await (this.prisma as any).companySourceTarget.findMany({
      where: {
        isActive: true,
        company: { workspaceId, isActive: true },
        source: { isEnabled: true, platform: { not: 'TELEGRAM' } }
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: maxSources,
      select: { id: true }
    })
    return new Set<string>(targets.map((target: any) => target.id))
  }

  async getEligibleTargets(companyId: string, capability: SyncCapability) {
    const prisma = this.prisma as any
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { workspace: { select: { isActive: true } } }
    })
    if (!company?.isActive || !company.workspace?.isActive) return []

    const flag =
      capability === 'reviews'
        ? 'syncReviewsEnabled'
        : capability === 'ratings'
          ? 'syncRatingsEnabled'
          : 'syncMentionsEnabled'
    const targets = await prisma.companySourceTarget.findMany({
      where: {
        companyId,
        isActive: true,
        [flag]: true,
        source: { isEnabled: true }
      },
      include: { source: true }
    })
    const limits = await this.getEffectiveLimits(company.workspaceId)
    if (!await this.companyWithinLimit(company.workspaceId, companyId, limits.maxCompanies)) return []
    const allowedTargetIds = await this.allowedBillableTargetIds(company.workspaceId, limits.maxSources)

    return targets.filter((target: any) => {
      const platform = String(target.source?.platform || '')
      if (!this.platformAllowed(limits, platform)) return false
      if (platform !== 'TELEGRAM' && allowedTargetIds && !allowedTargetIds.has(target.id)) return false
      if (capability === 'reviews' || capability === 'ratings') {
        return platform === 'YANDEX' || platform === 'TWOGIS'
      }
      return platform === 'WEB' || platform === 'CUSTOM'
    })
  }

  async getEligibleTarget(companyId: string, targetId: string, capability: SyncCapability) {
    const targets = await this.getEligibleTargets(companyId, capability)
    return targets.find((target: any) => target.id === targetId) ?? null
  }

  async getEligibleDiscoverySources(companyId: string) {
    const prisma = this.prisma as any
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { workspace: { select: { isActive: true } } }
    })
    if (!company?.isActive || !company.workspace?.isActive) return { company: null, sources: [] }

    const [sources, limits] = await Promise.all([
      prisma.source.findMany({ where: { workspaceId: company.workspaceId, isEnabled: true } }),
      this.getEffectiveLimits(company.workspaceId)
    ])
    if (!await this.companyWithinLimit(company.workspaceId, companyId, limits.maxCompanies)) {
      return { company: null, sources: [] }
    }
    return {
      company,
      maxSources: limits.maxSources,
      sources: sources.filter((source: any) => {
        const platform = String(source.platform)
        return ['YANDEX', 'TWOGIS', 'WEB', 'CUSTOM'].includes(platform) && this.platformAllowed(limits, platform)
      })
    }
  }

  async runWithSourceSlot<T>(
    workspaceId: string,
    maxSources: number,
    findExisting: (tx: Prisma.TransactionClient) => Promise<T | null>,
    create: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T | null> {
    const limit = Number(maxSources)
    const prisma = this.prisma as any

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reputation-os:source-slot:${workspaceId}`}))`

      const existing = await findExisting(tx)
      if (existing) return existing

      if (limit >= 0) {
        const count = await tx.companySourceTarget.count({
          where: {
            company: { workspaceId },
            isActive: true,
            source: { platform: { not: 'TELEGRAM' } }
          }
        })
        if (count >= limit) return null
      }

      return create(tx)
    })
  }

  async promoteWebTargetWithinLimits(
    workspaceId: string,
    companyId: string,
    targetId: string,
    url: string,
    domain: string,
    checkIntervalMin: number
  ): Promise<boolean> {
    const limits = await this.getEffectiveLimits(workspaceId)
    if (!limits.webMonitoringEnabled || limits.maxWebPages === 0) return false
    if (!await this.companyWithinLimit(workspaceId, companyId, limits.maxCompanies)) return false

    const prisma = this.prisma as any
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Every path taking both locks uses this order to avoid deadlocks.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reputation-os:source-slot:${workspaceId}`}))`
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reputation-os:web-page-slot:${workspaceId}`}))`

      const target = await tx.companySourceTarget.findFirst({
        where: {
          id: targetId,
          companyId,
          company: { workspaceId, isActive: true, workspace: { isActive: true, deletedAt: null } },
          source: { platform: 'WEB', isEnabled: true }
        }
      })
      if (!target) return false

      if (!target.isActive && limits.maxSources >= 0) {
        const activeSources = await tx.companySourceTarget.count({
          where: {
            isActive: true,
            company: { workspaceId },
            source: { platform: { not: 'TELEGRAM' } }
          }
        })
        if (activeSources >= limits.maxSources) return false
      }

      const existingPage = await tx.watchedPage.findUnique({
        where: { companyId_url: { companyId, url } }
      })
      if ((!existingPage || !existingPage.enabled) && limits.maxWebPages >= 0) {
        const activePages = await tx.watchedPage.count({
          where: { enabled: true, company: { workspaceId } }
        })
        if (activePages >= limits.maxWebPages) return false
      }

      await tx.companySourceTarget.update({
        where: { id: targetId },
        data: { isActive: true }
      })
      await tx.watchedPage.upsert({
        where: { companyId_url: { companyId, url } },
        create: {
          companyId,
          sourceTargetId: targetId,
          url,
          domain,
          pageType: 'UNKNOWN',
          enabled: true,
          checkIntervalMin
        },
        update: { sourceTargetId: targetId, enabled: true }
      })
      return true
    })
  }

  async canProcessWatchedPage(watchedPageId: string) {
    const prisma = this.prisma as any
    const page = await prisma.watchedPage.findUnique({
      where: { id: watchedPageId },
      include: {
        company: { select: { workspaceId: true, isActive: true, workspace: { select: { isActive: true } } } },
        sourceTarget: { include: { source: true } }
      }
    })
    if (!page?.enabled || !page.company?.isActive || !page.company.workspace?.isActive) return null
    if (!page.sourceTarget?.isActive || !page.sourceTarget.source?.isEnabled) {
      return null
    }

    const limits = await this.getEffectiveLimits(page.company.workspaceId)
    if (!await this.companyWithinLimit(page.company.workspaceId, page.companyId, limits.maxCompanies)) return null
    if (!this.platformAllowed(limits, String(page.sourceTarget.source.platform))) return null
    const allowedTargetIds = await this.allowedBillableTargetIds(page.company.workspaceId, limits.maxSources)
    if (allowedTargetIds && !allowedTargetIds.has(page.sourceTarget.id)) return null
    if (limits.maxWebPages >= 0) {
      const allowedPages = await prisma.watchedPage.findMany({
        where: { enabled: true, company: { workspaceId: page.company.workspaceId, isActive: true } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: limits.maxWebPages,
        select: { id: true }
      })
      if (!allowedPages.some((candidate: any) => candidate.id === watchedPageId)) return null
    }
    return page
  }

  async canRunTelegramCompany(companyId: string) {
    const prisma = this.prisma as any
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { workspaceId: true, isActive: true, workspace: { select: { isActive: true } } }
    })
    if (!company?.isActive || !company.workspace?.isActive) return false
    const limits = await this.getEffectiveLimits(company.workspaceId)
    if (!await this.companyWithinLimit(company.workspaceId, companyId, limits.maxCompanies)) return false
    return this.platformAllowed(limits, 'TELEGRAM')
  }

  async getEligibleTelegramLinkIds(telegramChannelId: string) {
    const prisma = this.prisma as any
    const links = await prisma.companyTelegramChannel.findMany({
      where: { telegramChannelId, enabled: true },
      select: { id: true, companyId: true }
    })
    const eligible: string[] = []
    for (const link of links) {
      if (await this.canRunTelegramCompany(link.companyId)) eligible.push(link.id)
    }
    return eligible
  }
}
