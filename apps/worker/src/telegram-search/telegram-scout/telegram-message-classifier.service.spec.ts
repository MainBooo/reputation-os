import axios from 'axios'
import { parseClassifierResponse, TelegramMessageClassifierService } from './telegram-message-classifier.service'
import type { MessageClassifierInput, RelevanceContext } from './telegram-scout.types'

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

function input(overrides: Partial<MessageClassifierInput> = {}): MessageClassifierInput {
  return {
    context: context(),
    messageText: 'Были вчера в Кофейне Ромашка, очень понравилось',
    matchedQuery: 'Кофейня Ромашка',
    channelTitle: 'Отзывы Москва',
    channelUsername: 'moscow_reviews',
    entityType: 'channel',
    channelClassification: null,
    exactHit: true,
    ...overrides
  }
}

function mockLlmText(text: string) {
  mockedAxios.post.mockResolvedValue({
    data: { result: { alternatives: [{ message: { text } }] } }
  })
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    decision: 'YES',
    type: 'CUSTOMER_REVIEW',
    sentiment: 'POSITIVE',
    urgency: 'LOW',
    confidence: 0.95,
    shortReason: 'Положительный отзыв клиента',
    ...overrides
  }
}

describe('TelegramMessageClassifierService.classify', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.YANDEX_GPT_API_KEY = 'key'
    process.env.YANDEX_GPT_FOLDER_ID = 'folder'
  })

  afterEach(() => {
    delete process.env.YANDEX_GPT_API_KEY
    delete process.env.YANDEX_GPT_FOLDER_ID
  })

  it('classifies an official promo post as OWNED_PROMO', async () => {
    mockLlmText(JSON.stringify(validPayload({ type: 'OWNED_PROMO', decision: 'YES', shortReason: 'Промо-пост сети' })))
    const service = new TelegramMessageClassifierService()
    const result = await service.classify(input())

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.type).toBe('OWNED_PROMO')
  })

  it('classifies an angry message as CUSTOMER_COMPLAINT with negative sentiment and high urgency', async () => {
    mockLlmText(
      JSON.stringify(
        validPayload({ type: 'CUSTOMER_COMPLAINT', sentiment: 'NEGATIVE', urgency: 'HIGH', shortReason: 'Жалоба на обслуживание' })
      )
    )
    const service = new TelegramMessageClassifierService()
    const result = await service.classify(input())

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.type).toBe('CUSTOMER_COMPLAINT')
      expect(result.sentiment).toBe('NEGATIVE')
      expect(result.urgency).toBe('HIGH')
    }
  })

  it('classifies a question as CUSTOMER_QUESTION', async () => {
    mockLlmText(JSON.stringify(validPayload({ type: 'CUSTOMER_QUESTION', shortReason: 'Вопрос про часы работы' })))
    const service = new TelegramMessageClassifierService()
    const result = await service.classify(input())

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.type).toBe('CUSTOMER_QUESTION')
  })

  it('classifies unrelated chat banter as CHAT_DISCUSSION', async () => {
    mockLlmText(JSON.stringify(validPayload({ type: 'CHAT_DISCUSSION', decision: 'UNSURE', shortReason: 'Обсуждение в чате' })))
    const service = new TelegramMessageClassifierService()
    const result = await service.classify(input())

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.type).toBe('CHAT_DISCUSSION')
  })

  it('classifies a press mention as NEWS_MENTION', async () => {
    mockLlmText(JSON.stringify(validPayload({ type: 'NEWS_MENTION', shortReason: 'Упоминание в новости' })))
    const service = new TelegramMessageClassifierService()
    const result = await service.classify(input())

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.type).toBe('NEWS_MENTION')
  })

  it('classifies an off-topic message as IRRELEVANT', async () => {
    mockLlmText(JSON.stringify(validPayload({ type: 'IRRELEVANT', decision: 'NO', shortReason: 'Не относится к компании' })))
    const service = new TelegramMessageClassifierService()
    const result = await service.classify(input())

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.type).toBe('IRRELEVANT')
      expect(result.decision).toBe('NO')
    }
  })

  it('classifies an unrelated ad as SPAM', async () => {
    mockLlmText(JSON.stringify(validPayload({ type: 'SPAM', decision: 'NO', shortReason: 'Спам-реклама постороннего' })))
    const service = new TelegramMessageClassifierService()
    const result = await service.classify(input())

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.type).toBe('SPAM')
  })

  it('returns a low-confidence result as-is (routing decides review, not the classifier)', async () => {
    mockLlmText(JSON.stringify(validPayload({ confidence: 0.4, shortReason: 'Неуверенная классификация' })))
    const service = new TelegramMessageClassifierService()
    const result = await service.classify(input())

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.confidence).toBe(0.4)
  })

  it('treats invalid JSON from YandexGPT as a technical failure, never throwing', async () => {
    mockLlmText('not json at all')
    const service = new TelegramMessageClassifierService()
    const result = await service.classify(input())

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errorReason).toBe('no_json_found')
  })

  it('treats a network error/timeout as a technical failure, never throwing', async () => {
    mockedAxios.post.mockRejectedValue(new Error('timeout of 8000ms exceeded'))
    const service = new TelegramMessageClassifierService()
    const result = await service.classify(input())

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errorReason).toContain('network_error')
  })

  it('never sends author name, username, or authorExternalId in the prompt', async () => {
    mockLlmText(JSON.stringify(validPayload()))
    const service = new TelegramMessageClassifierService()
    await service.classify(input())

    const [, body] = mockedAxios.post.mock.calls[0]
    const promptText = JSON.stringify(body)
    expect(promptText).not.toMatch(/authorName|authorExternalId/)
  })
})

describe('parseClassifierResponse — strict contract validation', () => {
  it('accepts a fully valid payload', () => {
    const result = parseClassifierResponse(JSON.stringify(validPayload()))
    expect(result.ok).toBe(true)
  })

  it('rejects an empty response as a technical failure', () => {
    const result = parseClassifierResponse('')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errorReason).toBe('empty_response')
  })

  it('rejects malformed JSON as a technical failure', () => {
    const result = parseClassifierResponse('{decision: YES, not valid json')
    expect(result.ok).toBe(false)
  })

  it('rejects confidence out of [0,1] range', () => {
    const result = parseClassifierResponse(JSON.stringify(validPayload({ confidence: 1.5 })))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errorReason).toBe('confidence_out_of_range')
  })

  it('rejects a negative confidence', () => {
    const result = parseClassifierResponse(JSON.stringify(validPayload({ confidence: -0.1 })))
    expect(result.ok).toBe(false)
  })

  it('rejects confidence sent as a string instead of a number', () => {
    const result = parseClassifierResponse(JSON.stringify(validPayload({ confidence: '0.9' })))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errorReason).toBe('invalid_confidence')
  })

  it('rejects NaN confidence', () => {
    // JSON has no NaN literal — this simulates a model that emits an unquoted NaN,
    // which JSON.parse itself rejects as invalid syntax.
    const result = parseClassifierResponse('{"decision":"YES","type":"CUSTOMER_REVIEW","sentiment":"POSITIVE","urgency":"LOW","confidence":NaN,"shortReason":"x"}')
    expect(result.ok).toBe(false)
  })

  it('rejects an unknown type value', () => {
    const result = parseClassifierResponse(JSON.stringify(validPayload({ type: 'UNKNOWN_TYPE' })))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errorReason).toContain('invalid_type')
  })

  it('rejects an unknown sentiment value', () => {
    const result = parseClassifierResponse(JSON.stringify(validPayload({ sentiment: 'MEH' })))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errorReason).toContain('invalid_sentiment')
  })

  it('rejects an unknown urgency value', () => {
    const result = parseClassifierResponse(JSON.stringify(validPayload({ urgency: 'CRITICAL' })))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errorReason).toContain('invalid_urgency')
  })

  it('rejects an unknown decision value', () => {
    const result = parseClassifierResponse(JSON.stringify(validPayload({ decision: 'MAYBE' })))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errorReason).toContain('invalid_decision')
  })

  it('rejects an empty shortReason instead of silently accepting it', () => {
    const result = parseClassifierResponse(JSON.stringify(validPayload({ shortReason: '' })))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errorReason).toBe('empty_short_reason')
  })

  it('rejects a response missing required fields rather than defaulting them', () => {
    const result = parseClassifierResponse(JSON.stringify({ decision: 'YES' }))
    expect(result.ok).toBe(false)
  })
})
