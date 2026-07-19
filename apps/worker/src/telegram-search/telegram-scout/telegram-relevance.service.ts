import { Injectable } from '@nestjs/common'
import type { HeuristicPreFilterResult, RelevanceContext } from './telegram-scout.types'

const MIN_EXACT_MATCH_LEN = 4
// Only a literal zero-signal message (no token/city overlap at all) is rejected here
// as noise — anything above that, including a plain exact-name hit, must go through
// TelegramMessageClassifierService (plan §"Архитектурное решение").
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

/** Pure, LLM-free structural pre-filter for Telegram messages. This is not a
 *  content decision — it only screens out messages with an excluded-term hit or
 *  literally zero token/city overlap. Everything that passes still goes through
 *  the meaning classifier (TelegramMessageClassifierService). */
@Injectable()
export class TelegramRelevanceService {
  preFilter(messageText: string, context: RelevanceContext, isWeakQuery: boolean): HeuristicPreFilterResult {
    const normalizedText = normalize(messageText)
    const heuristic = this.score(normalizedText, context)

    if (heuristic.excludedHit) {
      return {
        passesPreFilter: false,
        hardRejectReason: 'excluded_term_match',
        exactHit: heuristic.exactHit,
        heuristicScore: heuristic.score,
        heuristicReasons: heuristic.reasons
      }
    }

    // Weak-class matches always require classifier confirmation regardless of heuristic strength.
    if (!isWeakQuery && heuristic.score <= HARD_REJECT_SCORE) {
      return {
        passesPreFilter: false,
        hardRejectReason: heuristic.reasons.join(',') || 'no_signal',
        exactHit: heuristic.exactHit,
        heuristicScore: heuristic.score,
        heuristicReasons: heuristic.reasons
      }
    }

    return {
      passesPreFilter: true,
      exactHit: heuristic.exactHit,
      heuristicScore: heuristic.score,
      heuristicReasons: heuristic.reasons
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
}
