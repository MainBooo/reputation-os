import { TelegramRelevanceService } from './telegram-relevance.service'
import type { RelevanceContext } from './telegram-scout.types'

function context(overrides: Partial<RelevanceContext> = {}): RelevanceContext {
  return {
    companyName: 'Кофейня Ромашка',
    normalizedCompanyName: 'кофейня ромашка',
    website: 'https://romashka-coffee.ru',
    domain: 'romashka-coffee.ru',
    aliases: ['Ромашка'],
    primaryAliases: ['Ромашка'],
    excludedTerms: [],
    city: 'Москва',
    industry: 'кофейня',
    ...overrides
  }
}

describe('TelegramRelevanceService.preFilter', () => {
  it('passes an exact-name hit but does not decide relevance on its own (exactHit is contextual only)', () => {
    const service = new TelegramRelevanceService()
    const result = service.preFilter('Были вчера в Кофейне Ромашка на Тверской, очень понравилось', context(), false)

    expect(result.passesPreFilter).toBe(true)
    expect(result.exactHit).toBe(true)
  })

  it('rejects a message with no matching signal at all', () => {
    const service = new TelegramRelevanceService()
    const result = service.preFilter('Сегодня отличная погода, идём гулять в парк', context(), false)

    expect(result.passesPreFilter).toBe(false)
    expect(result.hardRejectReason).toBeDefined()
    expect(result.exactHit).toBe(false)
  })

  it('rejects immediately when an excluded alias matches', () => {
    const service = new TelegramRelevanceService()
    const result = service.preFilter(
      'Ромашка Клининг делает уборку офисов, а не кофе',
      context({ excludedTerms: ['Ромашка Клининг'] }),
      false
    )

    expect(result.passesPreFilter).toBe(false)
    expect(result.hardRejectReason).toBe('excluded_term_match')
  })

  it('always passes weak-class queries through to the classifier regardless of heuristic score', () => {
    const service = new TelegramRelevanceService()
    const result = service.preFilter('Сегодня отличная погода, идём гулять в парк', context(), true)

    expect(result.passesPreFilter).toBe(true)
  })

  it('passes a grey-zone message (partial token overlap, no exact hit) through to the classifier', () => {
    const service = new TelegramRelevanceService()
    const result = service.preFilter(
      'В Москве открылась ромашка, но это аптечная сеть',
      context({ aliases: ['Ромашка'], primaryAliases: [] }),
      false
    )

    expect(result.passesPreFilter).toBe(true)
    expect(result.exactHit).toBe(false)
  })

  it('reports the heuristic score and reasons regardless of pass/reject outcome', () => {
    const service = new TelegramRelevanceService()
    const result = service.preFilter('Были в Кофейне Ромашка', context(), false)

    expect(result.heuristicScore).toBeGreaterThan(0)
    expect(result.heuristicReasons.length).toBeGreaterThan(0)
  })
})
