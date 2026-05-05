import axios from 'axios'
import { SourceAdapter } from './source-adapter.interface'

type WebSearchContext = {
  companyName?: string | null
  website?: string | null
  city?: string | null
  industry?: string | null
  aliases?: string[]
}

type SearchItem = {
  url: string
  title: string
  snippet?: string
}

type RelevanceContext = {
  names: string[]
  nameTokens: string[]
  city?: string | null
  cityTokens: string[]
  ownHost?: string | null
}

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
          content: 'Компания получила позитивные отзывы клиентов.',
          author: 'Industry Media',
          publishedAt: new Date()
        }
      ]
    }

    const context = target?.searchContext as WebSearchContext | undefined
    const queries = this.buildQueries(context, target?.externalUrl)
    const relevance = this.buildRelevanceContext(context, target?.externalUrl)

    const results: any[] = []
    const seenUrls = new Set<string>()
    const seenFingerprints = new Set<string>()

    for (const query of queries.slice(0, 4)) {
      const items = await this.fetchFromYandex(query)

      for (const item of items) {
        const url = this.normalizeUrl(item.url)
        if (!url) continue

          if (this.isMapReviewUrl(url)) {
            console.log('[WEB] relevance skip map/review platform', { url })
            continue
          }

        const title = item.title || ''
        const snippet = item.snippet || ''
        const host = this.getHost(url)
        const fingerprint = `${host}:${this.normalizeText(title).slice(0, 80)}`

        if (seenUrls.has(url)) continue
        if (seenFingerprints.has(fingerprint)) continue

        seenUrls.add(url)
        seenFingerprints.add(fingerprint)

        if (this.isGarbage(url, title, snippet)) {
          console.log('[WEB] relevance skip garbage', { title, url })
          continue
        }

        const score = this.scoreSearchItem({ url, title, snippet }, relevance)

        if (!score.accepted) {
          console.log('[WEB] relevance skip low score', {
            score: score.score,
            reasons: score.reasons,
            title,
            url
          })
          continue
        }

        console.log('[WEB] relevance accepted', {
          score: score.score,
          reasons: score.reasons,
          title,
          url
        })

        results.push({
          externalMentionId: `web:yandex:${Buffer.from(url).toString('base64url')}`,
          url,
          title,
          content: snippet || title,
          author: 'Yandex Search API',
          publishedAt: new Date()
        })

        if (results.length >= 15) return results
      }
    }

    return results
  }

  private async fetchFromYandex(query: string): Promise<SearchItem[]> {
    const apiKey = process.env.YANDEX_SEARCH_API_KEY
    const folderId = process.env.YANDEX_SEARCH_FOLDER_ID

    if (!apiKey || !folderId) {
      console.warn('[WEB] Yandex Search API not configured')
      return []
    }

    try {
      console.log('[WEB] Yandex Search API search start', { query })

      const { data } = await axios.post(
        'https://searchapi.api.cloud.yandex.net/v2/web/search',
        {
          query: {
            searchType: 'SEARCH_TYPE_RU',
            queryText: query,
            familyMode: 'FAMILY_MODE_MODERATE',
            page: '0',
            fixTypoMode: 'FIX_TYPO_MODE_ON'
          },
          sortSpec: {
            sortMode: 'SORT_MODE_BY_RELEVANCE',
            sortOrder: 'SORT_ORDER_DESC'
          },
          groupSpec: {
            groupMode: 'GROUP_MODE_DEEP',
            groupsOnPage: '10',
            docsInGroup: '1'
          },
          maxPassages: '2',
          l10N: 'LOCALIZATION_RU',
          folderId,
          responseFormat: 'FORMAT_XML',
          userAgent: 'Mozilla/5.0 ReputationOS/1.0'
        },
        {
          headers: {
            Authorization: `Api-Key ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      )

      const rawData = data?.rawData || data?.response?.rawData
      if (!rawData) {
        console.warn('[WEB] Yandex Search API empty rawData', { query, keys: Object.keys(data || {}) })
        return []
      }

      const xml = Buffer.from(rawData, 'base64').toString('utf8')
      const docs = xml.match(/<doc\b[^>]*>[\s\S]*?<\/doc>/g) || []
      const results: SearchItem[] = []

      for (const block of docs.slice(0, 10)) {
        const url = this.extractXml(block, 'url')
        const title = this.extractXml(block, 'title')
        const snippet = this.extractXml(block, 'passage') || this.extractXml(block, 'headline')

        if (!url || !title) continue

        results.push({
          url: this.decodeHtml(url),
          title: this.cleanText(title),
          snippet: this.cleanText(snippet || title)
        })
      }

      console.log('[WEB] Yandex Search API search done', { query, found: results.length })
      return results
    } catch (e: any) {
      console.warn('[WEB] Yandex Search API failed', {
        query,
        status: e?.response?.status,
        data: e?.response?.data,
        error: e?.message
      })
      return []
    }
  }

  private buildQueries(context?: WebSearchContext, fallback?: string | null) {
    const companyName = context?.companyName?.trim()
    const aliases = Array.isArray(context?.aliases) ? context.aliases.filter(Boolean).slice(0, 5) : []
    const city = context?.city?.trim()

    const base = [companyName, ...aliases]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.trim())
      .filter(Boolean)

    const fallbackValue = fallback?.trim()
    if (!base.length && fallbackValue) base.push(fallbackValue)
    if (!base.length) return []

    return base.flatMap((name) => [
      name,
      `${name} ${city || ''}`.trim(),
      `${name} отзывы ${city || ''}`.trim(),
      `${name} новости ${city || ''}`.trim(),
      `${name} рейтинг ${city || ''}`.trim()
    ]).filter((value, index, arr): value is string => Boolean(value) && arr.indexOf(value) === index)
  }

  private buildRelevanceContext(context?: WebSearchContext, fallback?: string | null): RelevanceContext {
    const names = [
      context?.companyName,
      ...(Array.isArray(context?.aliases) ? context.aliases : [])
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.trim())
      .filter(Boolean)

    if (!names.length && fallback) names.push(fallback)

    const nameTokens = Array.from(new Set(
      names.flatMap((name) => this.tokenize(name))
        .filter((token) => !this.isWeakToken(token))
    ))

    const city = context?.city?.trim() || null
    const cityTokens = city ? this.cityVariants(city) : []

    return {
      names,
      nameTokens,
      city,
      cityTokens,
      ownHost: this.getHost(context?.website || fallback || null)
    }
  }

  private scoreSearchItem(item: SearchItem, context: RelevanceContext) {
    const titleText = this.normalizeText(item.title)
    const snippetText = this.normalizeText(item.snippet || '')
    const urlText = this.normalizeText(item.url)
    const allText = `${titleText} ${snippetText} ${urlText}`

    let score = 0
    const reasons: string[] = []

    const exactNameHit = context.names.some((name) => {
      const normalizedName = this.normalizeText(name)
      return normalizedName.length >= 4 && allText.includes(normalizedName)
    })

    if (exactNameHit) {
      score += 8
      reasons.push('exact_name')
    }

    let titleTokenHits = 0
    let totalTokenHits = 0

    for (const token of context.nameTokens) {
      if (titleText.includes(token)) {
        score += 3
        titleTokenHits++
        totalTokenHits++
      } else if (snippetText.includes(token)) {
        score += 2
        totalTokenHits++
      } else if (urlText.includes(token)) {
        score += 1
        totalTokenHits++
      }
    }

    if (titleTokenHits > 0) reasons.push(`title_tokens:${titleTokenHits}`)
    if (totalTokenHits > 0) reasons.push(`total_tokens:${totalTokenHits}`)

    const hasCityHit = context.cityTokens.some((token) => allText.includes(token))
    const hasOtherCity = this.hasConflictingCity(allText, context.cityTokens)

    if (hasCityHit) {
      score += 4
      reasons.push('city')
    }

    if (hasOtherCity && !hasCityHit) {
      score -= 50
      reasons.push('other_city')
    }

    if (/(отзывы|review|рейтинг|оценк|мнения|zoon|restoclub|otzovik|irecommend|2gis|yandex\.ru\/maps)/i.test(allText)) {
      score += 4
      reasons.push('review_source')
    }

    if (/(новости|афиша|концерт|события|билеты|kassir|afisha)/i.test(allText)) {
      score += 2
      reasons.push('news_or_events')
    }

    if (/(официальный|official|сайт|бар|клуб|караоке|ресторан)/i.test(allText)) {
      score += 2
      reasons.push('business_terms')
    }

    const accepted =
      score >= 7 &&
      (exactNameHit || totalTokenHits >= 2) &&
      !(hasOtherCity && !hasCityHit && score < 10)

    return { accepted, score, reasons }
  }

  private hasConflictingCity(text: string, allowedCityTokens: string[]) {
    const cityTokens = [
      'рязань', 'рязан', 'ryazan', 'rzn',
      'санкт петербург', 'петербург', 'спб', 'spb', 'saint petersburg',
      'минск',
      'казань',
      'екатеринбург',
      'новосибирск',
      'нижний новгород',
      'самара',
      'ростов',
      'краснодар',
      'воронеж',
      'уфа',
      'пермь',
      'омск',
      'челябинск'
    ]

    return cityTokens.some((city) => {
      if (allowedCityTokens.includes(city)) return false
      return text.includes(city)
    })
  }

  private cityVariants(city: string) {
    const normalized = this.normalizeText(city)

    if (normalized.includes('москва')) return ['москва', 'москве', 'москов', 'msk']
    if (normalized.includes('санкт') || normalized === 'спб') return ['санкт петербург', 'петербург', 'спб']

    return [normalized]
  }

  private tokenize(value: string) {
    return this.normalizeText(value)
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  }

  private isWeakToken(token: string) {
    return [
      'клуб',
      'бар',
      'ооо',
      'ип',
      'the',
      'and',
      'для',
      'или',
      'это',
      'как'
    ].includes(token)
  }

  private normalizeText(value: string) {
    return this.decodeHtml(value || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9]+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private extractXml(block: string, tag: string) {
    const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block)
    return match?.[1]?.trim() || null
  }

  private cleanText(value: string) {
    return this.decodeHtml(value.replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim()
  }

  private decodeHtml(value: string) {
    return value
      .replace(/<!\[CDATA\[/g, '')
      .replace(/\]\]>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
  }

  private normalizeUrl(raw: string) {
    try {
      const url = new URL(this.decodeHtml(raw))
      url.hash = ''

      const bad = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'yclid', 'from', 'lr']
      bad.forEach((param) => url.searchParams.delete(param))

      return url.toString()
    } catch {
      return raw
    }
  }

    private isMapReviewUrl(value?: string | null) {
      if (!value) return false

      try {
        const parsed = new URL(value.startsWith('http') ? value : `https://${value}`)
        const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
        const path = parsed.pathname.toLowerCase()

        return (
          host === '2gis.ru' ||
          host.endsWith('.2gis.ru') ||
          (
            (host === 'yandex.ru' || host.endsWith('.yandex.ru') || host === 'yandex.com' || host.endsWith('.yandex.com')) &&
            path.startsWith('/maps')
          )
        )
      } catch {
        const lower = value.toLowerCase()
        return lower.includes('2gis.ru') || lower.includes('yandex.ru/maps') || lower.includes('yandex.com/maps')
      }
    }

  private isGarbage(url: string, title: string, snippet = '') {
    const lower = `${url} ${title} ${snippet}`.toLowerCase()

    return (
        this.isMapReviewUrl(url) ||
      lower.includes('yandex.ru/search') ||
      lower.includes('yandex.ru/images/search') ||
      lower.includes('google.com') ||
      lower.includes('accounts.google') ||
      lower.includes('mail.google') ||
      lower.includes('vk.com/video') ||
      lower.includes('duckduckgo.com') ||
      lower.includes('/images/search')
    )
  }

  private getHost(value?: string | null) {
    if (!value) return null
    try {
      const parsed = new URL(value.startsWith('http') ? value : `https://${value}`)
      return parsed.hostname.replace(/^www\./, '')
    } catch {
      return null
    }
  }

  async fetchRatingSnapshot() {
    return null
  }
}
