import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { CreateWorkspaceDto } from './dto/create-workspace.dto'

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForUser(userId: string) {
    return this.prisma.workspace.findMany({
      where: { members: { some: { userId } } },
      include: { members: true, companies: true },
      orderBy: { createdAt: 'desc' }
    })
  }

  async create(userId: string, dto: CreateWorkspaceDto) {
    const existing = await this.prisma.workspace.findUnique({ where: { slug: dto.slug } })
    if (existing) throw new BadRequestException('Workspace with this slug already exists')

    return this.prisma.workspace.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        members: { create: { userId, role: 'OWNER' } }
      },
      include: { members: true }
    })
  }

  async findOneForUser(userId: string, id: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: { members: true, companies: true }
    })
    if (!workspace) throw new NotFoundException('Workspace not found')
    const hasAccess = workspace.members.some((member) => member.userId === userId)
    if (!hasAccess) throw new ForbiddenException('No access to workspace')
    return workspace
  }
}
