import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from '@nestjs/common'
import { ChatThreadType } from '@prisma/client'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthUser } from '../../common/auth/auth-user.type'
import { ChatService } from './chat.service'
import { ChatGateway } from './chat.gateway'
import { CreateThreadDto } from './dto/create-thread.dto'
import { CreateMessageDto } from './dto/create-message.dto'
import { EditMessageDto } from './dto/edit-message.dto'

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway
  ) {}

  @Get('threads')
  getThreads(
    @CurrentUser() user: AuthUser,
    @Query('workspaceId') workspaceId: string,
    @Query('type') type?: ChatThreadType,
    @Query('companyId') companyId?: string,
    @Query('mentionId') mentionId?: string
  ) {
    return this.chatService.getThreads(user.id, workspaceId, { type, companyId, mentionId })
  }

  @Post('threads')
  createThread(@CurrentUser() user: AuthUser, @Body() dto: CreateThreadDto) {
    return this.chatService.createThread(user.id, dto)
  }

  @Get('threads/:threadId')
  getThread(
    @CurrentUser() user: AuthUser,
    @Param('threadId') threadId: string,
    @Query('workspaceId') workspaceId: string
  ) {
    return this.chatService.getThread(user.id, workspaceId, threadId)
  }

  @Get('threads/:threadId/messages')
  getMessages(
    @CurrentUser() user: AuthUser,
    @Param('threadId') threadId: string,
    @Query('workspaceId') workspaceId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string
  ) {
    return this.chatService.getMessages(
      user.id,
      workspaceId,
      threadId,
      cursor,
      limit ? Number(limit) : 50
    )
  }

  @Post('threads/:threadId/messages')
  async createMessage(
    @CurrentUser() user: AuthUser,
    @Param('threadId') threadId: string,
    @Body() dto: CreateMessageDto
  ) {
    const message = await this.chatService.createMessage(user.id, threadId, dto)

    this.chatGateway.emitToThread(threadId, 'chat:message_created', { threadId, message })

    // Emit unread update to all workspace members (they'll refetch their count)
    this.chatGateway.emitToWorkspace(dto.workspaceId, 'chat:unread_updated', {
      workspaceId: dto.workspaceId,
      threadId
    })

    return message
  }

  @Patch('messages/:messageId')
  async editMessage(
    @CurrentUser() user: AuthUser,
    @Param('messageId') messageId: string,
    @Body() dto: EditMessageDto
  ) {
    const message = await this.chatService.editMessage(user.id, messageId, dto)

    this.chatGateway.emitToThread(message.threadId, 'chat:message_updated', {
      threadId: message.threadId,
      message
    })

    return message
  }

  @Delete('messages/:messageId')
  async deleteMessage(
    @CurrentUser() user: AuthUser,
    @Param('messageId') messageId: string,
    @Query('workspaceId') workspaceId: string
  ) {
    const message = await this.chatService.deleteMessage(user.id, messageId, workspaceId)

    if ('threadId' in message) {
      this.chatGateway.emitToThread(message.threadId, 'chat:message_deleted', {
        threadId: message.threadId,
        messageId
      })
    }

    return message
  }

  @Post('threads/:threadId/read')
  async markRead(
    @CurrentUser() user: AuthUser,
    @Param('threadId') threadId: string,
    @Body('workspaceId') workspaceId: string
  ) {
    const result = await this.chatService.markRead(user.id, workspaceId, threadId)

    this.chatGateway.emitToUser(user.id, 'chat:thread_read', { threadId, workspaceId })

    return result
  }

  @Get('unread-count')
  getUnreadCount(
    @CurrentUser() user: AuthUser,
    @Query('workspaceId') workspaceId: string
  ) {
    return this.chatService.getUnreadCount(user.id, workspaceId)
  }

  @Get('company/:companyId/thread')
  getOrCreateCompanyThread(
    @CurrentUser() user: AuthUser,
    @Param('companyId') companyId: string,
    @Query('workspaceId') workspaceId: string
  ) {
    return this.chatService.getOrCreateCompanyThread(user.id, workspaceId, companyId)
  }

  @Get('mention/:mentionId/thread')
  getOrCreateMentionThread(
    @CurrentUser() user: AuthUser,
    @Param('mentionId') mentionId: string,
    @Query('workspaceId') workspaceId: string
  ) {
    return this.chatService.getOrCreateMentionThread(user.id, workspaceId, mentionId)
  }
}
