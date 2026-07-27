import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { PrismaService } from '../../common/prisma/prisma.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // No fallback here either — AuthModule already refuses to start if
      // JWT_SECRET is unset, so this only ever runs with a real secret.
      secretOrKey: process.env.JWT_SECRET as string
    })
  }

  async validate(payload: { sub: string; email?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, isActive: true, deletedAt: true }
    })
    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException()
    }
    return { id: user.id, email: user.email }
  }
}
