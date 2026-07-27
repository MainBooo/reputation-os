import { Test } from '@nestjs/testing'
import { ForbiddenException } from '@nestjs/common'
import { ChatService } from './chat.service'
import { PrismaService } from '../../common/prisma/prisma.service'

const mockPrisma = {
  chatMessage: { findUnique: jest.fn(), update: jest.fn() },
  workspaceMember: { findFirst: jest.fn() },
  chatParticipant: { findUnique: jest.fn() }
}

const groupMessage = {
  id: 'msg-1',
  threadId: 'thread-1',
  workspaceId: 'ws-real',
  authorId: 'author-1',
  body: 'original',
  deletedAt: null,
  thread: { id: 'thread-1', type: 'GROUP', workspaceId: 'ws-real' }
}

describe('ChatService — cross-tenant IDOR regression (editMessage/deleteMessage)', () => {
  let service: ChatService

  beforeEach(async () => {
    jest.clearAllMocks()
    mockPrisma.chatMessage.findUnique.mockResolvedValue(groupMessage)
    mockPrisma.chatMessage.update.mockResolvedValue({ ...groupMessage, body: 'edited' })

    const module = await Test.createTestingModule({
      providers: [ChatService, { provide: PrismaService, useValue: mockPrisma }]
    }).compile()
    service = module.get(ChatService)
  })

  // Regression: the role check used to resolve via
  // `dto.workspaceId || message.workspaceId || message.thread.workspaceId`
  // — a caller-supplied workspaceId took priority. An OWNER of an unrelated
  // workspace (`ws-attacker`) could pass THAT id, satisfy `role !== MEMBER`,
  // and edit/delete a message that actually belongs to `ws-real`, which they
  // have no membership in at all.
  it('rejects editing a message when the caller is OWNER of a different workspace than the message', async () => {
    mockPrisma.workspaceMember.findFirst.mockImplementation(({ where }: any) =>
      where.workspaceId === 'ws-attacker' ? { role: 'OWNER', workspaceId: 'ws-attacker' } : null
    )

    await expect(
      service.editMessage('attacker-user', 'msg-1', { body: 'pwned', workspaceId: 'ws-attacker' } as any)
    ).rejects.toThrow(ForbiddenException)
    expect(mockPrisma.chatMessage.update).not.toHaveBeenCalled()
  })

  it('rejects deleting a message when the caller is OWNER of a different workspace than the message', async () => {
    mockPrisma.workspaceMember.findFirst.mockImplementation(({ where }: any) =>
      where.workspaceId === 'ws-attacker' ? { role: 'OWNER', workspaceId: 'ws-attacker' } : null
    )

    await expect(service.deleteMessage('attacker-user', 'msg-1', 'ws-attacker')).rejects.toThrow(
      ForbiddenException
    )
    expect(mockPrisma.chatMessage.update).not.toHaveBeenCalled()
  })

  it('allows an ADMIN of the message\'s real workspace to edit a message authored by someone else', async () => {
    mockPrisma.workspaceMember.findFirst.mockImplementation(({ where }: any) =>
      where.workspaceId === 'ws-real' ? { role: 'ADMIN', workspaceId: 'ws-real' } : null
    )

    const result = await service.editMessage('admin-user', 'msg-1', { body: 'moderated' } as any)

    expect(result).toBeDefined()
    expect(mockPrisma.chatMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'msg-1' } })
    )
  })

  it('rejects a plain MEMBER of the real workspace editing someone else\'s message', async () => {
    mockPrisma.workspaceMember.findFirst.mockImplementation(({ where }: any) =>
      where.workspaceId === 'ws-real' ? { role: 'MEMBER', workspaceId: 'ws-real' } : null
    )

    await expect(
      service.editMessage('member-user', 'msg-1', { body: 'nope' } as any)
    ).rejects.toThrow(ForbiddenException)
  })
})
