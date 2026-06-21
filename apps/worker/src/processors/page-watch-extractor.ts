import { createHash } from 'crypto'
import axios from 'axios'

export type ExtractedItem = {
  itemType: 'review' | 'article' | 'comment' | 'mention'
  itemHash: string
  title?: string
  content: string
  author?: string
  ratingValue?: number
  publishedAt?: Date
  url?: string
}

export type PageType = 'REVIEWS' | 'ARTICLES' | 'FORUM' | 'DIRECTORY' | 'UNKNOWN'

export class PageWatchExtractor {
  // ─── Определение типа страницы ───────────────────────────────────────────

  extractDate(blockHtml: string, pageHtml?: string): Date | null {
    const m1 = blockHtml.match(/itemprop=["']datePublished["'][^>]*content=["']([^"']+)["']/)
      || blockHtml.match(/content=["']([^"']+)["'][^>]*itemprop=["']datePublished["']/)
    if (m1) { const d = new Date(m1[1]); if (!isNaN(d.getTime())) return d }
    const m2 = blockHtml.match(/<time[^>]+datetime=["']([^"']+)["']/)
    if (m2) { const d = new Date(m2[1]); if (!isNaN(d.getTime())) return d }
    const m3 = blockHtml.match(/data-(?:date|published|time|created)=["'](20\d{2}-\d{2}-\d{2}[^"']*)["']/)
    if (m3) { const d = new Date(m3[1]); if (!isNaN(d.getTime())) return d }
    const m4 = blockHtml.match(/(20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))/)
    if (m4) { const d = new Date(m4[1]); if (!isNaN(d.getTime())) return d }
    if (pageHtml) {
      const og = pageHtml.match(/property=["']article:published_time["'][^>]*content=["']([^"']+)["']/)
        || pageHtml.match(/content=["']([^"']+)["'][^>]*property=["']article:published_time["']/)
      if (og) { const d = new Date(og[1]); if (!isNaN(d.getTime())) return d }
    }
    return null
  }

  detectPageType(html: string, url: string): PageType {
    const lower = html.toLowerCase()
    const urlLower = url.toLowerCase()

    const reviewScore =
      this.count(lower, /отзыв|review|рейтинг|оценк|звезд|star/g) +
      this.count(urlLower, /review|otzyv|otziv|otzov|feedback/g) * 3 +
      (/(irecommend|otzovik|zoon|yell|tripadvisor|restoclub|flamp|spr\.ru|orgpage)/i.test(url) ? 10 : 0)

    const articleScore =
      this.count(lower, /статья|article|новость|news|публикац|пресс/g) +
      this.count(urlLower, /article|news|blog|post|press/g) * 3

    const forumScore =
      this.count(lower, /форум|тема|сообщени|comment|discuss|ответ|участник/g) +
      this.count(urlLower, /forum|thread|topic|discuss/g) * 3

    const directoryScore =
      this.count(lower, /каталог|организаци|компани|справочник|адрес|телефон/g) +
      this.count(urlLower, /catalog|directory|org|company/g) * 3

    const max = Math.max(reviewScore, articleScore, forumScore, directoryScore)
    if (max < 3) return 'UNKNOWN'
    if (max === reviewScore) return 'REVIEWS'
    if (max === articleScore) return 'ARTICLES'
    if (max === forumScore) return 'FORUM'
    return 'DIRECTORY'
  }

  // ─── Извлечение элементов ────────────────────────────────────────────────

  extractItems(html: string, pageType: PageType, pageUrl: string): ExtractedItem[] {
    switch (pageType) {
      case 'REVIEWS':   return this.extractReviews(html, pageUrl)
      case 'ARTICLES':  return this.extractArticles(html, pageUrl)
      case 'FORUM':     return this.extractComments(html, pageUrl)
      case 'DIRECTORY': return []  // каталоги не парсим — только список организаций
      default:          return []  // UNKNOWN = JS-сайт или нераспознанный, не создаём мусор
    }
  }

  // ─── REVIEWS ─────────────────────────────────────────────────────────────

  private extractReviews(html: string, pageUrl: string): ExtractedItem[] {
    const items: ExtractedItem[] = []

    // Паттерн 1: JSON-LD schema.org Review
    const jsonldBlocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
    for (const block of jsonldBlocks) {
      try {
        const json = JSON.parse(block.replace(/<script[^>]*>|<\/script>/gi, ''))
        const reviews = Array.isArray(json) ? json.flatMap((j: any) => j['@type'] === 'Review' ? [j] : (j.review || [])) : (json['@type'] === 'Review' ? [json] : (json.review || []))
        for (const r of reviews) {
          const content = r.reviewBody || r.description || ''
          if (!content || content.length < 10) continue
          const author = r.author?.name || r.author || ''
          const rating = r.reviewRating?.ratingValue ? Number(r.reviewRating.ratingValue) : undefined
          const publishedAt = r.datePublished ? new Date(r.datePublished) : new Date()
          items.push(this.makeItem('review', content, author, rating, publishedAt, pageUrl))
        }
      } catch {}
    }

    if (items.length > 0) return items.slice(0, 50)

    // Паттерн 2: микроразметка itemprop="reviewBody"
    const reviewBodies = html.match(/itemprop="reviewBody"[^>]*>([\s\S]*?)<\//gi) || []
    for (const block of reviewBodies) {
      const content = this.stripTags(block)
      if (content.length < 15) continue
      items.push(this.makeItem('review', content, undefined, undefined, new Date(), pageUrl))
    }

    if (items.length > 0) return items.slice(0, 50)

    // Паттерн 3: эвристика — блоки с классами review/comment/feedback
    const blocks = html.match(/<[^>]+class="[^"]*(?:review|comment|feedback|otzyv)[^"]*"[^>]*>([\s\S]{30,800}?)<\/(?:div|article|section|li)>/gi) || []
    for (const block of blocks) {
      const text = this.stripTags(block).trim()
      if (text.length < 20 || text.length > 1000) continue
      const publishedAt = this.extractDate(block, html)
      if (!publishedAt && text.length < 150) continue
      items.push(this.makeItem('review', text, undefined, undefined, publishedAt ?? undefined, pageUrl))
    }

    return items.slice(0, 50)
  }

  // ─── ARTICLES ────────────────────────────────────────────────────────────

  private extractArticles(html: string, pageUrl: string): ExtractedItem[] {
    const items: ExtractedItem[] = []

    // JSON-LD NewsArticle / Article
    const jsonldBlocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
    for (const block of jsonldBlocks) {
      try {
        const json = JSON.parse(block.replace(/<script[^>]*>|<\/script>/gi, ''))
        const arts = Array.isArray(json) ? json : [json]
        for (const a of arts) {
          if (!/(Article|NewsArticle|BlogPosting)/i.test(a['@type'] || '')) continue
          const title = a.headline || a.name || ''
          const content = a.description || a.articleBody || title
          if (!content || content.length < 10) continue
          const publishedAt = a.datePublished ? new Date(a.datePublished) : new Date()
          const author = a.author?.name || a.author || ''
          items.push(this.makeItem('article', content, author, undefined, publishedAt, a.url || pageUrl, title))
        }
      } catch {}
    }

    if (items.length > 0) return items.slice(0, 30)

    // Эвристика: <article> теги
    const articleTags = html.match(/<article[^>]*>([\s\S]{50,2000}?)<\/article>/gi) || []
    for (const block of articleTags) {
      const titleMatch = block.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)
      const title = titleMatch ? this.stripTags(titleMatch[0]).trim() : ''
      const content = this.stripTags(block).trim().slice(0, 500)
      if (content.length < 30) continue
      items.push(this.makeItem('article', content, undefined, undefined, new Date(), pageUrl, title))
    }

    return items.slice(0, 30)
  }

  // ─── FORUM ───────────────────────────────────────────────────────────────

  private extractComments(html: string, pageUrl: string): ExtractedItem[] {
    const items: ExtractedItem[] = []
    const blocks = html.match(/<[^>]+class="[^"]*(?:post|message|comment|reply)[^"]*"[^>]*>([\s\S]{20,800}?)<\/(?:div|li|article)>/gi) || []
    for (const block of blocks) {
      const text = this.stripTags(block).trim()
      if (text.length < 20 || text.length > 1000) continue
      items.push(this.makeItem('comment', text, undefined, undefined, new Date(), pageUrl))
    }
    return items.slice(0, 50)
  }

  // ─── UNKNOWN / DIRECTORY ─────────────────────────────────────────────────

  private extractMentions(html: string, pageUrl: string): ExtractedItem[] {
    // Просто берём первые 500 символов основного текста как одно упоминание
    const text = this.stripTags(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
    ).replace(/\s+/g, ' ').trim().slice(0, 500)

    if (text.length < 30) return []
    return [this.makeItem('mention', text, undefined, undefined, new Date(), pageUrl)]
  }

  // ─── YandexGPT fallback для определения типа ─────────────────────────────

  async detectPageTypeWithLlm(html: string, url: string): Promise<PageType> {
    const heuristic = this.detectPageType(html, url)
    if (heuristic !== 'UNKNOWN') return heuristic

    const apiKey = process.env.YANDEX_GPT_API_KEY
    const folderId = process.env.YANDEX_GPT_FOLDER_ID
    if (!apiKey || !folderId) return 'UNKNOWN'

    const snippet = this.stripTags(html).replace(/\s+/g, ' ').trim().slice(0, 600)
    try {
      const { data } = await axios.post(
        'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
        {
          modelUri: `gpt://${folderId}/yandexgpt-lite`,
          completionOptions: { stream: false, temperature: 0, maxTokens: 10 },
          messages: [
            { role: 'system', text: 'Классифицируй страницу. Ответь ТОЛЬКО одним словом: REVIEWS, ARTICLES, FORUM, DIRECTORY или UNKNOWN.' },
            { role: 'user', text: `URL: ${url}\n\nТекст страницы:\n${snippet}` }
          ]
        },
        { headers: { Authorization: `Api-Key ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 8000 }
      )
      const answer = data?.result?.alternatives?.[0]?.message?.text?.trim().toUpperCase() || 'UNKNOWN'
      if (['REVIEWS','ARTICLES','FORUM','DIRECTORY'].includes(answer)) return answer as PageType
    } catch {}
    return 'UNKNOWN'
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private makeItem(
    itemType: ExtractedItem['itemType'],
    content: string,
    author?: string,
    ratingValue?: number,
    publishedAt?: Date,
    url?: string,
    title?: string
  ): ExtractedItem {
    const itemHash = createHash('sha256')
      .update(`${itemType}|${(author || '').slice(0,80)}|${content.slice(0,200)}|${ratingValue ?? ''}`)
      .digest('hex')
    return { itemType, itemHash, content: content.slice(0, 2000), author, ratingValue, publishedAt, url, title }
  }

  private stripTags(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()
  }

  private count(text: string, re: RegExp): number {
    return (text.match(re) || []).length
  }
}
