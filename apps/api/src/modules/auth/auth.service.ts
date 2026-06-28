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

  async deleteMyAccount(userId: string): Promise<{ ok: boolean }> {
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

    const soleOwnerNames = await this.getSoleOwnerWorkspaceNames(userId, user.workspaceMembers)
    if (soleOwnerNames.length > 0) {
      throw new BadRequestException(
        `Нельзя удалить аккаунт, пока вы единственный владелец workspace: ${soleOwnerNames.join(', ')}. Передайте роль другому участнику или удалите workspace.`
      )
    }

    await this.anonymizeUser(userId)
    return { ok: true }
  }

  private async getSoleOwnerWorkspaceNames(
    userId: string,
    memberships: { workspaceId: string; role: string }[]
  ): Promise<string[]> {
    const names: string[] = []
    for (const m of memberships) {
      if (m.role !== 'OWNER') continue
      const otherOwners = await this.prisma.workspaceMember.count({
        where: { workspaceId: m.workspaceId, role: 'OWNER', userId: { not: userId } }
      })
      if (otherOwners === 0) {
        const ws = await this.prisma.workspace.findUnique({
          where: { id: m.workspaceId }, select: { name: true }
        })
        if (ws) names.push(ws.name)
      }
    }
    return names
  }

  private async anonymizeUser(userId: string, deletedById?: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.webPushSubscription.deleteMany({ where: { userId } }),
      this.prisma.telegramLinkToken.deleteMany({ where: { userId } }),
      this.prisma.telegramMentionDelivery.deleteMany({
        where: { userId, status: TelegramDeliveryStatus.PENDING }
      }),
      this.prisma.workspaceMember.deleteMany({ where: { userId } }),
      this.prisma.workspaceInvite.deleteMany({
        where: { invitedById: userId, acceptedAt: null, declinedAt: null }
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          email: `deleted_${userId}@deleted.local`,
          fullName: 'Удалённый пользователь',
          passwordHash: `DELETED_${userId}`,
          isActive: false,
          deletedAt: new Date(),
          deletedById: deletedById ?? null,
          telegramChatId: null,
          telegramLinkedAt: null,
        }
      })
    ])
  }

  private buildAuthResponse(userId: string, email: string) {
    const accessToken = this.jwtService.sign({ sub: userId, email })
    return { accessToken, user: { id: userId, email } }
  }
}
