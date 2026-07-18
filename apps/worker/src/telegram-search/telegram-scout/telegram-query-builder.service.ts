import { Injectable } from '@nestjs/common'
import type { CompanyAlias } from '@prisma/client'
import type { CompanyScoutInput, TelegramQuery, TelegramQueryClass, TelegramScoutBudgets } from './telegram-scout.types'

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y',
  ь: '', э: 'e', ю: 'yu', я: 'ya'
}

const CYRILLIC_RE = /[а-яё]/i

/** Deterministic single-variant transliteration — never a fuzzy/phonetic generator
 *  (plan explicitly forbids auto-generating many typo/phonetic variants). Only
 *  Cyrillic→Latin is implemented; Latin source names are left as-is. */
export function transliterateRuToLatin(value: string): string | null {
  if (!CYRILLIC_RE.test(value)) return null

  const result = value
    .toLowerCase()
    .split('')
    .map((ch) => (ch in CYRILLIC_TO_LATIN ? CYRILLIC_TO_LATIN[ch] : ch))
    .join('')
    .trim()

  return result || null
}

export function extractDomain(website?: string | null): string | null {
  if (!website) return null

  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`)
    return url.hostname.replace(/^www\./, '').toLowerCase() || null
  } catch {
    return null
  }
}

function dedupeQueries(queries: TelegramQuery[]): TelegramQuery[] {
  const seen = new Set<string>()
  const result: TelegramQuery[] = []

  for (const query of queries) {
    const key = query.text.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push({ ...query, text: query.text.trim() })
  }

  return result
}

@Injectable()
export class TelegramQueryBuilderService {
  build(input: CompanyScoutInput, budgets: TelegramScoutBudgets): TelegramQuery[] {
    const { company } = input
    const usableAliases = input.aliases
      .filter((alias) => !alias.isExcluded && alias.value.trim().length > 0)
      .sort((a, b) => a.priority - b.priority)

    const domain = extractDomain(company.website)

    const strong = this.buildStrong(company.name, domain, usableAliases, budgets.maxStrongQueries)
    const strongTexts = new Set(strong.map((q) => q.text.toLowerCase()))

    const remainingAfterStrong = usableAliases.filter((alias) => !strongTexts.has(alias.value.trim().toLowerCase()))

    const medium = this.buildMedium(strong, remainingAfterStrong, budgets.maxMediumQueries)
    const mediumTexts = new Set(medium.map((q) => q.text.toLowerCase()))

    const remainingAfterMedium = remainingAfterStrong.filter(
      (alias) => !mediumTexts.has(alias.value.trim().toLowerCase())
    )

    const weak = this.buildWeak(remainingAfterMedium, budgets.maxWeakQueries)

    const combined = dedupeQueries([...strong, ...medium, ...weak])
    return this.enforceTotalBudget(combined, budgets.maxQueriesPerCompany)
  }

  private buildStrong(
    name: string,
    domain: string | null,
    aliases: CompanyAlias[],
    max: number
  ): TelegramQuery[] {
    const candidates: TelegramQuery[] = []

    if (name?.trim()) candidates.push({ text: name.trim(), class: 'strong' })
    if (domain) candidates.push({ text: domain, class: 'strong' })

    for (const alias of aliases.filter((a) => a.isPrimary)) {
      candidates.push({ text: alias.value.trim(), class: 'strong' })
    }

    return dedupeQueries(candidates).slice(0, max)
  }

  private buildMedium(strong: TelegramQuery[], remainingAliases: CompanyAlias[], max: number): TelegramQuery[] {
    if (max <= 0) return []

    const candidates: TelegramQuery[] = []

    // Priority (non-primary, non-excluded) aliases — "короткое название"/"известный бренд".
    for (const alias of remainingAliases) {
      candidates.push({ text: alias.value.trim(), class: 'medium' })
    }

    // One transliteration of the strongest strong-class query, appended last so
    // real aliases take priority within the medium budget.
    const primaryStrong = strong[0]
    if (primaryStrong) {
      const translit = transliterateRuToLatin(primaryStrong.text)
      if (translit && translit.toLowerCase() !== primaryStrong.text.toLowerCase()) {
        candidates.push({ text: translit, class: 'medium' })
      }
    }

    return dedupeQueries(candidates).slice(0, max)
  }

  private buildWeak(remainingAliases: CompanyAlias[], max: number): TelegramQuery[] {
    if (max <= 0) return []

    return dedupeQueries(remainingAliases.map((alias) => ({ text: alias.value.trim(), class: 'weak' as TelegramQueryClass }))).slice(
      0,
      max
    )
  }

  private enforceTotalBudget(queries: TelegramQuery[], maxTotal: number): TelegramQuery[] {
    if (queries.length <= maxTotal) return queries

    // Trim weakest classes first while keeping insertion order within a class.
    const byClass: Record<TelegramQueryClass, TelegramQuery[]> = { strong: [], medium: [], weak: [] }
    for (const query of queries) byClass[query.class].push(query)

    const result: TelegramQuery[] = [...byClass.strong, ...byClass.medium, ...byClass.weak]
    return result.slice(0, maxTotal)
  }
}
