import { createHash } from 'crypto'
import { normalizeText, normalizeUrl } from './normalize'

export function buildMentionHash(input: {
  source: string
  url?: string | null
  normalizedText?: string | null
  date: Date | string
}): string {
  const date = typeof input.date === 'string' ? input.date : input.date.toISOString().slice(0, 10)
  return createHash('sha256')
    .update(`${input.source}|${normalizeUrl(input.url)}|${normalizeText(input.normalizedText)}|${date}`)
    .digest('hex')
}
