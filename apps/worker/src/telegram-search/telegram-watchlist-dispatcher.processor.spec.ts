import { TelegramWatchlistDispatcherProcessor } from './telegram-watchlist-dispatcher.processor'

/**
 * Prisma's real `FOR UPDATE SKIP LOCKED` semantics can only be verified against a
 * live Postgres instance (no in-memory Prisma mock reproduces row-level locking
 * faithfully) — out of scope for these unit tests, same constraint the plan
 * accepts for the MTProto lock's Redis-backed tests. What IS unit-testable, and
 * what these tests cover, is that the dispatcher's own code behaves correctly
 * given the row-set Postgres would hand it: nextCheckAt math per interval, one
 * job per physical channel regardless of company count, and — by simulating two
 * concurrent transactions against a shared fake table with SKIP LOCKED semantics
 * modeled explicitly — that a row claimed by one in-flight transaction is never
 * handed to a second concurrent one.
 */

interface FakeRow {
  id: string
  telegramChannelId: string
  enabled: boolean
  nextCheckAt: Date
  checkIntervalMin: number
  locked: boolean
}

interface ExecuteRawCall {
  rowId: string
  nextCheckAt: Date
}

function makePrismaMock(rows: FakeRow[], executeCalls: ExecuteRawCall[] = []) {
  return {
    $transaction: jest.fn().mockImplementation(async (fn: any) => {
      const tx = {
        $queryRaw: jest.fn().mockImplementation(async () => {
          const now = new Date()
          const due = rows
            .filter((r) => r.enabled && !r.locked && r.nextCheckAt.getTime() <= now.getTime())
            .sort((a, b) => a.nextCheckAt.getTime() - b.nextCheckAt.getTime())

          for (const row of due) row.locked = true // SKIP LOCKED: unavailable to any concurrent transaction
          return due.map((r) => ({ id: r.id, telegramChannelId: r.telegramChannelId, checkIntervalMin: r.checkIntervalMin }))
        }),
        // Real call shape is a tagged template: $executeRaw`UPDATE ... SET "nextCheckAt" = ${nextCheckAt} WHERE id = ${row.id}`.
        // Values interpolated into a tagged template arrive as trailing args after the strings array.
        $executeRaw: jest.fn().mockImplementation(async (_strings: any, nextCheckAt: Date, rowId: string) => {
          executeCalls.push({ rowId, nextCheckAt })
          return 1
        })
      }

      try {
        return await fn(tx)
      } finally {
        for (const row of rows) row.locked = false // transaction ends — release
      }
    })
  }
}

function fakeQueue() {
  return { add: jest.fn().mockResolvedValue(undefined) }
}

describe('TelegramWatchlistDispatcherProcessor', () => {
  it.each([30, 60, 360, 1440])('advances nextCheckAt by exactly %d minutes for that interval', async (intervalMin) => {
    const now = Date.now()
    const rows: FakeRow[] = [
      { id: 'row1', telegramChannelId: 'tc1', enabled: true, nextCheckAt: new Date(now - 1000), checkIntervalMin: intervalMin, locked: false }
    ]
    const executeCalls: ExecuteRawCall[] = []
    const prisma = makePrismaMock(rows, executeCalls)
    const queue = fakeQueue()
    const processor = new TelegramWatchlistDispatcherProcessor(() => ({}), queue as any, prisma as any)

    const before = Date.now()
    const result = await processor.handle({} as any)
    const after = Date.now()

    expect(result).toEqual({ dispatched: 1, companiesDue: 1 })
    expect(executeCalls).toHaveLength(1)
    expect(executeCalls[0].rowId).toBe('row1')

    const expectedMin = before + intervalMin * 60_000
    const expectedMax = after + intervalMin * 60_000
    const actual = executeCalls[0].nextCheckAt.getTime()
    expect(actual).toBeGreaterThanOrEqual(expectedMin)
    expect(actual).toBeLessThanOrEqual(expectedMax)
  })

  it('produces exactly one BullMQ job per physical channel, even with several due companies on it', async () => {
    const now = Date.now()
    const rows: FakeRow[] = [
      { id: 'row1', telegramChannelId: 'tc1', enabled: true, nextCheckAt: new Date(now - 1000), checkIntervalMin: 360, locked: false },
      { id: 'row2', telegramChannelId: 'tc1', enabled: true, nextCheckAt: new Date(now - 1000), checkIntervalMin: 360, locked: false },
      { id: 'row3', telegramChannelId: 'tc2', enabled: true, nextCheckAt: new Date(now - 1000), checkIntervalMin: 360, locked: false }
    ]
    const prisma = makePrismaMock(rows)
    const queue = fakeQueue()
    const processor = new TelegramWatchlistDispatcherProcessor(() => ({}), queue as any, prisma as any)

    const result = await processor.handle({} as any)

    expect(result.companiesDue).toBe(3)
    expect(queue.add).toHaveBeenCalledTimes(2) // tc1 once, tc2 once
    const dispatchedChannelIds = queue.add.mock.calls.map((call: any[]) => call[1].telegramChannelId).sort()
    expect(dispatchedChannelIds).toEqual(['tc1', 'tc2'])
  })

  it('uses a jobId scoped to telegramChannelId and the capture epoch, not an hourly bucket', async () => {
    const now = Date.now()
    const rows: FakeRow[] = [
      { id: 'row1', telegramChannelId: 'tc1', enabled: true, nextCheckAt: new Date(now - 1000), checkIntervalMin: 30, locked: false }
    ]
    const prisma = makePrismaMock(rows)
    const queue = fakeQueue()
    const processor = new TelegramWatchlistDispatcherProcessor(() => ({}), queue as any, prisma as any)

    await processor.handle({} as any)

    const [, , options] = queue.add.mock.calls[0]
    expect(options.jobId).toMatch(/^telegram-watchlist:tc1:\d+$/)
  })

  it('does nothing when no rows are due', async () => {
    const prisma = makePrismaMock([])
    const queue = fakeQueue()
    const processor = new TelegramWatchlistDispatcherProcessor(() => ({}), queue as any, prisma as any)

    const result = await processor.handle({} as any)

    expect(result).toEqual({ dispatched: 0, companiesDue: 0 })
    expect(queue.add).not.toHaveBeenCalled()
  })

  it('two concurrent dispatcher calls only let one of them claim a given due row (SKIP LOCKED semantics)', async () => {
    const now = Date.now()
    const rows: FakeRow[] = [
      { id: 'row1', telegramChannelId: 'tc1', enabled: true, nextCheckAt: new Date(now - 1000), checkIntervalMin: 60, locked: false }
    ]
    const prisma = makePrismaMock(rows)
    const queue = fakeQueue()
    const processor = new TelegramWatchlistDispatcherProcessor(() => ({}), queue as any, prisma as any)

    // The two calls are issued back-to-back via Promise.all, mirroring two
    // dispatcher ticks (or two worker processes) racing for the same row.
    // firstStarted flips synchronously before the first transaction's SKIP
    // LOCKED-equivalent row-claim runs, so the second call reliably observes
    // the row already claimed — the same guarantee real SKIP LOCKED provides.
    let firstStarted = false
    const originalTransaction = prisma.$transaction.getMockImplementation()!
    let callCount = 0
    prisma.$transaction.mockImplementation(async (fn: any) => {
      callCount += 1
      if (callCount === 1) {
        firstStarted = true
        return originalTransaction(fn)
      }
      while (!firstStarted) await Promise.resolve()
      return originalTransaction(fn)
    })

    const [result1, result2] = await Promise.all([processor.handle({} as any), processor.handle({} as any)])

    const totalDue = result1.companiesDue + result2.companiesDue
    expect(totalDue).toBe(1) // exactly one of the two calls claimed the row
    expect(queue.add).toHaveBeenCalledTimes(1)
  })
})
