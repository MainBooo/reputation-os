import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { PlanCode, SubscriptionStatus } from '@prisma/client'
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
    if (!user) throw new UnauthorizedException('Invalid credentials')

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

  private buildAuthResponse(userId: string, email: string) {
    const accessToken = this.jwtService.sign({ sub: userId, email })
    return { accessToken, user: { id: userId, email } }
  }
}
