jest.mock('playwright', () => ({
  chromium: { launch: jest.fn() }
}))

import { chromium } from 'playwright'
import { TwoGisAdapter } from './twogis.adapter'

function makePage(overrides: Partial<Record<string, any>> = {}) {
  return {
    goto: jest.fn().mockResolvedValue(undefined),
    isClosed: jest.fn().mockReturnValue(false),
    waitForTimeout: jest.fn().mockResolvedValue(undefined),
    mouse: { wheel: jest.fn().mockResolvedValue(undefined) },
    evaluate: jest.fn().mockResolvedValue([]),
    ...overrides
  }
}

function makeContext(page: any) {
  return {
    addInitScript: jest.fn().mockResolvedValue(undefined),
    newPage: jest.fn().mockResolvedValue(page),
    close: jest.fn().mockResolvedValue(undefined)
  }
}

function makeBrowser(contexts: any[]) {
  let callIndex = 0
  return {
    newContext: jest.fn().mockImplementation(() => Promise.resolve(contexts[Math.min(callIndex++, contexts.length - 1)])),
    close: jest.fn().mockResolvedValue(undefined)
  }
}

describe('TwoGisAdapter.fetchMentions — goto retry behavior', () => {
  const target = { id: 't1', externalUrl: 'https://2gis.ru/moscow/firm/123/tab/reviews' }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns [] immediately for a target with no externalUrl (no browser launched)', async () => {
    const adapter = new TwoGisAdapter()
    const result = await adapter.fetchMentions({ id: 't1', externalUrl: null })
    expect(result).toEqual([])
    expect(chromium.launch).not.toHaveBeenCalled()
  })

  it('succeeds on the first attempt without creating a retry context', async () => {
    const page = makePage()
    const context = makeContext(page)
    const browser = makeBrowser([context])
    ;(chromium.launch as jest.Mock).mockResolvedValue(browser)

    const adapter = new TwoGisAdapter()
    const result = await adapter.fetchMentions(target)

    expect(result).toEqual([])
    expect(page.goto).toHaveBeenCalledTimes(1)
    expect(browser.newContext).toHaveBeenCalledTimes(1)
    expect(context.close).not.toHaveBeenCalled()
    expect(browser.close).toHaveBeenCalledTimes(1)
  })

  it('retries once after a goto failure: closes the failed context, creates a fresh one, succeeds', async () => {
    const failingPage = makePage({ goto: jest.fn().mockRejectedValue(new Error('Timeout 60000ms exceeded')) })
    const succeedingPage = makePage()
    const failingContext = makeContext(failingPage)
    const succeedingContext = makeContext(succeedingPage)
    const browser = makeBrowser([failingContext, succeedingContext])
    ;(chromium.launch as jest.Mock).mockResolvedValue(browser)

    const adapter = new TwoGisAdapter()
    const result = await adapter.fetchMentions(target)

    expect(result).toEqual([])
    expect(failingPage.goto).toHaveBeenCalledTimes(1)
    expect(succeedingPage.goto).toHaveBeenCalledTimes(1)
    expect(browser.newContext).toHaveBeenCalledTimes(2)
    expect(failingContext.close).toHaveBeenCalledTimes(1)
    expect(browser.close).toHaveBeenCalledTimes(1)
  })

  it('makes at most 2 goto attempts total (maxAttempts=2)', async () => {
    const page1 = makePage({ goto: jest.fn().mockRejectedValue(new Error('timeout')) })
    const page2 = makePage({ goto: jest.fn().mockRejectedValue(new Error('timeout')) })
    const context1 = makeContext(page1)
    const context2 = makeContext(page2)
    const browser = makeBrowser([context1, context2])
    ;(chromium.launch as jest.Mock).mockResolvedValue(browser)

    const adapter = new TwoGisAdapter()
    await expect(adapter.fetchMentions(target)).rejects.toThrow()

    expect(page1.goto).toHaveBeenCalledTimes(1)
    expect(page2.goto).toHaveBeenCalledTimes(1)
    expect(browser.newContext).toHaveBeenCalledTimes(2) // no 3rd attempt
  })

  it('throws a descriptive error when every goto attempt fails (does not silently return [])', async () => {
    const page1 = makePage({ goto: jest.fn().mockRejectedValue(new Error('timeout')) })
    const page2 = makePage({ goto: jest.fn().mockRejectedValue(new Error('timeout')) })
    const browser = makeBrowser([makeContext(page1), makeContext(page2)])
    ;(chromium.launch as jest.Mock).mockResolvedValue(browser)

    const adapter = new TwoGisAdapter()
    await expect(adapter.fetchMentions(target)).rejects.toThrow(/TWOGIS_NAVIGATION_FAILED/)

    // evaluate() must never run against a page that never finished navigating.
    expect(page2.evaluate).not.toHaveBeenCalled()
  })

  it('still closes the browser (no leak) even when every goto attempt fails', async () => {
    const page1 = makePage({ goto: jest.fn().mockRejectedValue(new Error('timeout')) })
    const page2 = makePage({ goto: jest.fn().mockRejectedValue(new Error('timeout')) })
    const browser = makeBrowser([makeContext(page1), makeContext(page2)])
    ;(chromium.launch as jest.Mock).mockResolvedValue(browser)

    const adapter = new TwoGisAdapter()
    await expect(adapter.fetchMentions(target)).rejects.toThrow()

    expect(browser.close).toHaveBeenCalledTimes(1)
  })

  it('still closes the browser (no leak) when an unrelated error is thrown after a successful goto', async () => {
    const page = makePage({ evaluate: jest.fn().mockRejectedValue(new Error('DOM extraction crashed')) })
    const context = makeContext(page)
    const browser = makeBrowser([context])
    ;(chromium.launch as jest.Mock).mockResolvedValue(browser)

    const adapter = new TwoGisAdapter()
    await expect(adapter.fetchMentions(target)).rejects.toThrow('DOM extraction crashed')

    expect(browser.close).toHaveBeenCalledTimes(1)
  })

  it('logs a warning but does not throw when closing the failed context itself fails', async () => {
    const failingPage = makePage({ goto: jest.fn().mockRejectedValue(new Error('timeout')) })
    const succeedingPage = makePage()
    const failingContext = makeContext(failingPage)
    failingContext.close = jest.fn().mockRejectedValue(new Error('context already gone'))
    const succeedingContext = makeContext(succeedingPage)
    const browser = makeBrowser([failingContext, succeedingContext])
    ;(chromium.launch as jest.Mock).mockResolvedValue(browser)
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    const adapter = new TwoGisAdapter()
    const result = await adapter.fetchMentions(target)

    expect(result).toEqual([])
    expect(warnSpy).toHaveBeenCalledWith(
      '[TWOGIS] failed to close context before retry',
      expect.objectContaining({ error: 'context already gone' })
    )
    warnSpy.mockRestore()
  })

  it('returns [] without throwing when the page is closed after a successful goto (pre-existing behavior, unaffected by the retry fix)', async () => {
    const page = makePage({ isClosed: jest.fn().mockReturnValue(true) })
    const context = makeContext(page)
    const browser = makeBrowser([context])
    ;(chromium.launch as jest.Mock).mockResolvedValue(browser)

    const adapter = new TwoGisAdapter()
    const result = await adapter.fetchMentions(target)

    expect(result).toEqual([])
    expect(page.evaluate).not.toHaveBeenCalled()
  })
})
