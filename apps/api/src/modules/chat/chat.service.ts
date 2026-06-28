import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { ChatThreadType, WorkspaceRole } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { CreateThreadDto } from './dto/create-thread.dto'
import { CreateMessageDto } from './dto/create-message.dto'
import { EditMessageDto } from './dto/edit-message.dto'

const AUTHOR_SELECT = {
  id: true,
  email: true,
  fullName: true
}

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserWorkspaceMemberships(userId: string): Promise<string[]> {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true }
    })
    return memberships.map((m) => m.workspaceId)
  }

  // ─── Access helpers ───────────────────────────────────────────────────────

  private async assertMember(userId: string, workspaceId: string) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId }
    })
    if (!member) throw new ForbiddenException('Нет доступа к рабочему пространству')
    return member
  }

  private async getMemberRole(userId: string, workspaceId: string): Promise<WorkspaceRole | null> {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId }
    })
    return member?.role ?? null
  }

  private async assertDirectParticipant(userId: string, threadId: string) {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { threadId_userId: { threadId, userId } }
    })
    if (!participant) throw new ForbiddenException('Нет доступа к диалогу')
    return participant
  }

  private async assertThreadAccess(userId: string, threadId: string, workspaceId?: string) {
    const thread = await this.prisma.chatThread.findUnique({
      where: { id: threadId }
    })
    if (!thread) throw new NotFoundException('Тред не найден')

    if (thread.type === 'DIRECT') {
      await this.assertDirectParticipant(userId, threadId)
    } else {
      const wid = workspaceId || thread.workspaceId!
      await this.assertMember(userId, wid)
    }

    return thread
  }

  // ─── Unread count ─────────────────────────────────────────────────────────

  private async getUnreadForThread(userId: string, threadId: string): Promise<number> {
    const readState = await this.prisma.chatReadState.findUnique({
      where: { threadId_userId: { threadId, userId } }
    })

    const lastReadAt = readState?.lastReadAt ?? new Date(0)

    return this.prisma.chatMessage.count({
      where: {
        threadId,
        authorId: { not: userId },
        deletedAt: null,
        createdAt: { gt: lastReadAt }
      }
    })
  }

  // ─── Thread list ──────────────────────────────────────────────────────────

  async getThreads(
    userId: string,
    workspaceId: string,
    filters: { type?: ChatThreadType; companyId?: string; mentionId?: string } = {}
  ) {
    await this.assertMember(userId, workspaceId)
    await this.ensureWorkspaceThread(userId, workspaceId)

    const where: any = { workspaceId, isArchived: false }
    if (filters.type) where.type = filters.type
    if (filters.companyId) where.companyId = filters.companyId
    if (filters.mentionId) where.mentionId = filters.mentionId

    const workspaceThreads = await this.prisma.chatThread.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      include: {
        company: { select: { id: true, name: true } },
        mention: { select: { id: true, content: true, platform: true, companyId: true } },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { author: { select: AUTHOR_SELECT } }
        }
      }
    })

    const workspaceWithUnread = await Promise.all(
      workspaceThreads.map(async (thread) => {
        const unreadCount = await this.getUnreadForThread(userId, thread.id)
        return {
          id: thread.id,
          type: thread.type,
          title: thread.title,
          workspaceId: thread.workspaceId,
          companyId: thread.companyId ?? thread.mention?.companyId ?? null,
          mentionId: thread.mentionId,
          isArchived: thread.isArchived,
          lastMessageAt: thread.lastMessageAt,
          createdAt: thread.createdAt,
          company: thread.company,
          mention: thread.mention
            ? {
                id: thread.mention.id,
                preview: thread.mention.content?.slice(0, 80) ?? '',
                platform: thread.mention.platform
              }
            : null,
          participants: null as null,
          lastMessage: thread.messages[0] ?? null,
          unreadCount
        }
      })
    )

    // DIRECT threads for this user (not filtered by workspace)
    const directParticipations = await this.prisma.chatParticipant.findMany({
      where: { userId },
      include: {
        thread: {
          include: {
            participants: {
              include: { user: { select: AUTHOR_SELECT } }
            },
            messages: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { author: { select: AUTHOR_SELECT } }
            }
          }
        }
      }
    })

    const directWithUnread = await Promise.all(
      directParticipations
        .filter((p) => !p.thread.isArchived)
        .map(async (p) => {
          const thread = p.thread
          const unreadCount = await this.getUnreadForThread(userId, thread.id)
          return {
            id: thread.id,
            type: thread.type,
            title: thread.title,
            workspaceId: thread.workspaceId,
            isArchived: thread.isArchived,
            lastMessageAt: thread.lastMessageAt,
            createdAt: thread.createdAt,
            company: null as null,
            mention: null as null,
            participants: thread.participants.map((participant) => ({
              userId: participant.userId,
              user: participant.user
            })),
            lastMessage: thread.messages[0] ?? null,
            unreadCount
          }
        })
    )

    return [...workspaceWithUnread, ...directWithUnread]
  }

  // ─── Single thread ────────────────────────────────────────────────────────

  async getThread(userId: string, workspaceId: string, threadId: string) {
    const thread = await this.prisma.chatThread.findUnique({
      where: { id: threadId },
      include: {
        company: { select: { id: true, name: true } },
        mention: { select: { id: true, content: true, platform: true, companyId: true } },
        participants: { include: { user: { select: AUTHOR_SELECT } } }
      }
    })
    if (!thread) throw new NotFoundException('Тред не найден')

    if (thread.type === 'DIRECT') {
      await this.assertDirectParticipant(userId, threadId)
    } else {
      const wid = workspaceId || thread.workspaceId!
      if (!wid) throw new ForbiddenException('Нет доступа')
      await this.assertMember(userId, wid)
    }

    const unreadCount = await this.getUnreadForThread(userId, threadId)
    return {
      ...thread,
      companyId: thread.companyId ?? thread.mention?.companyId ?? null,
      unreadCount
    }
  }

  // ─── Messages (cursor pagination) ────────────────────────────────────────

  async getMessages(
    userId: string,
    workspaceId: string | undefined,
    threadId: string,
    cursor?: string,
    limit = 50
  ) {
    const thread = await this.prisma.chatThread.findUnique({ where: { id: threadId } })
    if (!thread) throw new NotFoundException('Тред не найден')

    if (thread.type === 'DIRECT') {
      await this.assertDirectParticipant(userId, threadId)
    } else {
      const wid = workspaceId || thread.workspaceId!
      await this.assertMember(userId, wid)
    }

    const take = Math.min(limit, 100)

    const where: any = { threadId }
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) }
    }

    const messages = await this.prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: { author: { select: AUTHOR_SELECT } }
    })

    const nextCursor =
      messages.length === take
        ? messages[messages.length - 1].createdAt.toISOString()
        : null

    return {
      messages: messages.reverse(),
      nextCursor
    }
  }

  // ─── Create / find-or-create thread ──────────────────────────────────────

  async ensureWorkspaceThread(userId: string, workspaceId: string) {
    const existing = await this.prisma.chatThread.findFirst({
      where: { workspaceId, type: 'WORKSPACE' }
    })
    if (existing) return existing

    return this.prisma.chatThread.create({
      data: {
        workspaceId,
        type: 'WORKSPACE',
        title: 'Общий чат',
        createdById: userId
      }
    })
  }

  async getOrCreateCompanyThread(userId: string, workspaceId: string, companyId: string) {
    await this.assertMember(userId, workspaceId)

    const company = await this.prisma.company.findFirst({
      where: { id: companyId, workspaceId }
    })
    if (!company) throw new NotFoundException('Компания не найдена')

    const existing = await this.prisma.chatThread.findFirst({
      where: { companyId, type: 'COMPANY' }
    })
    if (existing) return existing

    return this.prisma.chatThread.create({
      data: {
        workspaceId,
        type: 'COMPANY',
        companyId,
        title: `Обсуждение: ${company.name}`,
        createdById: userId
      }
    })
  }

  async getOrCreateMentionThread(userId: string, workspaceId: string, mentionId: string) {
    await this.assertMember(userId, workspaceId)

    const mention = await this.prisma.mention.findFirst({
      where: { id: mentionId },
      include: { company: { select: { workspaceId: true } } }
    })
    if (!mention || mention.company.workspaceId !== workspaceId) {
      throw new NotFoundException('Упоминание не найдено')
    }

    const existing = await this.prisma.chatThread.findFirst({
      where: { mentionId, type: 'MENTION' }
    })
    if (existing) return existing

    return this.prisma.chatThread.create({
      data: {
        workspaceId,
        type: 'MENTION',
        mentionId,
        title: 'Обсуждение отзыва',
        createdById: userId
      }
    })
  }

  async createThread(userId: string, dto: CreateThreadDto) {
    await this.assertMember(userId, dto.workspaceId)

    if (dto.type === 'WORKSPACE') {
      return this.ensureWorkspaceThread(userId, dto.workspaceId)
    }

    if (dto.type === 'COMPANY' && dto.companyId) {
      return this.getOrCreateCompanyThread(userId, dto.workspaceId, dto.companyId)
    }

    if (dto.type === 'MENTION' && dto.mentionId) {
      return this.getOrCreateMentionThread(userId, dto.workspaceId, dto.mentionId)
    }

    throw new BadRequestException('Неверные параметры треда')
  }

  // ─── Direct chat ──────────────────────────────────────────────────────────

  async findOrCreateDirectThread(requesterId: string, email: string) {
    const targetEmail = email.trim().toLowerCase()

    const targetUser = await this.prisma.user.findFirst({
      where: { email: targetEmail },
      select: { id: true, email: true, fullName: true }
    })
    if (!targetUser) {
      throw new NotFoundException('Пользователь с таким email не найден.')
    }

    if (targetUser.id === requesterId) {
      throw new BadRequestException('Нельзя создать чат с самим собой.')
    }

    // Find existing DIRECT thread where both users are participants
    const requesterParticipations = await this.prisma.chatParticipant.findMany({
      where: { userId: requesterId },
      select: { threadId: true }
    })
    const requesterThreadIds = requesterParticipations.map((p) => p.threadId)

    const existingThread = await this.prisma.chatThread.findFirst({
      where: {
        id: { in: requesterThreadIds },
        type: 'DIRECT',
        participants: { some: { userId: targetUser.id } }
      },
      include: {
        participants: { include: { user: { select: AUTHOR_SELECT } } }
      }
    })

    if (existingThread) return existingThread

    return this.prisma.chatThread.create({
      data: {
        type: 'DIRECT',
        createdById: requesterId,
        participants: {
          create: [{ userId: requesterId }, { userId: targetUser.id }]
        }
      },
      include: {
        participants: { include: { user: { select: AUTHOR_SELECT } } }
      }
    })
  }

  async getDirectParticipantIds(threadId: string): Promise<string[]> {
    const participants = await this.prisma.chatParticipant.findMany({
      where: { threadId },
      select: { userId: true }
    })
    return participants.map((p) => p.userId)
  }

  // ─── Messages ─────────────────────────────────────────────────────────────

  async createMessage(userId: string, threadId: string, dto: CreateMessageDto) {
    const thread = await this.prisma.chatThread.findUnique({ where: { id: threadId } })
    if (!thread) throw new NotFoundException('Тред не найден')

    if (thread.type === 'DIRECT') {
      await this.assertDirectParticipant(userId, threadId)
    } else {
      const wid = dto.workspaceId || thread.workspaceId!
      await this.assertMember(userId, wid)
    }

    const body = dto.body.trim()
    if (!body) throw new BadRequestException('Сообщение не может быть пустым')

    const [message] = await this.prisma.$transaction([
      this.prisma.chatMessage.create({
        data: {
          threadId,
          workspaceId: thread.workspaceId ?? undefined,
          authorId: userId,
          body
        },
        include: { author: { select: AUTHOR_SELECT } }
      }),
      this.prisma.chatThread.update({
        where: { id: threadId },
        data: { lastMessageAt: new Date() }
      })
    ])

    return message
  }

  async editMessage(userId: string, messageId: string, dto: EditMessageDto) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: { thread: true }
    })
    if (!message) throw new NotFoundException('Сообщение не найдено')
    if (message.deletedAt) throw new BadRequestException('Нельзя редактировать удалённое сообщение')

    if (message.thread.type === 'DIRECT') {
      // Only author can edit in DIRECT
      if (message.authorId !== userId) {
        throw new ForbiddenException('Можно редактировать только свои сообщения')
      }
      // Verify participant access
      await this.assertDirectParticipant(userId, message.threadId)
    } else {
      const workspaceId = dto.workspaceId || message.workspaceId || message.thread.workspaceId!
      const role = await this.getMemberRole(userId, workspaceId)
      if (!role) throw new ForbiddenException('Нет доступа')
      if (message.authorId !== userId && role === WorkspaceRole.MEMBER) {
        throw new ForbiddenException('Можно редактировать только свои сообщения')
      }
    }

    const body = dto.body.trim()
    if (!body) throw new BadRequestException('Сообщение не может быть пустым')

    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { body, editedAt: new Date() },
      include: { author: { select: AUTHOR_SELECT } }
    })
  }

  async deleteMessage(userId: string, messageId: string, workspaceId: string | undefined) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: { thread: true }
    })
    if (!message) throw new NotFoundException('Сообщение не найдено')
    if (message.deletedAt) return { ok: true }

    if (message.thread.type === 'DIRECT') {
      if (message.authorId !== userId) {
        throw new ForbiddenException('Можно удалять только свои сообщения')
      }
      await this.assertDirectParticipant(userId, message.threadId)
    } else {
      const wid = workspaceId || message.workspaceId || message.thread.workspaceId!
      const role = await this.getMemberRole(userId, wid)
      if (!role) throw new ForbiddenException('Нет доступа')
      if (message.authorId !== userId && role === WorkspaceRole.MEMBER) {
        throw new ForbiddenException('Можно удалять только свои сообщения')
      }
    }

    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
      include: { author: { select: AUTHOR_SELECT } }
    })
  }

  // ─── Read state ───────────────────────────────────────────────────────────

  async markRead(userId: string, workspaceId: string | undefined, threadId: string) {
    const thread = await this.prisma.chatThread.findUnique({ where: { id: threadId } })
    if (!thread) throw new NotFoundException('Тред не найден')

    if (thread.type === 'DIRECT') {
      await this.assertDirectParticipant(userId, threadId)
    } else {
      const wid = workspaceId || thread.workspaceId!
      await this.assertMember(userId, wid)
    }

    const lastMessage = await this.prisma.chatMessage.findFirst({
      where: { threadId, deletedAt: null },
      orderBy: { createdAt: 'desc' }
    })

    await this.prisma.chatReadState.upsert({
      where: { threadId_userId: { threadId, userId } },
      create: {
        threadId,
        userId,
        workspaceId: thread.workspaceId ?? undefined,
        lastReadAt: new Date(),
        lastReadMessageId: lastMessage?.id
      },
      update: {
        lastReadAt: new Date(),
        lastReadMessageId: lastMessage?.id
      }
    })

    return { ok: true }
  }

  async getUnreadCount(userId: string, workspaceId: string) {
    await this.assertMember(userId, workspaceId)

    const workspaceThreads = await this.prisma.chatThread.findMany({
      where: { workspaceId, isArchived: false },
      select: { id: true }
    })

    const directParticipations = await this.prisma.chatParticipant.findMany({
      where: { userId },
      select: { threadId: true }
    })

    const allThreadIds = [
      ...workspaceThreads.map((t) => t.id),
      ...directParticipations.map((p) => p.threadId)
    ]

    const counts = await Promise.all(
      allThreadIds.map((id) => this.getUnreadForThread(userId, id))
    )

    return { unreadCount: counts.reduce((sum, c) => sum + c, 0) }
  }
}
