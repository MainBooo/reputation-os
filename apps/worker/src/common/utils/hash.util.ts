import { createHash } from 'crypto'

export function buildMentionHash(params: {
  sourceId: string
  url?: string | null
  normalizedText: string
  publishedAt: Date
}) {
  const day = params.publishedAt.toISOString().slice(0, 10)
  return createHash('sha256')
    .update(`${params.sourceId}|${params.url || ''}|${params.normalizedText}|${day}`)
    .digest('hex')
}
