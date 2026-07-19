import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import type {
  MessageClassificationType,
  MessageClassifierDecision,
  MessageClassifierInput,
  MessageClassifierResult,
  MessageSentimentValue,
  MessageUrgencyValue
} from './telegram-scout.types'

const ALLOWED_DECISIONS = new Set(['YES', 'NO', 'UNSURE'])
const ALLOWED_TYPES = new Set([
  'OWNED_PROMO',
  'CUSTOMER_REVIEW',
  'CUSTOMER_COMPLAINT',
  'CUSTOMER_QUESTION',
  'CHAT_DISCUSSION',
  'NEWS_MENTION',
  'IRRELEVANT',
  'SPAM'
])
const ALLOWED_SENTIMENTS = new Set(['POSITIVE', 'NEUTRAL', 'NEGATIVE'])
const ALLOWED_URGENCY = new Set(['LOW', 'MEDIUM', 'HIGH'])

const SYSTEM_PROMPT =
  'Ты — система смысловой классификации сообщений в Telegram для сервиса управления репутацией компаний. ' +
  'Тебе НЕ передаются данные автора сообщения (имя, username) — классифицируй только по содержанию и контексту канала. ' +
  'Отвечай СТРОГО валидным JSON без markdown-разметки, ровно с полями:\n' +
  '- decision: "YES" (сообщение относится к компании), "NO" (не относится) или "UNSURE" (невозможно достоверно определить)\n' +
  '- type: один из "OWNED_PROMO" (промо-пост официального канала/сети), "CUSTOMER_REVIEW" (отзыв клиента), ' +
  '"CUSTOMER_COMPLAINT" (жалоба клиента), "CUSTOMER_QUESTION" (вопрос клиента), "CHAT_DISCUSSION" (обсуждение в чате/группе), ' +
  '"NEWS_MENTION" (упоминание в новости/статье), "IRRELEVANT" (не относится к компании), "SPAM" (спам/реклама постороннего)\n' +
  '- sentiment: "POSITIVE", "NEUTRAL" или "NEGATIVE"\n' +
  '- urgency: "LOW", "MEDIUM" или "HIGH" (насколько срочно требуется реакция компании)\n' +
  '- confidence: число от 0 до 1 (уверенность в классификации)\n' +
  '- shortReason: короткое обоснование по-русски (одно предложение)\n' +
  'Если decision="NO", всё равно укажи наиболее подходящий type (обычно "IRRELEVANT"). ' +
  'Официальные промо-посты сети/бренда — это "OWNED_PROMO", а не "CUSTOMER_REVIEW".'

@Injectable()
export class TelegramMessageClassifierService {
  private readonly logger = new Logger(TelegramMessageClassifierService.name)

  async classify(input: MessageClassifierInput): Promise<MessageClassifierResult> {
    const apiKey = process.env.YANDEX_GPT_API_KEY
    const folderId = process.env.YANDEX_GPT_FOLDER_ID
    const model = process.env.YANDEX_GPT_MODEL || 'yandexgpt-lite'

    if (!apiKey || !folderId) {
      return { ok: false, errorReason: 'llm_not_configured' }
    }

    const prompt = this.buildPrompt(input)

    let rawText: string
    try {
      const { data } = await axios.post(
        'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
        {
          modelUri: `gpt://${folderId}/${model}`,
          completionOptions: { stream: false, temperature: 0, maxTokens: 400 },
          messages: [
            { role: 'system', text: SYSTEM_PROMPT },
            { role: 'user', text: prompt }
          ]
        },
        {
          headers: {
            Authorization: `Api-Key ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 8000
        }
      )

      rawText = data?.result?.alternatives?.[0]?.message?.text?.trim() || ''
    } catch (error: any) {
      const message = error?.message ?? 'unknown'
      this.logger.warn(`Message classifier LLM call failed: ${message}`)
      return { ok: false, errorReason: `network_error:${message}`.slice(0, 300) }
    }

    return parseClassifierResponse(rawText)
  }

  private buildPrompt(input: MessageClassifierInput): string {
    const { context } = input

    return [
      `Компания: "${context.companyName}"`,
      context.aliases.length ? `Алиасы/бренды: ${context.aliases.join(', ')}` : null,
      context.excludedTerms.length ? `Исключающие названия (НЕ относятся к компании): ${context.excludedTerms.join(', ')}` : null,
      `Поисковый запрос, по которому найдено сообщение: "${input.matchedQuery}"`,
      input.channelTitle ? `Канал/группа: "${input.channelTitle}"` : null,
      input.channelUsername ? `Username канала: @${input.channelUsername}` : null,
      `Тип источника: ${input.entityType}`,
      input.channelClassification ? `Классификация канала: ${input.channelClassification}` : null,
      `Точное текстовое совпадение с названием/алиасом компании: ${input.exactHit ? 'да' : 'нет'} (справочный сигнал, не решающий)`,
      `Текст сообщения: """${input.messageText.slice(0, 1500)}"""`
    ]
      .filter(Boolean)
      .join('\n')
  }
}

/** Strict validation of the classifier's JSON contract — any deviation (missing
 *  field, unknown enum value, non-numeric/out-of-range confidence, unparsable
 *  JSON, empty response) is a technical failure, never a silently-guessed default. */
export function parseClassifierResponse(rawText: string): MessageClassifierResult {
  if (!rawText || !rawText.trim()) {
    return { ok: false, errorReason: 'empty_response' }
  }

  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { ok: false, errorReason: 'no_json_found' }
  }

  let parsed: any
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return { ok: false, errorReason: 'invalid_json' }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, errorReason: 'invalid_json_shape' }
  }

  const decision = String(parsed.decision ?? '').toUpperCase()
  if (!ALLOWED_DECISIONS.has(decision)) {
    return { ok: false, errorReason: `invalid_decision:${decision || 'missing'}` }
  }

  const type = String(parsed.type ?? '').toUpperCase()
  if (!ALLOWED_TYPES.has(type)) {
    return { ok: false, errorReason: `invalid_type:${type || 'missing'}` }
  }

  const sentiment = String(parsed.sentiment ?? '').toUpperCase()
  if (!ALLOWED_SENTIMENTS.has(sentiment)) {
    return { ok: false, errorReason: `invalid_sentiment:${sentiment || 'missing'}` }
  }

  const urgency = String(parsed.urgency ?? '').toUpperCase()
  if (!ALLOWED_URGENCY.has(urgency)) {
    return { ok: false, errorReason: `invalid_urgency:${urgency || 'missing'}` }
  }

  // typeof guard is deliberate — a stringified "0.9" must be rejected, not coerced.
  if (typeof parsed.confidence !== 'number' || !Number.isFinite(parsed.confidence)) {
    return { ok: false, errorReason: 'invalid_confidence' }
  }
  if (parsed.confidence < 0 || parsed.confidence > 1) {
    return { ok: false, errorReason: 'confidence_out_of_range' }
  }

  const shortReason = typeof parsed.shortReason === 'string' ? parsed.shortReason.trim() : ''
  if (!shortReason) {
    return { ok: false, errorReason: 'empty_short_reason' }
  }

  return {
    ok: true,
    decision: decision as MessageClassifierDecision,
    type: type as MessageClassificationType,
    sentiment: sentiment as MessageSentimentValue,
    urgency: urgency as MessageUrgencyValue,
    confidence: parsed.confidence,
    shortReason: shortReason.slice(0, 300)
  }
}
