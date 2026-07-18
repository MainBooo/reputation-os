import { SyncService } from './sync.service'

function makeQueue(getJobImpl: (jobId: string) => any = () => null): any {
  return { getJob: jest.fn().mockImplementation(getJobImpl), add: jest.fn() }
}

function mockPrisma(overrides: { coreLogs?: any[]; telegramLog?: any } = {}) {
  const coreLogs = overrides.coreLogs ?? []
  const telegramLog = overrides.telegramLog ?? null

  return {
    company: { findUnique: jest.fn().mockResolvedValue({ id: 'c1', workspaceId: 'w1' }) },
    user: { findUnique: jest.fn().mockResolvedValue({ systemRole: 'SUPER_ADMIN', isActive: true }) },
    workspaceMember: { findFirst: jest.fn().mockResolvedValue({ role: 'OWNER' }) },
    jobLog: {
      findMany: jest.fn().mockResolvedValue(coreLogs),
      findFirst: jest.fn().mockResolvedValue(telegramLog)
    }
  } as any
}

function buildService(prisma: any, telegramQueue = makeQueue()) {
  return new SyncService(prisma, makeQueue(), makeQueue(), makeQueue(), makeQueue(), makeQueue(), telegramQueue)
}

describe('SyncService.getSyncStatus — telegram_search may only degrade to PARTIAL, never FAILED', () => {
  it('stays PENDING when there is no core activity and no telegram activity', async () => {
    const prisma = mockPrisma()
    const service = buildService(prisma)

    const result = await service.getSyncStatus('u1', 'c1')
    expect(result.status).toBe('PENDING')
  })

  it('downgrades an otherwise-PENDING status to PARTIAL when telegram_search is FAILED', async () => {
    const prisma = mockPrisma({ telegramLog: { queueName: 'telegram_search', jobStatus: 'FAILED', result: {} } })
    const service = buildService(prisma)

    const result = await service.getSyncStatus('u1', 'c1')
    expect(result.status).toBe('PARTIAL')
  })

  it('downgrades a core SUCCESS to PARTIAL when telegram_search is PARTIAL', async () => {
    const prisma = mockPrisma({
      coreLogs: [{ queueName: 'mentions_sync', jobStatus: 'SUCCESS', result: {}, createdAt: new Date() }],
      telegramLog: { queueName: 'telegram_search', jobStatus: 'PARTIAL', result: {} }
    })
    const service = buildService(prisma)

    const result = await service.getSyncStatus('u1', 'c1')
    expect(result.status).toBe('PARTIAL')
  })

  it('does NOT degrade to PARTIAL when telegram_search itself succeeded', async () => {
    const prisma = mockPrisma({
      coreLogs: [{ queueName: 'mentions_sync', jobStatus: 'SUCCESS', result: {}, createdAt: new Date() }],
      telegramLog: { queueName: 'telegram_search', jobStatus: 'SUCCESS', result: {} }
    })
    const service = buildService(prisma)

    const result = await service.getSyncStatus('u1', 'c1')
    expect(result.status).toBe('SUCCESS')
  })

  it('keeps the overall status FAILED when a core queue failed, regardless of telegram_search', async () => {
    const prisma = mockPrisma({
      coreLogs: [{ queueName: 'reviews_sync', jobStatus: 'FAILED', result: {}, createdAt: new Date() }],
      telegramLog: { queueName: 'telegram_search', jobStatus: 'SUCCESS', result: {} }
    })
    const service = buildService(prisma)

    const result = await service.getSyncStatus('u1', 'c1')
    expect(result.status).toBe('FAILED')
  })

  it('never reports FAILED purely because of telegram_search, even when telegram_search failed and core is otherwise idle', async () => {
    const prisma = mockPrisma({ telegramLog: { queueName: 'telegram_search', jobStatus: 'FAILED', result: {} } })
    const service = buildService(prisma)

    const result = await service.getSyncStatus('u1', 'c1')
    expect(result.status).not.toBe('FAILED')
  })

  it('keeps RUNNING as the overall status when a core job is active, even if telegram_search failed', async () => {
    const runningQueue = makeQueue((jobId) => (jobId === 'bull-1' ? { id: 'bull-1', getState: async () => 'active' } : null))
    const prisma = mockPrisma({
      coreLogs: [{ queueName: 'mentions_sync', jobStatus: 'PENDING', result: { bullJobId: 'bull-1' }, createdAt: new Date() }],
      telegramLog: { queueName: 'telegram_search', jobStatus: 'FAILED', result: {} }
    })
    const service = new SyncService(prisma, makeQueue(), runningQueue, makeQueue(), makeQueue(), makeQueue(), makeQueue())

    const result = await service.getSyncStatus('u1', 'c1')
    expect(result.status).toBe('RUNNING')
  })

  it('exposes telegramSearch status separately in the response for UI visibility', async () => {
    const prisma = mockPrisma({ telegramLog: { queueName: 'telegram_search', jobStatus: 'PARTIAL', result: { reason: 'mtproto_lock_busy' } } })
    const service = buildService(prisma)

    const result = await service.getSyncStatus('u1', 'c1')
    expect((result as any).telegramSearch.effectiveStatus).toBe('PARTIAL')
  })
})
