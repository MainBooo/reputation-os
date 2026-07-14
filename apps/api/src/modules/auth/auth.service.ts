import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { PlanCode, SubscriptionStatus, SystemRole, TelegramDeliveryStatus } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { randomBytes } from 'crypto'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'

const YANDEX_OAUTH_SCOPE = 'login:email login:info login:avatar'

interface YandexUserInfo {
  id: string
  default_email?: string
  emails?: string[]
  login?: string
  display_name?: string
  real_name?: string
  first_name?: string
  last_name?: string
}

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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, fullName: true, isActive: true,
        systemRole: true, createdAt: true,
        welcomeSeen: true, telegramChatId: true,
      }
    })
    if (!user) return null
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      systemRole: user.systemRole,
      createdAt: user.createdAt,
      welcomeSeen: user.welcomeSeen,
      telegramLinked: user.telegramChatId !== null,
    }
  }

  async markWelcomeSeen(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { welcomeSeen: true },
    })
    return { ok: true }
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

  generateYandexState(): string {
    return randomBytes(16).toString('hex')
  }

  getYandexAuthUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.YANDEX_CLIENT_ID || '',
      redirect_uri: process.env.YANDEX_REDIRECT_URI || '',
      scope: YANDEX_OAUTH_SCOPE,
      state
    })
    return `https://oauth.yandex.ru/authorize?${params.toString()}`
  }

  async exchangeYandexCode(code: string): Promise<string> {
    const response = await fetch('https://oauth.yandex.ru/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.YANDEX_CLIENT_ID || '',
        client_secret: process.env.YANDEX_CLIENT_SECRET || '',
        redirect_uri: process.env.YANDEX_REDIRECT_URI || ''
      })
    })

    const data = await response.json().catch(() => null)
    if (!response.ok || !data?.access_token) {
      this.logger.error(`Yandex token exchange failed: ${response.status} ${JSON.stringify(data)}`)
      throw new BadRequestException('Не удалось получить токен Яндекс ID')
    }

    return data.access_token as string
  }

  async getYandexUserInfo(accessToken: string): Promise<YandexUserInfo> {
    const response = await fetch('https://login.yandex.ru/info?format=json', {
      headers: { Authorization: `OAuth ${accessToken}` }
    })

    const data = await response.json().catch(() => null)
    if (!response.ok || !data?.id) {
      this.logger.error(`Yandex userinfo failed: ${response.status} ${JSON.stringify(data)}`)
      throw new BadRequestException('Не удалось получить данные пользователя Яндекс ID')
    }

    return data as YandexUserInfo
  }

  async findOrCreateFromYandex(yandexUser: YandexUserInfo) {
    const byYandexId = await this.prisma.user.findUnique({ where: { yandexId: yandexUser.id } })
    if (byYandexId) {
      if (!byYandexId.isActive || byYandexId.deletedAt) {
        throw new UnauthorizedException('Аккаунт деактивирован')
      }
      await this.prisma.user.update({ where: { id: byYandexId.id }, data: { lastLoginAt: new Date() } })
      return this.buildAuthResponse(byYandexId.id, byYandexId.email)
    }

    const email = yandexUser.default_email || yandexUser.emails?.[0]
    if (!email) {
      throw new BadRequestException('Яндекс ID не предоставил email — проверьте разрешения приложения')
    }

    const byEmail = await this.prisma.user.findUnique({ where: { email } })
    if (byEmail) {
      if (!byEmail.isActive || byEmail.deletedAt) {
        throw new UnauthorizedException('Аккаунт деактивирован')
      }
      await this.prisma.user.update({
        where: { id: byEmail.id },
        data: { yandexId: yandexUser.id, lastLoginAt: new Date() }
      })
      return this.buildAuthResponse(byEmail.id, byEmail.email)
    }

    const fullName = yandexUser.real_name || yandexUser.display_name || undefined
    const generatedPassword = randomBytes(24).toString('hex')
    const result = await this.register({ email, password: generatedPassword, fullName } as RegisterDto)
    await this.prisma.user.update({ where: { email }, data: { yandexId: yandexUser.id } })

    return result
  }
}
