import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest()
    const userId = request.user?.id

    if (!userId) throw new ForbiddenException('SUPER_ADMIN access required')

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { systemRole: true, isActive: true }
    })

    if (!user?.isActive || user.systemRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('SUPER_ADMIN access required')
    }

    return true
  }
}
