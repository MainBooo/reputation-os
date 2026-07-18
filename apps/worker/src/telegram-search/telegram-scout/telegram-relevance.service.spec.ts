import axios from 'axios'
import { TelegramRelevanceService } from './telegram-relevance.service'
import type { RelevanceContext, RelevanceInput } from './telegram-scout.types'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

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

function input(overrides: Partial<RelevanceInput> = {}): RelevanceInput {
  return {
    context: context(),
    messageText: 'Были вчера в Кофейне Ромашка на Тверской, очень понравилось',
    matchedQuery: 'Кофейня Ромашка',
    sourceTitle: 'Отзывы Москва',
    sourceUsername: 'moscow_reviews',
    isWeakQuery: false,
    ...overrides
  }
}

describe('TelegramRelevanceService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.YANDEX_GPT_API_KEY
    delete process.env.YANDEX_GPT_FOLDER_ID
  })

  it('returns YES via heuristic exact match without calling the LLM', async () => {
    const service = new TelegramRelevanceService()
    const result = await service.evaluate(input())

    expect(result.verdict).toBe('YES')
    expect(result.viaLlm).toBe(false)
    expect(mockedAxios.post).not.toHaveBeenCalled()
  })

  it('returns NO for a message with no matching signal at all, without calling the LLM', async () => {
    const service = new TelegramRelevanceService()
    const result = await service.evaluate(
      input({ messageText: 'Сегодня отличная погода, идём гулять в парк' })
    )

    expect(result.verdict).toBe('NO')
    expect(result.viaLlm).toBe(false)
    expect(mockedAxios.post).not.toHaveBeenCalled()
  })

  it('returns NO immediately when an excluded alias matches, never calling the LLM', async () => {
    const service = new TelegramRelevanceService()
    const result = await service.evaluate(
      input({
        context: context({ excludedTerms: ['Ромашка Клининг'] }),
        messageText: 'Ромашка Клининг делает уборку офисов, а не кофе'
      })
    )

    expect(result.verdict).toBe('NO')
    expect(result.reason).toBe('excluded_term_match')
    expect(mockedAxios.post).not.toHaveBeenCalled()
  })

  it('always calls the LLM for weak-class queries even with a strong heuristic match', async () => {
    process.env.YANDEX_GPT_API_KEY = 'key'
    process.env.YANDEX_GPT_FOLDER_ID = 'folder'
    mockedAxios.post.mockResolvedValue({
      data: {
        result: {
          alternatives: [
            {
              message: {
                text: JSON.stringify({
                  decision: 'YES',
                  score: 0.8,
                  reason: 'ok',
                  matchedEntity: 'Кофейня Ромашка',
                  topic: 'отзыв'
                })
              }
            }
          ]
        }
      }
    })

    const service = new TelegramRelevanceService()
    const result = await service.evaluate(input({ isWeakQuery: true }))

    expect(mockedAxios.post).toHaveBeenCalledTimes(1)
    expect(result.verdict).toBe('YES')
    expect(result.viaLlm).toBe(true)
  })

  it('sends the grey-zone message to the LLM and returns its decision', async () => {
    process.env.YANDEX_GPT_API_KEY = 'key'
    process.env.YANDEX_GPT_FOLDER_ID = 'folder'
    mockedAxios.post.mockResolvedValue({
      data: {
        result: {
          alternatives: [
            {
              message: {
                text: JSON.stringify({
                  decision: 'NO',
                  score: 0.2,
                  reason: 'другая компания',
                  matchedEntity: '',
                  topic: 'ромашка аптека'
                })
              }
            }
          ]
        }
      }
    })

    const service = new TelegramRelevanceService()
    // Only token overlap (weak city-only signal), not an exact name/domain/alias hit — grey zone.
    const result = await service.evaluate(
      input({
        context: context({ aliases: ['Ромашка'], primaryAliases: [] }),
        messageText: 'В Москве открылась ромашка, но это аптечная сеть'
      })
    )

    expect(mockedAxios.post).toHaveBeenCalledTimes(1)
    expect(result.verdict).toBe('NO')
  })

  it('treats invalid LLM JSON as UNSURE without throwing', async () => {
    process.env.YANDEX_GPT_API_KEY = 'key'
    process.env.YANDEX_GPT_FOLDER_ID = 'folder'
    mockedAxios.post.mockResolvedValue({
      data: { result: { alternatives: [{ message: { text: 'not json at all' } }] } }
    })

    const service = new TelegramRelevanceService()
    const result = await service.evaluate(
      input({
        context: context({ aliases: ['Ромашка'], primaryAliases: [] }),
        messageText: 'В Москве открылась ромашка, но это аптечная сеть'
      })
    )

    expect(result.verdict).toBe('UNSURE')
  })

  it('treats an LLM/network failure as UNSURE without throwing', async () => {
    process.env.YANDEX_GPT_API_KEY = 'key'
    process.env.YANDEX_GPT_FOLDER_ID = 'folder'
    mockedAxios.post.mockRejectedValue(new Error('timeout'))

    const service = new TelegramRelevanceService()
    const result = await service.evaluate(
      input({
        context: context({ aliases: ['Ромашка'], primaryAliases: [] }),
        messageText: 'В Москве открылась ромашка, но это аптечная сеть'
      })
    )

    expect(result.verdict).toBe('UNSURE')
  })

  it('treats a missing LLM configuration as UNSURE for grey-zone messages', async () => {
    const service = new TelegramRelevanceService()
    const result = await service.evaluate(
      input({
        context: context({ aliases: ['Ромашка'], primaryAliases: [] }),
        messageText: 'В Москве открылась ромашка, но это аптечная сеть'
      })
    )

    expect(result.verdict).toBe('UNSURE')
    expect(mockedAxios.post).not.toHaveBeenCalled()
  })
})
