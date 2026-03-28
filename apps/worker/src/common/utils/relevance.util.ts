import { normalizeText } from './normalize.util'

export function computeVkRelevanceScore(params: {
  text: string
  companyName: string
  aliases: string[]
  normalizedQueries: string[]
  domain?: string | null
}) {
  const text = normalizeText(params.text)
  let score = 0

  if (text.includes(normalizeText(params.companyName))) score += 3

  for (const alias of params.aliases) {
    if (alias && text.includes(normalizeText(alias))) score += 2
  }

  for (const query of params.normalizedQueries) {
    if (query && text.includes(normalizeText(query))) score += 2
  }

  if (params.domain && text.includes(normalizeText(params.domain))) score += 2

  if (text.length < 12) score -= 2
  if (text.includes('скидка') || text.includes('реклама')) score -= 1

  return score
}

export function isVkRelevant(score: number) {
  return score >= 2
}
