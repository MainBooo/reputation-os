import { Injectable } from '@nestjs/common'
import { Sentiment } from '@prisma/client'

@Injectable()
export class SentimentService {
  detect(text: string): Sentiment {
    const t = text.toLowerCase()

    if (t.includes('ужас') || t.includes('плохо')) return 'NEGATIVE'
    if (t.includes('круто') || t.includes('отлично')) return 'POSITIVE'

    return 'NEUTRAL'
  }
}
