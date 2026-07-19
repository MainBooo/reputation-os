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

/** decision=NO/YES constrain which types are logically consistent with them —
 *  a "not related to the company" verdict paired with e.g. CUSTOMER_REVIEW (or
 *  vice versa) is a self-contradictory model response, not a valid content
 *  judgement. decision=UNSURE is deliberately unconstrained here. */
const NO_ONLY_TYPES = new Set(['IRRELEVANT', 'SPAM'])

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
  '- confidence: число от 0 до 1 — твоя уверенность именно в правильности выбранного type (а не в том, что название ' +
  'компании просто встретилось в тексте). Используй 1.0 только когда контекст практически однозначен. Если сообщение ' +
  'двусмысленное, упоминание вскользь, совпадение по формальному признаку (например название компании оказалось частью ' +
  'устойчивого выражения или чужого имени) — confidence должен быть заметно ниже 1.0. Простое текстовое совпадение ' +
  'названия/алиаса компании само по себе НЕ основание для confidence=1.0.\n' +
  '- shortReason: короткое обоснование по-русски (одно предложение)\n' +
  'Обязательное правило согласованности: если decision="NO", type должен быть "IRRELEVANT" или "SPAM". ' +
  'Если decision="YES", type НЕ может быть "IRRELEVANT" или "SPAM" — выбери подходящий из остальных шести. ' +
  'Официальные промо-посты сети/бренда — это "OWNED_PROMO", а не "CUSTOMER_REVIEW".'

const REPAIR_PROMPT =
  'Предыдущий ответ не прошёл машинную проверку. Верни только один валидный JSON-объект по указанной схеме, ' +
  'без markdown и пояснений.'

interface ChatMessage {
  role: string
  text: string
}

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

    const messages: ChatMessage[] = [
      { role: 'system', text: SYSTEM_PROMPT },
      { role: 'user', text: this.buildPrompt(input) }
    ]

    const first = await this.callAndParse(apiKey, folderId, model, messages)
    if (first.ok) return first

    // Network/transport failures and missing config are not fixable by a repair
    // prompt — retrying would just spend a second timeout for no benefit. Only
    // response-shape/content-validation failures get the one repair attempt.
    if (first.errorReason.startsWith('network_error') || first.errorReason === 'llm_not_configured') {
      return first
    }

    // At most one repair retry — never more than two LLM calls per message.
    const repairMessages: ChatMessage[] = [...messages, { role: 'user', text: REPAIR_PROMPT }]
    return this.callAndParse(apiKey, folderId, model, repairMessages)
  }

  private async callAndParse(apiKey: string, folderId: string, model: string, messages: ChatMessage[]): Promise<MessageClassifierResult> {
    let rawText: string
    try {
      const { data } = await axios.post(
        'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
        {
          modelUri: `gpt://${folderId}/${model}`,
          completionOptions: { stream: false, temperature: 0, maxTokens: 400 },
          messages
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
      `Точное текстовое совпадение с названием/алиасом компании: ${input.exactHit ? 'да' : 'нет'} (справочный сигнал, не решающий, сам по себе не основание для высокой confidence)`,
      `Текст сообщения: """${input.messageText.slice(0, 1500)}"""`
    ]
      .filter(Boolean)
      .join('\n')
  }
}

/** Locates the first balanced top-level {...} object in arbitrary text, aware of
 *  string literals (so braces inside string values never break the match). No
 *  eval(), no regex-only greedy matching that a trailing brace elsewhere in the
 *  text could corrupt — this is a plain depth-counting scan. */
function extractBalancedObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }

    if (ch === '{') {
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }

  return null
}

/** Extracts a JSON-object candidate from whatever shape the model returned:
 *  clean JSON, JSON inside a ```json fence, JSON inside a plain ``` fence, or a
 *  single JSON object surrounded by explanatory text. Returns null (never throws,
 *  never guesses) when no plausible object can be located. */
function extractJsonCandidate(rawText: string): string | null {
  const trimmed = rawText.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch) {
    const inner = fenceMatch[1].trim()
    if (inner.startsWith('{') && inner.endsWith('}')) return inner
    const balanced = extractBalancedObject(inner)
    if (balanced) return balanced
  }

  return extractBalancedObject(trimmed)
}

/** Strict validation of the classifier's JSON contract — any deviation (missing
 *  field, unknown enum value, non-numeric/out-of-range confidence, unparsable
 *  JSON, empty response, decision/type contradiction) is a technical failure,
 *  never a silently-guessed default. */
export function parseClassifierResponse(rawText: string): MessageClassifierResult {
  if (!rawText || !rawText.trim()) {
    return { ok: false, errorReason: 'empty_response' }
  }

  const candidate = extractJsonCandidate(rawText)
  if (!candidate) {
    return { ok: false, errorReason: 'no_json_found' }
  }

  let parsed: any
  try {
    parsed = JSON.parse(candidate)
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

  // decision/type consistency — a self-contradictory response is not corrected
  // silently, it is treated as a technical failure (triggers the repair retry).
  if (decision === 'NO' && !NO_ONLY_TYPES.has(type)) {
    return { ok: false, errorReason: `decision_type_mismatch:NO_with_${type}` }
  }
  if (decision === 'YES' && NO_ONLY_TYPES.has(type)) {
    return { ok: false, errorReason: `decision_type_mismatch:YES_with_${type}` }
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
