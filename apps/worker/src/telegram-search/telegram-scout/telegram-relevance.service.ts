import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import type { RelevanceContext, RelevanceInput, RelevanceLlmResponse, RelevanceResult } from './telegram-scout.types'

const MIN_EXACT_MATCH_LEN = 4
const HARD_ACCEPT_SCORE = 10
// Only a literal zero-signal message (no token/city overlap at all) skips the LLM as
// an automatic NO — anything above that is genuinely ambiguous and goes to the LLM,
// since Russian inflection already makes exact-substring signals unreliable on their own.
const HARD_REJECT_SCORE = 0

/** Local, punctuation-stripping normalizer — deliberately stricter than the
 *  shared common/utils normalizeText (which only lowercases/collapses whitespace)
 *  because exact-substring matching against Telegram message text needs to survive
 *  punctuation noise the way apps/worker's WEB relevance scoring already does. */
function normalize(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(' ')
    .filter((token) => token.length >= 3)
}

interface HeuristicScore {
  score: number
  reasons: string[]
  exactHit: boolean
  excludedHit: boolean
}

@Injectable()
export class TelegramRelevanceService {
  private readonly logger = new Logger(TelegramRelevanceService.name)

  async evaluate(input: RelevanceInput): Promise<RelevanceResult> {
    const normalizedText = normalize(input.messageText)
    const heuristic = this.score(normalizedText, input.context)

    // Excluded terms are a hard suppressor — never confirmed, never sent to LLM.
    if (heuristic.excludedHit) {
      return {
        verdict: 'NO',
        score: 0,
        reason: 'excluded_term_match',
        viaLlm: false
      }
    }

    // Weak-class matches always require LLM confirmation regardless of heuristic strength.
    if (!input.isWeakQuery) {
      // An exact hit (full name / domain / primary alias substring) is decisive on its
      // own — Russian inflection means the surrounding token score is often low even
      // when the exact hit is a genuine, unambiguous match.
      if (heuristic.exactHit) {
        return {
          verdict: 'YES',
          score: Math.max(heuristic.score, HARD_ACCEPT_SCORE),
          reason: heuristic.reasons.join(','),
          matchedEntity: input.context.companyName,
          viaLlm: false
        }
      }

      if (heuristic.score <= HARD_REJECT_SCORE) {
        return {
          verdict: 'NO',
          score: heuristic.score,
          reason: heuristic.reasons.join(',') || 'no_signal',
          viaLlm: false
        }
      }
    }

    // Grey zone (or forced by weak-class query) — ask the LLM, treat any failure as UNSURE.
    const llmResult = await this.llmRelevanceCheck(input)

    if (!llmResult) {
      return {
        verdict: 'UNSURE',
        score: heuristic.score,
        reason: 'llm_unavailable_or_invalid',
        viaLlm: true
      }
    }

    return {
      verdict: llmResult.decision,
      score: llmResult.score,
      reason: llmResult.reason,
      matchedEntity: llmResult.matchedEntity,
      topic: llmResult.topic,
      viaLlm: true
    }
  }

  private score(normalizedText: string, context: RelevanceContext): HeuristicScore {
    const reasons: string[] = []
    let score = 0

    const excludedHit = context.excludedTerms.some((term) => {
      const normalizedTerm = normalize(term)
      return normalizedTerm.length >= MIN_EXACT_MATCH_LEN && normalizedText.includes(normalizedTerm)
    })

    const normalizedName = normalize(context.companyName)
    const exactNameHit = normalizedName.length >= MIN_EXACT_MATCH_LEN && normalizedText.includes(normalizedName)
    if (exactNameHit) {
      score += 8
      reasons.push('exact_name')
    }

    const exactDomainHit = Boolean(context.domain) && normalizedText.includes(context.domain!.toLowerCase())
    if (exactDomainHit) {
      score += 8
      reasons.push('exact_domain')
    }

    const exactPrimaryAliasHit = context.primaryAliases.some((alias) => {
      const normalizedAlias = normalize(alias)
      return normalizedAlias.length >= MIN_EXACT_MATCH_LEN && normalizedText.includes(normalizedAlias)
    })
    if (exactPrimaryAliasHit) {
      score += 6
      reasons.push('exact_primary_alias')
    }

    const nameTokens = Array.from(
      new Set([...tokenize(context.companyName), ...context.aliases.flatMap((alias) => tokenize(alias))])
    )

    let tokenHits = 0
    for (const token of nameTokens) {
      if (normalizedText.includes(token)) tokenHits++
    }
    if (tokenHits > 0) {
      score += Math.min(tokenHits, 3) * 2
      reasons.push(`tokens:${tokenHits}`)
    }

    if (context.city) {
      const normalizedCity = normalize(context.city)
      if (normalizedCity.length >= 3 && normalizedText.includes(normalizedCity)) {
        score += 2
        reasons.push('city')
      }
    }

    return {
      score,
      reasons,
      exactHit: exactNameHit || exactDomainHit || exactPrimaryAliasHit,
      excludedHit
    }
  }

  private async llmRelevanceCheck(input: RelevanceInput): Promise<RelevanceLlmResponse | null> {
    const apiKey = process.env.YANDEX_GPT_API_KEY
    const folderId = process.env.YANDEX_GPT_FOLDER_ID
    const model = process.env.YANDEX_GPT_MODEL || 'yandexgpt-lite'

    if (!apiKey || !folderId) return null

    const { context } = input
    const prompt = [
      `Компания: "${context.companyName}"`,
      context.domain ? `Домен: "${context.domain}"` : null,
      context.aliases.length ? `Алиасы/бренды: ${context.aliases.join(', ')}` : null,
      context.excludedTerms.length ? `Исключающие слова (НЕ относятся к компании): ${context.excludedTerms.join(', ')}` : null,
      `Поисковый запрос, по которому найдено сообщение: "${input.matchedQuery}"`,
      input.sourceTitle ? `Канал/группа: "${input.sourceTitle}"` : null,
      input.sourceUsername ? `Username источника: @${input.sourceUsername}` : null,
      `Текст сообщения: """${input.messageText.slice(0, 1500)}"""`
    ]
      .filter(Boolean)
      .join('\n')

    try {
      const { data } = await axios.post(
        'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
        {
          modelUri: `gpt://${folderId}/${model}`,
          completionOptions: { stream: false, temperature: 0, maxTokens: 300 },
          messages: [
            {
              role: 'system',
              text:
                'Ты система фильтрации упоминаний компании в Telegram. Отвечай СТРОГО валидным JSON без markdown-разметки, ' +
                'ровно с полями: decision ("YES"|"NO"|"UNSURE"), score (число 0..1), reason (краткая причина по-русски), ' +
                'matchedEntity (что именно относится к компании), topic (тема сообщения). ' +
                'YES — сообщение про именно эту компанию. NO — про другую компанию/сущность или случайное совпадение слов. ' +
                'UNSURE — невозможно достоверно определить.'
            },
            {
              role: 'user',
              text: `Это сообщение упоминает именно эту компанию?\n\n${prompt}`
            }
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

      const rawText: string = data?.result?.alternatives?.[0]?.message?.text?.trim() || ''
      return this.parseLlmJson(rawText)
    } catch (error: any) {
      this.logger.warn(`LLM relevance check failed: ${error?.message}`)
      return null
    }
  }

  private parseLlmJson(rawText: string): RelevanceLlmResponse | null {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    try {
      const parsed = JSON.parse(jsonMatch[0])
      const decision = String(parsed.decision || '').toUpperCase()

      if (decision !== 'YES' && decision !== 'NO' && decision !== 'UNSURE') return null

      const score = Number(parsed.score)

      return {
        decision: decision as RelevanceLlmResponse['decision'],
        score: Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0,
        reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 300) : '',
        matchedEntity: typeof parsed.matchedEntity === 'string' ? parsed.matchedEntity.slice(0, 200) : '',
        topic: typeof parsed.topic === 'string' ? parsed.topic.slice(0, 200) : ''
      }
    } catch {
      return null
    }
  }
}
