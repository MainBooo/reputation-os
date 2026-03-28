import { SourceAdapter } from './source-adapter.interface'
import { chromium } from 'playwright'

export class WebMentionAdapter implements SourceAdapter {
  async discoverTargets(input: any) {
    return [
      { externalUrl: input?.website || null, displayName: input?.name || 'Web monitor' }
    ]
  }

  async fetchMentions(target: any) {
    if (process.env.DEMO_MODE === 'true') {
      return [
        {
          externalMentionId: 'web:demo:1',
          url: 'https://news.example.com/article/acme',
          title: 'Компания в обзоре рынка',
          content: 'Компания получила позитивные отзывы клиентов и выросла по рейтингу.',
          author: 'Industry Media',
          publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 8),
          ratingValue: null
        }
      ]
    }

    const browser = await chromium.launch({ headless: true })
    await browser.close()
    return []
  }

  async fetchRatingSnapshot() {
    return null
  }
}
