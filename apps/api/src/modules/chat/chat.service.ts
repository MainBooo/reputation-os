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

  private async assertThreadAccess(userId: string, threadId: string) {
    const thread = await this.prisma.chatThread.findUnique({ where: { id: threadId } })
    if (!thread) throw new NotFoundException('Тред не найден')
    await this.assertMember(userId, thread.workspaceId)
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

    const threads = await this.prisma.chatThread.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      include: {
        company: { select: { id: true, name: true } },
        mention: { select: { id: true, content: true, platform: true } },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { author: { select: AUTHOR_SELECT } }
        }
      }
    })

    const withUnread = await Promise.all(
      threads.map(async (thread) => {
        const unreadCount = await this.getUnreadForThread(userId, thread.id)
        return {
          id: thread.id,
          type: thread.type,
          title: thread.title,
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
          lastMessage: thread.messages[0] ?? null,
          unreadCount
        }
      })
    )

    return withUnread
  }

  // ─── Single thread ────────────────────────────────────────────────────────

  async getThread(userId: string, workspaceId: string, threadId: string) {
    await this.assertMember(userId, workspaceId)

    const thread = await this.prisma.chatThread.findFirst({
      where: { id: threadId, workspaceId },
      include: {
        company: { select: { id: true, name: true } },
        mention: { select: { id: true, content: true, platform: true } }
      }
    })
    if (!thread) throw new NotFoundException('Тред не найден')

    const unreadCount = await this.getUnreadForThread(userId, threadId)
    return { ...thread, unreadCount }
  }

  // ─── Messages (cursor pagination) ────────────────────────────────────────

  async getMessages(
    userId: string,
    workspaceId: string,
    threadId: string,
    cursor?: string,
    limit = 50
  ) {
    await this.assertMember(userId, workspaceId)

    const thread = await this.prisma.chatThread.findFirst({
      where: { id: threadId, workspaceId }
    })
    if (!thread) throw new NotFoundException('Тред не найден')

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

  // ─── Messages ─────────────────────────────────────────────────────────────

  async createMessage(userId: string, threadId: string, dto: CreateMessageDto) {
    const thread = await this.prisma.chatThread.findFirst({
      where: { id: threadId, workspaceId: dto.workspaceId }
    })
    if (!thread) throw new NotFoundException('Тред не найден')

    await this.assertMember(userId, dto.workspaceId)

    const body = dto.body.trim()
    if (!body) throw new BadRequestException('Сообщение не может быть пустым')

    const [message] = await this.prisma.$transaction([
      this.prisma.chatMessage.create({
        data: {
          threadId,
          workspaceId: dto.workspaceId,
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
    const message = await this.prisma.chatMessage.findFirst({
      where: { id: messageId, workspaceId: dto.workspaceId }
    })
    if (!message) throw new NotFoundException('Сообщение не найдено')
    if (message.deletedAt) throw new BadRequestException('Нельзя редактировать удалённое сообщение')

    const role = await this.getMemberRole(userId, dto.workspaceId)
    if (!role) throw new ForbiddenException('Нет доступа')

    if (message.authorId !== userId && role === WorkspaceRole.MEMBER) {
      throw new ForbiddenException('Можно редактировать только свои сообщения')
    }

    const body = dto.body.trim()
    if (!body) throw new BadRequestException('Сообщение не может быть пустым')

    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { body, editedAt: new Date() },
      include: { author: { select: AUTHOR_SELECT } }
    })
  }

  async deleteMessage(userId: string, messageId: string, workspaceId: string) {
    const message = await this.prisma.chatMessage.findFirst({
      where: { id: messageId, workspaceId }
    })
    if (!message) throw new NotFoundException('Сообщение не найдено')
    if (message.deletedAt) return { ok: true }

    const role = await this.getMemberRole(userId, workspaceId)
    if (!role) throw new ForbiddenException('Нет доступа')

    if (message.authorId !== userId && role === WorkspaceRole.MEMBER) {
      throw new ForbiddenException('Можно удалять только свои сообщения')
    }

    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
      include: { author: { select: AUTHOR_SELECT } }
    })
  }

  // ─── Read state ───────────────────────────────────────────────────────────

  async markRead(userId: string, workspaceId: string, threadId: string) {
    const thread = await this.prisma.chatThread.findFirst({
      where: { id: threadId, workspaceId }
    })
    if (!thread) throw new NotFoundException('Тред не найден')

    await this.assertMember(userId, workspaceId)

    const lastMessage = await this.prisma.chatMessage.findFirst({
      where: { threadId, deletedAt: null },
      orderBy: { createdAt: 'desc' }
    })

    await this.prisma.chatReadState.upsert({
      where: { threadId_userId: { threadId, userId } },
      create: {
        threadId,
        userId,
        workspaceId,
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

    const threads = await this.prisma.chatThread.findMany({
      where: { workspaceId, isArchived: false },
      select: { id: true }
    })

    const counts = await Promise.all(
      threads.map((t) => this.getUnreadForThread(userId, t.id))
    )

    return { unreadCount: counts.reduce((sum, c) => sum + c, 0) }
  }
}
