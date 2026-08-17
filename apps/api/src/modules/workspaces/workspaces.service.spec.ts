import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { EntitlementsService } from '../billing/entitlements.service'
import { PrismaService } from '../../common/prisma/prisma.service'
import { WorkspacesService } from './workspaces.service'

describe('WorkspacesService.findInvites', () => {
  const prisma: any = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    workspace: { findUnique: jest.fn() },
    workspaceMember: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn()
    },
    workspaceInvite: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    notification: { create: jest.fn(), updateMany: jest.fn() }
  }
  prisma.$transaction = jest.fn((action: (tx: any) => Promise<any>) => action(prisma))
  const entitlements = {
    getForWorkspace: jest.fn().mockResolvedValue({
      workspaceActive: true,
      limits: { maxMembers: 2 }
    })
  } as unknown as EntitlementsService
  let service: WorkspacesService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new WorkspacesService(prisma as unknown as PrismaService, entitlements)
  })

  it('forbids MEMBER from reading invitation emails and tokens', async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: 'member-1', role: 'MEMBER' })

    await expect(service.findInvites('user-1', 'workspace-1')).rejects.toThrow(ForbiddenException)
    expect(prisma.workspaceInvite.findMany).not.toHaveBeenCalled()
  })

  it.each(['OWNER', 'ADMIN'] as const)('allows %s and returns only live pending invitations', async (role) => {
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: 'member-1', role })
    prisma.workspaceInvite.findMany.mockResolvedValue([])

    await service.findInvites('user-1', 'workspace-1')

    expect(prisma.workspaceInvite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId: 'workspace-1',
          acceptedAt: null,
          declinedAt: null,
          expiresAt: { gt: expect.any(Date) }
        }
      })
    )
  })

  describe('member-slot accounting', () => {
    const liveInvite = {
      id: 'invite-1',
      token: 'token-1',
      workspaceId: 'workspace-1',
      email: 'invitee@example.com',
      role: 'MEMBER',
      acceptedAt: null,
      declinedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      workspace: { isActive: true, deletedAt: null }
    }

    beforeEach(() => {
      prisma.workspaceInvite.findUnique.mockResolvedValue(liveInvite)
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-2', email: 'invitee@example.com', isActive: true, deletedAt: null
      })
      prisma.workspaceMember.findUnique.mockResolvedValue(null)
      prisma.workspaceMember.count.mockResolvedValue(1)
      prisma.workspaceInvite.count.mockResolvedValue(0)
      prisma.workspaceMember.create.mockResolvedValue({ id: 'member-2' })
      prisma.workspaceInvite.update.mockResolvedValue({ ...liveInvite, acceptedAt: new Date() })
      prisma.notification.updateMany.mockResolvedValue({ count: 1 })
    })

    it('accepts the invite that reserves the final available member seat', async () => {
      await expect(service.acceptInvite('user-2', 'token-1')).resolves.toEqual({ ok: true })

      expect(prisma.workspaceInvite.count).toHaveBeenCalledWith({
        where: {
          workspaceId: 'workspace-1',
          id: { not: 'invite-1' },
          acceptedAt: null,
          declinedAt: null,
          expiresAt: { gt: expect.any(Date) }
        }
      })
      expect(prisma.workspaceMember.create).toHaveBeenCalledTimes(1)
      expect(prisma.workspaceInvite.update).toHaveBeenCalledWith({
        where: { id: 'invite-1' },
        data: { acceptedAt: expect.any(Date) }
      })
    })

    it('rejects acceptance when another reservation already consumes the final seat', async () => {
      prisma.workspaceInvite.count.mockResolvedValue(1)

      await expect(service.acceptInvite('user-2', 'token-1')).rejects.toThrow(BadRequestException)
      expect(prisma.workspaceMember.create).not.toHaveBeenCalled()
      expect(prisma.workspaceInvite.update).not.toHaveBeenCalled()
    })
  })
})
