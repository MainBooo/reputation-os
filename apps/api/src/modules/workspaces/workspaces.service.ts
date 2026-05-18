import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { WorkspaceRole } from '@prisma/client'
import { randomBytes } from 'crypto'
import { PrismaService } from '../../common/prisma/prisma.service'
import { CreateWorkspaceDto } from './dto/create-workspace.dto'
import { AddWorkspaceMemberDto } from './dto/add-workspace-member.dto'
import { UpdateWorkspaceMemberRoleDto } from './dto/update-workspace-member-role.dto'
import { CreateWorkspaceInviteDto } from './dto/create-workspace-invite.dto'

const WORKSPACE_USERS_LIMIT = 2

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

  private async assertWorkspaceUserLimit(workspaceId: string) {
    const [membersCount, pendingInvitesCount] = await Promise.all([
      this.prisma.workspaceMember.count({ where: { workspaceId } }),
      this.prisma.workspaceInvite.count({
        where: {
          workspaceId,
          acceptedAt: null,
          expiresAt: { gt: new Date() }
        }
      })
    ])

    if (membersCount + pendingInvitesCount >= WORKSPACE_USERS_LIMIT) {
      throw new BadRequestException(`Workspace user limit reached: ${WORKSPACE_USERS_LIMIT}`)
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

    const user = await this.prisma.user.findFirst({
      where: {
        email: {
          equals: dto.email.trim(),
          mode: 'insensitive'
        }
      }
    })
    if (!user) throw new NotFoundException('User with this email not found')

    const existing = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } }
    })
    if (existing) throw new BadRequestException('User is already a workspace member')

    await this.assertWorkspaceUserLimit(workspaceId)

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


  async findInvites(userId: string, workspaceId: string) {
    await this.getCurrentMember(userId, workspaceId)

    return this.prisma.workspaceInvite.findMany({
      where: {
        workspaceId,
        acceptedAt: null
      },
      include: {
        invitedBy: {
          select: {
            id: true,
            email: true,
            fullName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
  }

  async createInvite(
    userId: string,
    workspaceId: string,
    dto: CreateWorkspaceInviteDto
  ) {
    const currentMember = await this.getCurrentMember(userId, workspaceId)

    this.assertCanManageMembers(currentMember.role)
    this.assertCanManageRole(currentMember.role, dto.role)

    const email = dto.email.trim().toLowerCase()

    const existingUser = await this.prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      const existingMember = await this.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: existingUser.id
          }
        }
      })

      if (existingMember) {
        throw new BadRequestException('User already in workspace')
      }
    }

    const existingInvite = await this.prisma.workspaceInvite.findFirst({
      where: {
        workspaceId,
        email,
        acceptedAt: null
      }
    })

    if (existingInvite) {
      throw new BadRequestException('Invite already exists')
    }

    await this.assertWorkspaceUserLimit(workspaceId)

    const token = randomBytes(32).toString('hex')

    return this.prisma.workspaceInvite.create({
      data: {
        workspaceId,
        email,
        role: dto.role,
        invitedById: userId,
        token,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24)
      }
    })
  }

  async acceptInvite(userId: string, token: string) {
    const invite = await this.prisma.workspaceInvite.findUnique({
      where: { token }
    })

    if (!invite) {
      throw new NotFoundException('Invite not found')
    }

    if (invite.acceptedAt) {
      throw new BadRequestException('Invite already accepted')
    }

    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite expired')
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new ForbiddenException('Invite email mismatch')
    }

    const existingMember = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: invite.workspaceId,
          userId
        }
      }
    })

    if (!existingMember) {
      await this.assertWorkspaceUserLimit(invite.workspaceId)

      await this.prisma.workspaceMember.create({
        data: {
          workspaceId: invite.workspaceId,
          userId,
          role: invite.role
        }
      })
    }

    await this.prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: {
        acceptedAt: new Date()
      }
    })

    return { ok: true }
  }

}
