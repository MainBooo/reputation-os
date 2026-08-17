import { JwtService } from '@nestjs/jwt'
import { ChatGateway } from './chat.gateway'
import { ChatService } from './chat.service'

describe('ChatGateway authentication and room authorization', () => {
  const jwtService = { verify: jest.fn() }
  const chatService = {
    getActiveUserWorkspaceMemberships: jest.fn(),
    getThread: jest.fn()
  }

  const createSocket = (overrides: Record<string, unknown> = {}) => {
    const emit = jest.fn()
    const socket = {
      handshake: { auth: {}, headers: {} },
      data: {},
      rooms: new Set<string>(),
      join: jest.fn(),
      leave: jest.fn(),
      disconnect: jest.fn(),
      to: jest.fn(() => ({ emit })),
      ...overrides
    }

    return { socket: socket as any, emit }
  }

  let gateway: ChatGateway

  beforeAll(() => {
    process.env.JWT_SECRET = 'chat-gateway-test-secret'
  })

  beforeEach(() => {
    jest.clearAllMocks()
    gateway = new ChatGateway(jwtService as unknown as JwtService, chatService as unknown as ChatService)
    jwtService.verify.mockReturnValue({ sub: 'user-1' })
    chatService.getActiveUserWorkspaceMemberships.mockResolvedValue(['workspace-1'])
  })

  it('accepts the access token from an HttpOnly cookie and joins active rooms', async () => {
    const { socket } = createSocket({
      handshake: {
        auth: {},
        headers: { cookie: 'other=value; accessToken=cookie-jwt; theme=dark' }
      }
    })

    await gateway.handleConnection(socket)

    expect(jwtService.verify).toHaveBeenCalledWith('cookie-jwt', expect.any(Object))
    expect(chatService.getActiveUserWorkspaceMemberships).toHaveBeenCalledWith('user-1')
    expect(socket.join).toHaveBeenCalledWith('user:user-1')
    expect(socket.join).toHaveBeenCalledWith('workspace:workspace-1')
    expect(socket.disconnect).not.toHaveBeenCalled()
  })

  it('disconnects a missing, deleted, or inactive user after JWT verification', async () => {
    chatService.getActiveUserWorkspaceMemberships.mockResolvedValue(null)
    const { socket } = createSocket({
      handshake: { auth: { token: 'valid-jwt' }, headers: {} }
    })

    await gateway.handleConnection(socket)

    expect(socket.disconnect).toHaveBeenCalledTimes(1)
    expect(socket.join).not.toHaveBeenCalled()
  })

  it('does not broadcast typing events unless the socket joined the thread room', () => {
    const { socket, emit } = createSocket({ data: { userId: 'user-1' } })

    gateway.handleTypingStarted(socket, { threadId: 'foreign-thread' })
    gateway.handleTypingStopped(socket, { threadId: 'foreign-thread' })

    expect(socket.to).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  it('broadcasts typing events after the socket joined the thread room', () => {
    const { socket, emit } = createSocket({
      data: { userId: 'user-1' },
      rooms: new Set(['socket-id', 'chat-thread:thread-1'])
    })

    gateway.handleTypingStarted(socket, { threadId: 'thread-1' })

    expect(socket.to).toHaveBeenCalledWith('chat-thread:thread-1')
    expect(emit).toHaveBeenCalledWith('chat:typing_started', {
      threadId: 'thread-1',
      userId: 'user-1'
    })
  })
})
