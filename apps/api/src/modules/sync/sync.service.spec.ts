import { ForbiddenException } from '@nestjs/common'
import { SyncService } from './sync.service'

function makeQueue(getJobImpl: (jobId: string) => any = () => null): any {
  return { getJob: jest.fn().mockImplementation(getJobImpl), add: jest.fn() }
}

function mockPrisma(overrides: { coreLogs?: any[]; telegramLog?: any } = {}) {
  const coreLogs = overrides.coreLogs ?? []
  const telegramLog = overrides.telegramLog ?? null

  return {
    company: {
      findUnique: jest.fn().mockResolvedValue({ id: 'c1', workspaceId: 'w1', isActive: true }),
      findMany: jest.fn().mockResolvedValue([])
    },
    user: { findUnique: jest.fn().mockResolvedValue({ systemRole: 'SUPER_ADMIN', isActive: true }) },
    workspaceMember: { findFirst: jest.fn().mockResolvedValue({ role: 'OWNER' }) },
    jobLog: {
      findMany: jest.fn().mockResolvedValue(coreLogs),
      findFirst: jest.fn().mockResolvedValue(telegramLog)
    }
  } as any
}

function mockEntitlements(): any {
  return { getForWorkspace: jest.fn() }
}

function buildService(prisma: any, telegramQueue = makeQueue()) {
  return new SyncService(prisma, mockEntitlements(), makeQueue(), makeQueue(), makeQueue(), makeQueue(), makeQueue(), telegramQueue)
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
    const service = new SyncService(prisma, mockEntitlements(), makeQueue(), runningQueue, makeQueue(), makeQueue(), makeQueue(), makeQueue())

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

describe('SyncService.reconcile — active company fan-out', () => {
  it('queues one scoped job and pending log per active company', async () => {
    const prisma = mockPrisma()
    prisma.company.findMany.mockResolvedValue([{ id: 'company-1' }, { id: 'company-2' }])
    prisma.jobLog.create = jest.fn()
      .mockResolvedValueOnce({ id: 'log-1' })
      .mockResolvedValueOnce({ id: 'log-2' })
    const reconcileQueue = makeQueue()
    reconcileQueue.add
      .mockResolvedValueOnce({ id: 'job-1' })
      .mockResolvedValueOnce({ id: 'job-2' })
    const service = new SyncService(
      prisma,
      mockEntitlements(),
      makeQueue(),
      makeQueue(),
      makeQueue(),
      makeQueue(),
      reconcileQueue,
      makeQueue()
    )

    const result = await service.reconcile()

    expect(result.queued).toBe(true)
    expect(reconcileQueue.add).toHaveBeenNthCalledWith(
      1,
      'reconcile.run',
      expect.objectContaining({ companyId: 'company-1' }),
      expect.any(Object)
    )
    expect(reconcileQueue.add).toHaveBeenNthCalledWith(
      2,
      'reconcile.run',
      expect.objectContaining({ companyId: 'company-2' }),
      expect.any(Object)
    )
    expect(prisma.jobLog.create).toHaveBeenCalledTimes(2)
  })
})

describe('SyncService.startWebSync — billing gates', () => {
  function buildWebSyncFixture(overrides: { webMonitoringEnabled?: boolean; maxSources?: number; sourceCount?: number } = {}) {
    const prisma: any = mockPrisma()
    prisma.source = {
      findFirst: jest.fn().mockResolvedValue({ id: 'src-web', workspaceId: 'w1', platform: 'WEB' }),
      create: jest.fn()
    }
    prisma.companySourceTarget = {
      findFirst: jest.fn().mockResolvedValue(null), // no existing bootstrap target
      count: jest.fn().mockResolvedValue(overrides.sourceCount ?? 0),
      create: jest.fn().mockResolvedValue({ id: 'cst-web' })
    }
    prisma.jobLog.create = jest.fn().mockResolvedValue({ id: 'log-1' })

    const entitlements = {
      getForWorkspace: jest.fn().mockResolvedValue({
        workspaceActive: true,
        limits: {
          webMonitoringEnabled: overrides.webMonitoringEnabled ?? true,
          maxSources: overrides.maxSources ?? -1
        }
      }),
      // Real check now lives in EntitlementsService (dedup — see companies.service.ts /
      // entitlements.service.ts); delegate to the same count mock this fixture already sets up.
      hasSourceSlotAvailable: jest.fn(async (_workspaceId: string, maxSources: number) => {
        const limit = Number(maxSources)
        if (limit < 0) return true
        const count = await prisma.companySourceTarget.count()
        return count < limit
      }),
      runWithSourceSlot: jest.fn(async (
        _workspaceId: string,
        maxSources: number,
        action: (tx: any) => Promise<any>,
        options: { findExisting?: (tx: any) => Promise<any> } = {}
      ) => {
        const existing = options.findExisting ? await options.findExisting(prisma) : null
        if (existing) return existing
        const limit = Number(maxSources)
        if (limit >= 0 && (await prisma.companySourceTarget.count()) >= limit) {
          throw new ForbiddenException({ code: 'PLAN_LIMIT', feature: 'maxSources', limit })
        }
        return action(prisma)
      })
    }

    const mentionsQueue = makeQueue()
    const service = new SyncService(
      prisma,
      entitlements as any,
      makeQueue(),
      mentionsQueue,
      makeQueue(),
      makeQueue(),
      makeQueue(),
      makeQueue()
    )
    return { service, prisma, entitlements, mentionsQueue }
  }

  // Regression: startWebSync() used to have ZERO entitlement checks — a Start-tier
  // workspace (webMonitoringEnabled=false) could call it directly and it would
  // succeed, bootstrapping a WEB CompanySourceTarget and queuing sync jobs.
  it('rejects with PLAN_LIMIT when webMonitoringEnabled is false', async () => {
    const { service, prisma } = buildWebSyncFixture({ webMonitoringEnabled: false })

    await expect(service.startWebSync('u1', 'c1')).rejects.toMatchObject({
      response: { code: 'PLAN_LIMIT', feature: 'webMonitoringEnabled' }
    })
    expect(prisma.companySourceTarget.create).not.toHaveBeenCalled()
  })

  it('rejects with PLAN_LIMIT maxSources when the workspace is already at its source limit', async () => {
    const { service, prisma } = buildWebSyncFixture({ webMonitoringEnabled: true, maxSources: 6, sourceCount: 6 })

    await expect(service.startWebSync('u1', 'c1')).rejects.toMatchObject({
      response: { code: 'PLAN_LIMIT', feature: 'maxSources', limit: 6 }
    })
    expect(prisma.companySourceTarget.create).not.toHaveBeenCalled()
  })

  it('allows startWebSync when webMonitoringEnabled is true and a source slot is free', async () => {
    const { service, prisma, mentionsQueue } = buildWebSyncFixture({ webMonitoringEnabled: true, maxSources: 40, sourceCount: 10 })
    mentionsQueue.add.mockResolvedValue({ id: 'bull-1' })

    const result = await service.startWebSync('u1', 'c1')

    expect(result.queued).toBe(true)
    expect(prisma.companySourceTarget.create).toHaveBeenCalled()
  })
})
