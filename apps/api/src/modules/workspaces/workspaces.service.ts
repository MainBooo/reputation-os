import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { WorkspaceRole } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { CreateWorkspaceDto } from './dto/create-workspace.dto'
import { AddWorkspaceMemberDto } from './dto/add-workspace-member.dto'
import { UpdateWorkspaceMemberRoleDto } from './dto/update-workspace-member-role.dto'

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

  private async getCurrentMember(userId: string, workspaceId: string) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId }
    })

    if (!member) throw new ForbiddenException('No access to workspace')
    return member
  }

  private assertCanManageMembers(role: WorkspaceRole) {
    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw new ForbiddenException('Only OWNER or ADMIN can manage workspace members')
    }
  }

  private assertCanManageRole(currentRole: WorkspaceRole, targetRole: WorkspaceRole) {
    if (currentRole === 'OWNER') return

    if (targetRole === 'OWNER' || targetRole === 'ADMIN') {
      throw new ForbiddenException('Only OWNER can manage OWNER or ADMIN roles')
    }
  }

  private async ensureOwnerWillRemain(workspaceId: string, memberId: string) {
    const member = await this.prisma.workspaceMember.findUnique({ where: { id: memberId } })
    if (!member) throw new NotFoundException('Workspace member not found')
    if (member.role !== 'OWNER') return

    const ownersCount = await this.prisma.workspaceMember.count({
      where: { workspaceId, role: 'OWNER' }
    })

    if (ownersCount <= 1) {
      throw new BadRequestException('Workspace must have at least one OWNER')
    }
  }

  async findMembers(userId: string, workspaceId: string) {
    await this.getCurrentMember(userId, workspaceId)

    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true
          }
        }
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }]
    })
  }

  async addMember(userId: string, workspaceId: string, dto: AddWorkspaceMemberDto) {
    const currentMember = await this.getCurrentMember(userId, workspaceId)
    this.assertCanManageMembers(currentMember.role)
    this.assertCanManageRole(currentMember.role, dto.role)

    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } })
    if (!workspace) throw new NotFoundException('Workspace not found')

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() }
    })
    if (!user) throw new NotFoundException('User with this email not found')

    const existing = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } }
    })
    if (existing) throw new BadRequestException('User is already a workspace member')

    return this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: user.id,
        role: dto.role
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true
          }
        }
      }
    })
  }

  async updateMemberRole(
    userId: string,
    workspaceId: string,
    memberId: string,
    dto: UpdateWorkspaceMemberRoleDto
  ) {
    const currentMember = await this.getCurrentMember(userId, workspaceId)
    this.assertCanManageMembers(currentMember.role)
    this.assertCanManageRole(currentMember.role, dto.role)

    const targetMember = await this.prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId }
    })
    if (!targetMember) throw new NotFoundException('Workspace member not found')

    if (targetMember.role === 'OWNER' && dto.role !== 'OWNER') {
      await this.ensureOwnerWillRemain(workspaceId, memberId)
    }

    return this.prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role: dto.role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true
          }
        }
      }
    })
  }

  async removeMember(userId: string, workspaceId: string, memberId: string) {
    const currentMember = await this.getCurrentMember(userId, workspaceId)
    this.assertCanManageMembers(currentMember.role)

    const targetMember = await this.prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId }
    })
    if (!targetMember) throw new NotFoundException('Workspace member not found')

    this.assertCanManageRole(currentMember.role, targetMember.role)
    await this.ensureOwnerWillRemain(workspaceId, memberId)

    await this.prisma.workspaceMember.delete({ where: { id: memberId } })

    return { ok: true }
  }
}
