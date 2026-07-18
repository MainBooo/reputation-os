import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { TelegramChannelsService } from './telegram-channels.service'
import { CreateTelegramChannelDto } from './dto/create-telegram-channel.dto'

function baseEntitlements(overrides: Partial<{ telegramMonitoringEnabled: boolean; platforms: string[]; workspaceActive: boolean }> = {}) {
  return {
    workspaceActive: overrides.workspaceActive ?? true,
    limits: {
      telegramMonitoringEnabled: overrides.telegramMonitoringEnabled ?? true,
      platforms: overrides.platforms ?? ['YANDEX', 'TWOGIS', 'WEB', 'TELEGRAM']
    }
  }
}

function mockPrisma() {
  return {
    company: { findUnique: jest.fn().mockResolvedValue({ id: 'c1', workspaceId: 'w1', name: 'Acme' }) },
    user: { findUnique: jest.fn().mockResolvedValue({ systemRole: 'USER', isActive: true }) },
    workspaceMember: { findFirst: jest.fn().mockResolvedValue({ role: 'OWNER' }) },
    companyTelegramChannel: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _sum: { mentionsFoundCount: 0 } })
    },
    source: { findFirst: jest.fn(), create: jest.fn() },
    companySourceTarget: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    jobLog: { create: jest.fn().mockResolvedValue({ id: 'log1' }), findFirst: jest.fn() }
  } as any
}

function mockQueue() {
  return { add: jest.fn().mockResolvedValue({ id: 'bull-1' }) }
}

describe('TelegramChannelsService — workspace isolation & billing gates', () => {
  it('throws ForbiddenException when the user is not a workspace member', async () => {
    const prisma = mockPrisma()
    prisma.workspaceMember.findFirst.mockResolvedValue(null)
    const entitlements = { getForWorkspace: jest.fn().mockResolvedValue(baseEntitlements()) }
    const service = new TelegramChannelsService(prisma, entitlements as any, mockQueue() as any)

    await expect(service.list('u1', 'c1')).rejects.toThrow(ForbiddenException)
  })

  it('throws NotFoundException for a nonexistent company', async () => {
    const prisma = mockPrisma()
    prisma.company.findUnique.mockResolvedValue(null)
    const entitlements = { getForWorkspace: jest.fn().mockResolvedValue(baseEntitlements()) }
    const service = new TelegramChannelsService(prisma, entitlements as any, mockQueue() as any)

    await expect(service.list('u1', 'missing')).rejects.toThrow(NotFoundException)
  })

  it('blocks create() with PLAN_LIMIT when telegramMonitoringEnabled is false (FREE/START)', async () => {
    const prisma = mockPrisma()
    const entitlements = {
      getForWorkspace: jest.fn().mockResolvedValue(baseEntitlements({ telegramMonitoringEnabled: false, platforms: ['YANDEX', 'TWOGIS'] }))
    }
    const service = new TelegramChannelsService(prisma, entitlements as any, mockQueue() as any)

    await expect(service.create('u1', 'c1', { username: 'somechannel' } as CreateTelegramChannelDto)).rejects.toMatchObject({
      response: { code: 'PLAN_LIMIT', feature: 'telegramMonitoringEnabled' }
    })
  })

  it('blocks startTelegramSync() with PLAN_LIMIT on a FREE/START plan', async () => {
    const prisma = mockPrisma()
    const entitlements = {
      getForWorkspace: jest.fn().mockResolvedValue(baseEntitlements({ telegramMonitoringEnabled: false, platforms: ['YANDEX', 'TWOGIS'] }))
    }
    const service = new TelegramChannelsService(prisma, entitlements as any, mockQueue() as any)

    await expect(service.startTelegramSync('u1', 'c1')).rejects.toMatchObject({
      response: { code: 'PLAN_LIMIT', feature: 'telegramMonitoringEnabled' }
    })
  })

  it('blocks write access when the workspace is disabled, even on a PRO plan', async () => {
    const prisma = mockPrisma()
    const entitlements = { getForWorkspace: jest.fn().mockResolvedValue(baseEntitlements({ workspaceActive: false })) }
    const service = new TelegramChannelsService(prisma, entitlements as any, mockQueue() as any)

    await expect(service.startTelegramSync('u1', 'c1')).rejects.toThrow(ForbiddenException)
  })

  it('allows create() on a PRO/AGENCY plan and enqueues a source_check job', async () => {
    const prisma = mockPrisma()
    prisma.jobLog.findFirst.mockResolvedValue({
      jobStatus: 'SUCCESS',
      result: { bullJobId: 'bull-1', ok: true, telegramChannelId: 'tc1', companyTelegramChannelId: 'ctc1' }
    })
    prisma.companyTelegramChannel.findUnique.mockResolvedValue({
      id: 'ctc1',
      companyId: 'c1',
      telegramChannelId: 'tc1',
      enabled: true,
      discoveryMethod: 'MANUAL',
      matchedQuery: null,
      checkIntervalMin: 360,
      nextCheckAt: new Date(),
      lastCheckedAt: null,
      consecutiveErrors: 0,
      lastError: null,
      lastDecisionReason: null,
      relevanceScore: null,
      mentionsFoundCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      telegramChannel: { chatId: '555', username: 'somechannel', title: 'Some Channel', entityType: 'channel' }
    })
    const queue = mockQueue()
    const entitlements = { getForWorkspace: jest.fn().mockResolvedValue(baseEntitlements()) }
    const service = new TelegramChannelsService(prisma, entitlements as any, queue as any)

    const result = await service.create('u1', 'c1', { username: '@somechannel' } as CreateTelegramChannelDto)

    expect(queue.add).toHaveBeenCalledWith(
      'telegram.source_check',
      expect.objectContaining({ mode: 'source_check', companyId: 'c1', username: 'somechannel' }),
      expect.anything()
    )
    expect((result as any).username).toBe('somechannel')
  })

  it('translates a not_found resolve outcome into a friendly BadRequestException', async () => {
    const prisma = mockPrisma()
    prisma.jobLog.findFirst.mockResolvedValue({
      jobStatus: 'PARTIAL',
      result: { bullJobId: 'bull-1', ok: false, reason: 'not_found', message: 'nope' }
    })
    const entitlements = { getForWorkspace: jest.fn().mockResolvedValue(baseEntitlements()) }
    const service = new TelegramChannelsService(prisma, entitlements as any, mockQueue() as any)

    await expect(service.create('u1', 'c1', { username: 'ghost' } as CreateTelegramChannelDto)).rejects.toThrow(BadRequestException)
  })

  it('sets nextCheckAt to now when enabling a previously-disabled channel', async () => {
    const prisma = mockPrisma()
    prisma.companyTelegramChannel.findUnique.mockResolvedValue({ id: 'ctc1', companyId: 'c1', enabled: false, nextCheckAt: null })
    prisma.companyTelegramChannel.update.mockImplementation(async ({ data }: any) => ({
      id: 'ctc1',
      companyId: 'c1',
      telegramChannel: { chatId: '1', username: 'c', title: 't', entityType: 'channel' },
      discoveryMethod: 'MANUAL',
      matchedQuery: null,
      checkIntervalMin: 360,
      consecutiveErrors: 0,
      lastError: null,
      lastDecisionReason: null,
      relevanceScore: null,
      mentionsFoundCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastCheckedAt: null,
      ...data
    }))
    const entitlements = { getForWorkspace: jest.fn().mockResolvedValue(baseEntitlements()) }
    const service = new TelegramChannelsService(prisma, entitlements as any, mockQueue() as any)

    await service.update('u1', 'c1', 'ctc1', { enabled: true })

    const updateCall = prisma.companyTelegramChannel.update.mock.calls[0][0]
    expect(updateCall.data.enabled).toBe(true)
    expect(updateCall.data.nextCheckAt).toBeInstanceOf(Date)
  })

  it('remove() only deletes the CompanyTelegramChannel link, never the shared TelegramChannel row', async () => {
    const prisma = mockPrisma()
    prisma.companyTelegramChannel.findUnique.mockResolvedValue({ id: 'ctc1', companyId: 'c1' })
    const entitlements = { getForWorkspace: jest.fn().mockResolvedValue(baseEntitlements()) }
    const service = new TelegramChannelsService(prisma, entitlements as any, mockQueue() as any)

    await service.remove('u1', 'c1', 'ctc1')

    expect(prisma.companyTelegramChannel.delete).toHaveBeenCalledWith({ where: { id: 'ctc1' } })
  })

  it('rejects operating on a channel that belongs to a different company (workspace isolation)', async () => {
    const prisma = mockPrisma()
    prisma.companyTelegramChannel.findUnique.mockResolvedValue({ id: 'ctc1', companyId: 'OTHER_COMPANY' })
    const entitlements = { getForWorkspace: jest.fn().mockResolvedValue(baseEntitlements()) }
    const service = new TelegramChannelsService(prisma, entitlements as any, mockQueue() as any)

    await expect(service.remove('u1', 'c1', 'ctc1')).rejects.toThrow(NotFoundException)
  })
})
