import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { PlanCode, SubscriptionStatus, SystemRole, TelegramDeliveryStatus } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(private readonly prisma: PrismaService, private readonly jwtService: JwtService) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (exists) throw new BadRequestException('User with this email already exists')

    const passwordHash = await bcrypt.hash(dto.password, 10)
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, fullName: dto.fullName }
    })

    const baseSlug = (dto.fullName || dto.email.split('@')[0] || 'workspace')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'workspace'

    let slug = baseSlug
    let counter = 1
    while (await this.prisma.workspace.findUnique({ where: { slug } })) {
      counter += 1
      slug = `${baseSlug}-${counter}`
    }

    const workspace = await this.prisma.workspace.create({
      data: {
        name: dto.fullName ? `${dto.fullName} Workspace` : 'My Workspace',
        slug
      }
    })

    await this.prisma.workspaceMember.create({
      data: { workspaceId: workspace.id, userId: user.id, role: 'OWNER' }
    })

    const proPlan = await this.prisma.plan.findUnique({ where: { code: PlanCode.PRO } })
    if (proPlan) {
      const trialEndsAt = new Date()
      trialEndsAt.setDate(trialEndsAt.getDate() + 7)
      await this.prisma.subscription.create({
        data: {
          workspaceId: workspace.id,
          planId: proPlan.id,
          status: SubscriptionStatus.TRIAL,
          trialEndsAt,
        }
      })
    } else {
      this.logger.warn('PRO plan not found in DB — trial subscription skipped')
    }

    return this.buildAuthResponse(user.id, user.email)
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (!user || !user.isActive || user.deletedAt) throw new UnauthorizedException('Invalid credentials')

    const valid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!valid) throw new UnauthorizedException('Invalid credentials')

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })

    return this.buildAuthResponse(user.id, user.email)
  }

  async me(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, isActive: true, systemRole: true, createdAt: true }
    })
  }

  async getDeletePreview(userId: string): Promise<{
    canDelete: boolean
    archivedWorkspaces: { id: string; name: string }[]
    blockerWorkspaces: { id: string; name: string }[]
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, systemRole: true, deletedAt: true,
        workspaceMembers: { select: { workspaceId: true, role: true } }
      }
    })
    if (!user || user.deletedAt) throw new BadRequestException('Аккаунт не найден')

    if (user.systemRole === SystemRole.SUPER_ADMIN) {
      const count = await this.prisma.user.count({
        where: { systemRole: SystemRole.SUPER_ADMIN, isActive: true, deletedAt: null }
      })
      if (count <= 1) {
        return { canDelete: false, archivedWorkspaces: [], blockerWorkspaces: [] }
      }
    }

    const { toArchive, blockers } = await this.classifyWorkspaceMemberships(userId, user.workspaceMembers)
    return {
      canDelete: blockers.length === 0,
      archivedWorkspaces: toArchive,
      blockerWorkspaces: blockers,
    }
  }

  async deleteMyAccount(userId: string): Promise<{ ok: boolean; archivedWorkspaces: { id: string; name: string }[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, systemRole: true, deletedAt: true,
        workspaceMembers: { select: { workspaceId: true, role: true } }
      }
    })
    if (!user || user.deletedAt) throw new BadRequestException('Аккаунт не найден или уже удалён')

    if (user.systemRole === SystemRole.SUPER_ADMIN) {
      const count = await this.prisma.user.count({
        where: { systemRole: SystemRole.SUPER_ADMIN, isActive: true, deletedAt: null }
      })
      if (count <= 1) throw new BadRequestException('Нельзя удалить последнего SUPER_ADMIN')
    }

    const { toArchive, blockers } = await this.classifyWorkspaceMemberships(userId, user.workspaceMembers)
    if (blockers.length > 0) {
      throw new BadRequestException(
        `Нельзя удалить аккаунт, пока вы единственный владелец workspace с другими участниками: ${blockers.map((w) => w.name).join(', ')}. Передайте роль другому участнику.`
      )
    }

    await this.anonymizeUser(userId, undefined, toArchive)
    return { ok: true, archivedWorkspaces: toArchive }
  }

  private async classifyWorkspaceMemberships(
    userId: string,
    memberships: { workspaceId: string; role: string }[]
  ): Promise<{ toArchive: { id: string; name: string }[]; blockers: { id: string; name: string }[] }> {
    const toArchive: { id: string; name: string }[] = []
    const blockers: { id: string; name: string }[] = []

    for (const m of memberships) {
      if (m.role !== 'OWNER') continue

      const ws = await this.prisma.workspace.findUnique({
        where: { id: m.workspaceId },
        select: { id: true, name: true, _count: { select: { members: true } } }
      })
      if (!ws) continue

      const otherOwnerCount = await this.prisma.workspaceMember.count({
        where: { workspaceId: m.workspaceId, role: 'OWNER', userId: { not: userId } }
      })

      if (ws._count.members === 1) {
        toArchive.push({ id: ws.id, name: ws.name })
      } else if (otherOwnerCount === 0) {
        blockers.push({ id: ws.id, name: ws.name })
      }
    }

    return { toArchive, blockers }
  }

  private async anonymizeUser(
    userId: string,
    deletedById?: string,
    workspacesToArchive: { id: string; name: string }[] = []
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const now = new Date()
      for (const ws of workspacesToArchive) {
        await tx.workspace.update({
          where: { id: ws.id },
          data: { deletedAt: now, deletedById: deletedById ?? userId }
        })
      }
      await tx.webPushSubscription.deleteMany({ where: { userId } })
      await tx.telegramLinkToken.deleteMany({ where: { userId } })
      await tx.telegramMentionDelivery.deleteMany({
        where: { userId, status: TelegramDeliveryStatus.PENDING }
      })
      await tx.workspaceMember.deleteMany({ where: { userId } })
      await tx.workspaceInvite.deleteMany({
        where: { invitedById: userId, acceptedAt: null, declinedAt: null }
      })
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `deleted_${userId}@deleted.local`,
          fullName: 'Удалённый пользователь',
          passwordHash: `DELETED_${userId}`,
          isActive: false,
          deletedAt: now,
          deletedById: deletedById ?? null,
          telegramChatId: null,
          telegramLinkedAt: null,
        }
      })
    })
  }

  private buildAuthResponse(userId: string, email: string) {
    const accessToken = this.jwtService.sign({ sub: userId, email })
    return { accessToken, user: { id: userId, email } }
  }
}
