import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets'
import { JwtService } from '@nestjs/jwt'
import { Server, Socket } from 'socket.io'
import { ChatService } from './chat.service'

const ORIGINS = (process.env.FRONTEND_URL || 'http://localhost:4011')
  .split(',')
  .map((o) => o.trim())

@WebSocketGateway({
  path: '/api/socket.io',
  cors: { origin: ORIGINS, credentials: true }
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService
  ) {}

  async handleConnection(client: Socket) {
    const token =
      client.handshake.auth?.token ||
      (client.handshake.headers?.authorization as string | undefined)?.replace('Bearer ', '')

    if (!token) {
      client.disconnect()
      return
    }

    try {
      const payload = this.jwtService.verify<{ sub: string }>(token, {
        secret: process.env.JWT_SECRET || 'supersecret'
      })
      client.data.userId = payload.sub
      client.join(`user:${payload.sub}`)

      // Join all workspace rooms the user is a member of
      const memberships = await this.chatService.getUserWorkspaceMemberships(payload.sub)
      for (const workspaceId of memberships) {
        client.join(`workspace:${workspaceId}`)
      }
    } catch {
      client.disconnect()
    }
  }

  handleDisconnect(_client: Socket) {
    // Cleanup handled automatically by socket.io rooms
  }

  @SubscribeMessage('chat:join_thread')
  async handleJoinThread(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { threadId: string; workspaceId?: string }
  ) {
    const userId = client.data.userId as string | undefined
    if (!userId) return

    try {
      await this.chatService.getThread(userId, data.workspaceId || '', data.threadId)
      client.join(`chat-thread:${data.threadId}`)
    } catch {
      // Ignore access errors — client simply won't receive events
    }
  }

  @SubscribeMessage('chat:leave_thread')
  handleLeaveThread(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { threadId: string }
  ) {
    client.leave(`chat-thread:${data.threadId}`)
  }

  @SubscribeMessage('chat:typing_started')
  handleTypingStarted(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { threadId: string }
  ) {
    const userId = client.data.userId as string | undefined
    if (!userId) return

    client.to(`chat-thread:${data.threadId}`).emit('chat:typing_started', {
      threadId: data.threadId,
      userId
    })
  }

  @SubscribeMessage('chat:typing_stopped')
  handleTypingStopped(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { threadId: string }
  ) {
    const userId = client.data.userId as string | undefined
    if (!userId) return

    client.to(`chat-thread:${data.threadId}`).emit('chat:typing_stopped', {
      threadId: data.threadId,
      userId
    })
  }

  // ─── Emit helpers (called from ChatController) ────────────────────────────

  emitToThread(threadId: string, event: string, data: unknown) {
    this.server.to(`chat-thread:${threadId}`).emit(event, data)
  }

  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data)
  }

  emitToWorkspace(workspaceId: string, event: string, data: unknown) {
    this.server.to(`workspace:${workspaceId}`).emit(event, data)
  }
}
