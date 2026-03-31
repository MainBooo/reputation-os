import { Injectable } from '@nestjs/common'

@Injectable()
export class RelevanceService {
  score(text: string, profile: any) {
    let score = 0
    const t = text.toLowerCase()

    const include = profile.includeKeywords || []
    const exclude = profile.excludeKeywords || []
    const context = profile.contextKeywords || []

    for (const k of include) {
      if (t.includes(k.toLowerCase())) score += 30
    }

    for (const c of context) {
      if (t.includes(c.toLowerCase())) score += 15
    }

    for (const e of exclude) {
      if (t.includes(e.toLowerCase())) score -= 40
    }

    if (t.length < 20) score -= 15

    let decision: any = 'IRRELEVANT'
    if (score >= 70) decision = 'RELEVANT'
    else if (score >= 40) decision = 'MAYBE'

    return { score, decision }
  }
}
