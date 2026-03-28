export function classifySentiment(text: string): 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'UNKNOWN' {
  const positive = ['отлично', 'хорошо', 'супер', 'рекомендую', 'great', 'good', 'excellent']
  const negative = ['плохо', 'ужасно', 'не рекомендую', 'bad', 'terrible', 'awful', 'мошенники']

  if (!text.trim()) return 'UNKNOWN'
  if (negative.some((word) => text.includes(word))) return 'NEGATIVE'
  if (positive.some((word) => text.includes(word))) return 'POSITIVE'
  return 'NEUTRAL'
}
