import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { JobStatus, Prisma, SystemRole } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { AuditLogService } from './audit-log.service'
import { AdminUsersQueryDto } from './dto/admin-users-query.dto'
import { AdminWorkspacesQueryDto } from './dto/admin-workspaces-query.dto'
import { AdminUpdateUserRoleDto } from './dto/admin-update-user-role.dto'
import { AdminUpdateUserStatusDto } from './dto/admin-update-user-status.dto'
import { AdminUpdateWorkspaceStatusDto } from './dto/admin-update-workspace-status.dto'
import { AdminWorkspaceBillingDto } from './dto/admin-workspace-billing.dto'
import { UpdateAdminUserDto } from './dto/update-admin-user.dto'

const USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  isActive: true,
  systemRole: true,
  lastLoginAt: true,
  createdAt: true,
  telegramChatId: true,
  webPushSubscriptions: { select: { id: true }, take: 1 },
  workspaceMembers: {
    select: {
      id: true,
      role: true,
      workspace: { select: { id: true, name: true, slug: true } }
    }
  }
} as const

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService
  ) {}

  // ─── OVERVIEW ───────────────────────────────────────────────────────────────

  async getOverview() {
    const now = new Date()
    const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const [
      totalUsers,
      activeUsers,
      disabledUsers,
      newUsersLast30d,
      totalWorkspaces,
      activeWorkspaces,
      totalCompanies,
      mentionsAllTime,
      mentionsLast30d,
      mentionsLast24h,
      negativeLast24h,
      failedJobsLast24h,
      avgRatingRaw
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { isActive: false } }),
      this.prisma.user.count({ where: { createdAt: { gte: ago30d } } }),
      this.prisma.workspace.count(),
      this.prisma.workspace.count({ where: { isActive: true } }),
      this.prisma.company.count(),
      this.prisma.mention.count(),
      this.prisma.mention.count({ where: { createdAt: { gte: ago30d } } }),
      this.prisma.mention.count({ where: { createdAt: { gte: ago24h } } }),
      this.prisma.mention.count({ where: { createdAt: { gte: ago24h }, sentiment: 'NEGATIVE' } }),
      this.prisma.jobLog.count({ where: { jobStatus: JobStatus.FAILED, createdAt: { gte: ago24h } } }),
      this.prisma.ratingSnapshot
        .aggregate({ _avg: { ratingValue: true } })
        .catch(() => ({ _avg: { ratingValue: null } }))
    ])

    return {
      users: {
        total: { value: totalUsers, scope: 'всего' },
        active: { value: activeUsers, scope: 'активные' },
        disabled: { value: disabledUsers, scope: 'отключённые' },
        newLast30d: { value: newUsersLast30d, scope: 'за 30 дней' }
      },
      workspaces: {
        total: { value: totalWorkspaces, scope: 'всего' },
        active: { value: activeWorkspaces, scope: 'активные' }
      },
      companies: { total: { value: totalCompanies, scope: 'по всей платформе' } },
      mentions: {
        allTime: { value: mentionsAllTime, scope: 'всего' },
        last30d: { value: mentionsLast30d, scope: 'за 30 дней' },
        last24h: { value: mentionsLast24h, scope: 'за 24 часа' },
        negativeLast24h: { value: negativeLast24h, scope: 'негатив за 24 часа' }
      },
      averageRating: { value: (avgRatingRaw as any)._avg?.ratingValue ?? null, scope: 'по всей платформе' },
      failedJobsLast24h: { value: failedJobsLast24h, scope: 'за 24 часа' }
    }
  }

  // ─── USERS ──────────────────────────────────────────────────────────────────

  async getUsers(query: AdminUsersQueryDto) {
    const page = Math.max(1, query.page ?? 1)
    const limit = Math.min(100, Math.max(1, query.limit ?? 50))
    const skip = (page - 1) * limit

    const where: Prisma.UserWhereInput = {}

    if (query.q?.trim()) {
      const q = query.q.trim()
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { fullName: { contains: q, mode: 'insensitive' } }
      ]
    }
    if (query.systemRole) where.systemRole = query.systemRole
    if (query.status === 'active') where.isActive = true
    if (query.status === 'disabled') where.isActive = false
    if (query.workspaceId) {
      where.workspaceMembers = { some: { workspaceId: query.workspaceId } }
    }

    const [total, items] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      })
    ])

    const result = items.map((u) => ({
      ...u,
      telegramConnected: u.telegramChatId != null,
      pushConnected: u.webPushSubscriptions.length > 0,
      telegramChatId: undefined,
      webPushSubscriptions: undefined
    }))

    return { items: result, total, page, limit, pages: Math.ceil(total / limit) }
  }

  async updateUserRole(
    actorId: string,
    actorEmail: string,
    targetId: string,
    dto: AdminUpdateUserRoleDto
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, email: true, systemRole: true, isActive: true }
    })
    if (!target) throw new NotFoundException('User not found')

    if (target.id === actorId && dto.systemRole === SystemRole.USER) {
      const superAdminCount = await this.prisma.user.count({ where: { systemRole: SystemRole.SUPER_ADMIN } })
      if (superAdminCount <= 1) throw new BadRequestException('Cannot remove last SUPER_ADMIN')
    }

    const before = { systemRole: target.systemRole }
    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { systemRole: dto.systemRole },
      select: USER_SELECT
    })

    await this.auditLog.log({
      actorUserId: actorId,
      actorEmail,
      action: 'USER_ROLE_CHANGED',
      entityType: 'User',
      entityId: targetId,
      targetUserId: targetId,
      beforeJson: before,
      afterJson: { systemRole: dto.systemRole }
    })

    return updated
  }

  async updateUserStatus(
    actorId: string,
    actorEmail: string,
    targetId: string,
    dto: AdminUpdateUserStatusDto
  ) {
    if (targetId === actorId && !dto.isActive) {
      throw new BadRequestException('Cannot disable your own account')
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, email: true, systemRole: true, isActive: true }
    })
    if (!target) throw new NotFoundException('User not found')

    if (!dto.isActive && target.systemRole === SystemRole.SUPER_ADMIN) {
      const activeSuperAdmins = await this.prisma.user.count({
        where: { systemRole: SystemRole.SUPER_ADMIN, isActive: true }
      })
      if (activeSuperAdmins <= 1) throw new BadRequestException('Cannot disable last active SUPER_ADMIN')
    }

    const before = { isActive: target.isActive }
    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { isActive: dto.isActive },
      select: USER_SELECT
    })

    await this.auditLog.log({
      actorUserId: actorId,
      actorEmail,
      action: dto.isActive ? 'USER_ENABLED' : 'USER_DISABLED',
      entityType: 'User',
      entityId: targetId,
      targetUserId: targetId,
      beforeJson: before,
      afterJson: { isActive: dto.isActive }
    })

    return updated
  }

  // Backwards-compat: PATCH /admin/users/:id (old endpoint)
  async updateUser(currentUserId: string, targetUserId: string, dto: UpdateAdminUserDto) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, systemRole: true, isActive: true }
    })
    if (!target) throw new NotFoundException('User not found')
    if (target.id === currentUserId && dto.isActive === false) {
      throw new BadRequestException('SUPER_ADMIN cannot disable own account')
    }
    if (target.id === currentUserId && dto.systemRole === 'USER') {
      throw new BadRequestException('SUPER_ADMIN cannot remove own system role')
    }

    const data: Prisma.UserUpdateInput = {
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.systemRole !== undefined ? { systemRole: dto.systemRole } : {})
    }

    return this.prisma.user.update({
      where: { id: targetUserId },
      data,
      select: USER_SELECT
    })
  }

  // ─── WORKSPACES ─────────────────────────────────────────────────────────────

  async getWorkspaces(query: AdminWorkspacesQueryDto) {
    const page = Math.max(1, query.page ?? 1)
    const limit = Math.min(100, Math.max(1, query.limit ?? 50))
    const skip = (page - 1) * limit

    const where: Prisma.WorkspaceWhereInput = {}
    if (query.q?.trim()) {
      const q = query.q.trim()
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } }
      ]
    }
    if (query.status === 'active') where.isActive = true
    if (query.status === 'disabled') where.isActive = false
    if (query.plan) {
      where.subscription = { plan: { code: query.plan } }
    }

    const [total, items] = await Promise.all([
      this.prisma.workspace.count({ where }),
      this.prisma.workspace.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: { include: { plan: true } },
          featureOverrides: true,
          _count: { select: { members: true, companies: true, sources: true } },
          members: {
            where: { role: 'OWNER' },
            take: 1,
            select: { user: { select: { id: true, email: true, fullName: true } } }
          }
        }
      })
    ])

    const result = items.map((ws) => ({
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      isActive: ws.isActive,
      createdAt: ws.createdAt,
      owner: ws.members[0]?.user ?? null,
      membersCount: ws._count.members,
      companiesCount: ws._count.companies,
      sourcesCount: ws._count.sources,
      planCode: ws.subscription?.plan?.code ?? 'FREE',
      planName: ws.subscription?.plan?.name ?? 'Бесплатный',
      subscriptionStatus: ws.subscription?.status ?? null,
      currentPeriodEnd: ws.subscription?.currentPeriodEnd ?? null,
      trialEndsAt: ws.subscription?.trialEndsAt ?? null,
      overridesCount: ws.featureOverrides.length
    }))

    return { items: result, total, page, limit, pages: Math.ceil(total / limit) }
  }

  async getWorkspaceById(id: string) {
    const ws = await this.prisma.workspace.findUnique({
      where: { id },
      include: {
        subscription: {
          include: {
            plan: true,
            updatedByAdmin: { select: { id: true, email: true, fullName: true } }
          }
        },
        featureOverrides: true,
        _count: { select: { members: true, companies: true, sources: true } },
        members: {
          take: 20,
          select: {
            id: true,
            role: true,
            user: {
              select: { id: true, email: true, fullName: true, isActive: true, lastLoginAt: true }
            }
          }
        }
      }
    })
    if (!ws) throw new NotFoundException('Workspace not found')

    const [mentionsCount, recentAuditLogs] = await Promise.all([
      this.prisma.mention.count({ where: { company: { workspaceId: id } } }),
      this.prisma.auditLog.findMany({
        where: { workspaceId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { actorUser: { select: { id: true, email: true, fullName: true } } }
      })
    ])

    return { ...ws, mentionsCount, recentAuditLogs }
  }

  async updateWorkspaceStatus(
    actorId: string,
    actorEmail: string,
    workspaceId: string,
    dto: AdminUpdateWorkspaceStatusDto
  ) {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, isActive: true }
    })
    if (!ws) throw new NotFoundException('Workspace not found')

    const before = { isActive: ws.isActive }
    const updated = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { isActive: dto.isActive },
      select: { id: true, name: true, slug: true, isActive: true }
    })

    await this.auditLog.log({
      actorUserId: actorId,
      actorEmail,
      action: dto.isActive ? 'WORKSPACE_ENABLED' : 'WORKSPACE_DISABLED',
      entityType: 'Workspace',
      entityId: workspaceId,
      workspaceId,
      beforeJson: before,
      afterJson: { isActive: dto.isActive }
    })

    return updated
  }

  // ─── BILLING ────────────────────────────────────────────────────────────────

  async getBillingOverview() {
    const workspaces = await this.prisma.workspace.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: {
          include: {
            plan: true,
            updatedByAdmin: { select: { id: true, email: true } }
          }
        },
        featureOverrides: true,
        _count: { select: { members: true, companies: true, sources: true } },
        members: {
          where: { role: 'OWNER' },
          take: 1,
          select: { user: { select: { id: true, email: true, fullName: true } } }
        }
      }
    })

    return workspaces.map((ws) => {
      const overrideMap: Record<string, unknown> = {}
      ws.featureOverrides.forEach((o) => {
        overrideMap[o.featureKey] = o.value
      })

      return {
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        isActive: ws.isActive,
        owner: ws.members[0]?.user ?? null,
        membersCount: ws._count.members,
        companiesCount: ws._count.companies,
        sourcesCount: ws._count.sources,
        planCode: ws.subscription?.plan?.code ?? 'FREE',
        planName: ws.subscription?.plan?.name ?? 'Бесплатный',
        subscriptionStatus: ws.subscription?.status ?? null,
        currentPeriodEnd: ws.subscription?.currentPeriodEnd ?? null,
        trialEndsAt: ws.subscription?.trialEndsAt ?? null,
        adminNote: ws.subscription?.adminNote ?? null,
        updatedByAdmin: ws.subscription?.updatedByAdmin ?? null,
        overrides: overrideMap
      }
    })
  }

  async updateWorkspaceBilling(
    actorId: string,
    actorEmail: string,
    workspaceId: string,
    dto: AdminWorkspaceBillingDto
  ) {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { subscription: { include: { plan: true } }, featureOverrides: true }
    })
    if (!ws) throw new NotFoundException('Workspace not found')

    const beforeSub = ws.subscription
      ? {
          planCode: ws.subscription.plan.code,
          status: ws.subscription.status,
          currentPeriodEnd: ws.subscription.currentPeriodEnd
        }
      : null

    let subscription: any = ws.subscription

    const hasSubChanges =
      dto.planCode !== undefined ||
      dto.status !== undefined ||
      dto.currentPeriodEnd !== undefined ||
      dto.trialEndsAt !== undefined ||
      dto.adminNote !== undefined

    if (hasSubChanges) {
      const planCode = dto.planCode ?? ws.subscription?.plan?.code ?? 'FREE'

      // Downgrade to FREE with no explicit status override = cancel subscription
      if (planCode === 'FREE' && dto.status === undefined && dto.adminNote === undefined) {
        if (ws.subscription) {
          await this.prisma.subscription.delete({ where: { workspaceId } })
          subscription = null
        }
      } else {
        const plan = await this.prisma.plan.findUnique({ where: { code: planCode as any } })
        if (!plan) throw new NotFoundException(`Plan ${planCode} not found`)

        const status = (dto.status ?? 'MANUAL') as any
        const currentPeriodEnd = dto.currentPeriodEnd
          ? new Date(dto.currentPeriodEnd)
          : (ws.subscription?.currentPeriodEnd ?? null)
        const trialEndsAt = dto.trialEndsAt
          ? new Date(dto.trialEndsAt)
          : (ws.subscription?.trialEndsAt ?? null)

        subscription = await this.prisma.subscription.upsert({
          where: { workspaceId },
          create: {
            workspaceId,
            planId: plan.id,
            status,
            currentPeriodEnd,
            trialEndsAt,
            adminNote: dto.adminNote,
            updatedByAdminId: actorId
          },
          update: {
            planId: plan.id,
            status,
            currentPeriodEnd,
            trialEndsAt,
            adminNote: dto.adminNote,
            updatedByAdminId: actorId
          },
          include: { plan: true }
        })
      }
    }

    // Update feature overrides for each provided limit
    const overrideMapping: Record<string, unknown> = {
      maxCompanies: dto.maxCompanies,
      maxSources: dto.maxSources,
      maxMembers: dto.maxMembers,
      maxAiRepliesPerMonth: dto.maxAiRepliesPerMonth,
      maxWebPages: dto.maxWebPages,
      webMonitoringEnabled: dto.webMonitoringEnabled,
      telegramNotifications: dto.telegramNotificationsEnabled,
      pushNotificationsEnabled: dto.pushNotificationsEnabled
    }

    const updatedOverrideKeys: string[] = []
    await Promise.all(
      Object.entries(overrideMapping).map(async ([key, value]) => {
        if (value === undefined) return
        updatedOverrideKeys.push(key)
        await this.prisma.featureOverride.upsert({
          where: { workspaceId_featureKey: { workspaceId, featureKey: key } },
          create: { workspaceId, featureKey: key, value: value as any, note: `admin:${actorEmail}` },
          update: { value: value as any, note: `admin:${actorEmail}` }
        })
      })
    )

    await this.auditLog.log({
      actorUserId: actorId,
      actorEmail,
      action: 'SUBSCRIPTION_CHANGED',
      entityType: 'Workspace',
      entityId: workspaceId,
      workspaceId,
      beforeJson: { subscription: beforeSub, overridesCount: ws.featureOverrides.length },
      afterJson: {
        subscription: subscription
          ? { planCode: subscription.plan?.code, status: subscription.status }
          : null,
        overridesUpdated: updatedOverrideKeys
      }
    })

    return { ok: true, workspaceId, subscription }
  }
}
