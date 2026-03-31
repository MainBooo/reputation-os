import { Injectable } from '@nestjs/common'

export type VkCompanySearchProfile = {
  includeKeywords?: string[]
  excludeKeywords?: string[]
  contextKeywords?: string[]
  geoKeywords?: string[]
  category?: string | null
}

@Injectable()
export class VkRelevanceService {
  private normalize(value: string): string {
    return value.toLowerCase().replace(/\s+/g, ' ').trim()
  }

  private uniq(values: Array<string | null | undefined>): string[] {
    return Array.from(
      new Set(
        values
          .map((v) => String(v || '').trim())
          .filter(Boolean)
      )
    )
  }

  score(text: string, aliases: string[], profile: VkCompanySearchProfile) {
    const source = this.normalize(text || '')
    let score = 0

    if (!source) {
      return { score: 0, decision: 'IRRELEVANT' as const }
    }

    const aliasList = this.uniq(aliases)
    const includeKeywords = this.uniq(profile.includeKeywords || [])
    const excludeKeywords = this.uniq(profile.excludeKeywords || [])
    const contextKeywords = this.uniq(profile.contextKeywords || [])
    const geoKeywords = this.uniq(profile.geoKeywords || [])

    for (const alias of aliasList) {
      const normalized = this.normalize(alias)
      if (!normalized) continue

      if (source === normalized) score += 40
      else if (source.includes(normalized)) score += 30
      else {
        const compactSource = source.replace(/[^a-zа-яё0-9]/gi, '')
        const compactAlias = normalized.replace(/[^a-zа-яё0-9]/gi, '')
        if (compactAlias && compactSource.includes(compactAlias)) score += 15
      }
    }

    for (const keyword of includeKeywords) {
      if (source.includes(this.normalize(keyword))) score += 10
    }

    for (const keyword of contextKeywords) {
      if (source.includes(this.normalize(keyword))) score += 20
    }

    for (const keyword of geoKeywords) {
      if (source.includes(this.normalize(keyword))) score += 10
    }

    for (const keyword of excludeKeywords) {
      if (source.includes(this.normalize(keyword))) score -= 20
    }

    if (source.length < 20) score -= 15

    const decision =
      score >= 70 ? 'RELEVANT'
      : score >= 40 ? 'MAYBE'
      : 'IRRELEVANT'

    return { score, decision }
  }
}
