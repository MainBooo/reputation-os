import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, SystemRole } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { UpdateAdminUserDto } from './dto/update-admin-user.dto'

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [usersCount, workspacesCount, companiesCount, mentionsCount] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.workspace.count(),
      this.prisma.company.count(),
      this.prisma.mention.count()
    ])

    return { usersCount, workspacesCount, companiesCount, mentionsCount }
  }

  async getUsers(filters?: { q?: string; systemRole?: string }) {
    const q = filters?.q?.trim()
    const systemRole = filters?.systemRole?.trim() as SystemRole | undefined

    const where: Prisma.UserWhereInput = {
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { fullName: { contains: q, mode: 'insensitive' } }
            ]
          }
        : {}),
      ...(systemRole && ['USER', 'SUPER_ADMIN'].includes(systemRole) ? { systemRole } : {})
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        systemRole: true,
        lastLoginAt: true,
        createdAt: true,
        workspaceMembers: {
          select: {
            id: true,
            role: true,
            workspace: { select: { id: true, name: true, slug: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    })
  }

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
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        systemRole: true,
        lastLoginAt: true,
        createdAt: true,
        workspaceMembers: {
          select: {
            id: true,
            role: true,
            workspace: { select: { id: true, name: true, slug: true } }
          }
        }
      }
    })
  }

  async getWorkspaces() {
    return this.prisma.workspace.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: { select: { members: true, companies: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    })
  }
}
