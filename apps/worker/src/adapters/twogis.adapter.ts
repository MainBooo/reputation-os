import { Injectable } from '@nestjs/common'
import { chromium } from 'playwright'
import crypto from 'crypto'

type ExternalMention = {
  externalMentionId: string
  url: string
  title?: string
  content: string
  author?: string
  publishedAt: Date
  ratingValue?: number | null
}

function cleanText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function buildHash(value: string) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 24)
}

function parseRatingValue(text: string): number | null {
  const normalized = text.toLowerCase()

  if (normalized.includes('в восторге')) return 5
  if (normalized.includes('понравилось') && !normalized.includes('не понравилось') && !normalized.includes('совсем не понравилось')) return 4
  if (normalized.includes('было средне')) return 3
  if (normalized.includes('не понравилось') && !normalized.includes('совсем не понравилось')) return 2
  if (normalized.includes('совсем не понравилось')) return 1

  return null
}

function parseRussianDate(value: string): Date | null {
  const text = cleanText(value).toLowerCase()
  const now = new Date()

  if (!text) return null

  if (text.includes('сегодня')) return now

  if (text.includes('вчера')) {
    const date = new Date(now)
    date.setDate(date.getDate() - 1)
    return date
  }

  const months: Record<string, number> = {
    января: 0,
    февраля: 1,
    марта: 2,
    апреля: 3,
    мая: 4,
    июня: 5,
    июля: 6,
    августа: 7,
    сентября: 8,
    октября: 9,
    ноября: 10,
    декабря: 11
  }

  const match = text.match(/(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(\d{4})/)
  if (!match) return null

  const day = Number(match[1])
  const month = months[match[2]]
  const year = Number(match[3])

  const date = new Date(year, month, day, 12, 0, 0)
  return Number.isFinite(date.getTime()) ? date : now
}

function extractDateText(value: string) {
  const text = cleanText(value)

  const match = text.match(/\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+\d{4}/i)
  if (match?.[0]) return match[0]

  if (text.includes('сегодня')) return 'сегодня'
  if (text.includes('вчера')) return 'вчера'

  return ''
}

function removeServiceText(value: string) {
  return cleanText(value)
    .replace(/Читать целиком/gi, ' ')
    .replace(/\d+\s+посещени[еяй]/gi, ' ')
    .replace(/Отзыв подтвержд[ёе]н/gi, ' ')
    .replace(/Оплата\s+\S+/gi, ' ')
    .replace(/\d+\s*Полезно\?/gi, ' ')
    .replace(/Полезно\?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeReviewsUrl(url: string) {
  const trimmed = cleanText(url)
  if (!trimmed) return trimmed

  if (trimmed.includes('/tab/reviews')) return trimmed

  const withoutQuery = trimmed.split('?')[0].replace(/\/$/, '')
  return `${withoutQuery}/tab/reviews`
}

function extractFirmId(url: string) {
  const match = url.match(/firm\/(\d+)/i)
  return match?.[1] || 'unknown'
}

@Injectable()
export class TwoGisAdapter {
  async discoverTargets(_input?: any) {
    return []
  }

  async fetchMentions(target?: { id?: string; externalUrl?: string | null }): Promise<ExternalMention[]> {
    if (!target?.externalUrl) return []

    const normalizedUrl = normalizeReviewsUrl(target.externalUrl)
    const firmId = extractFirmId(normalizedUrl)

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    })

    try {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1200 },
        userAgent:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      })

      try {
        await page.goto(normalizedUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })
      } catch (error) {
        console.warn('[TWOGIS] goto timeout, continue parse attempt', {
          url: normalizedUrl,
          error: error instanceof Error ? error.message : String(error)
        })
      }
      if (page.isClosed()) {
        console.warn('[TWOGIS] page closed after goto, skip target', { url: normalizedUrl, reason: 'TWOGIS_PAGE_CLOSED_AFTER_GOTO' })
        return []
      }
      await page.waitForTimeout(7000)

      for (let i = 0; i < 12; i += 1) {
        if (page.isClosed()) {
          console.warn('[TWOGIS] page closed during scroll, stop parse', { url: normalizedUrl, reason: 'TWOGIS_PAGE_CLOSED_DURING_SCROLL' })
          break
        }
        await page.mouse.wheel(0, 900)
        await page.waitForTimeout(650)
      }

      const items = await page.evaluate(() => {
        function clean(value: unknown) {
          return String(value || '').replace(/\s+/g, ' ').trim()
        }

        function removeHeaderFromText(fullText: string, headerText: string) {
          if (!headerText) return fullText
          return fullText.startsWith(headerText) ? fullText.slice(headerText.length).trim() : fullText
        }

        const reviewNodes = Array.from(document.querySelectorAll('div._1rowqpjv'))

        return reviewNodes
          .map((node) => {
            const root = node as HTMLElement
            const fullText = clean(root.innerText || root.textContent || '')

            const authorNode =
              root.querySelector('div._pdxewp') ||
              root.querySelector('div._r6zroz') ||
              root.querySelector('div._my60n2') ||
              root.querySelector('div._3k3ejs')

            const headerText = clean((authorNode as HTMLElement | null)?.innerText || authorNode?.textContent || '')
            const contentNode =
              root.querySelector('div._83kmcy') ||
              root.querySelector('a._co8kyiw') ||
              root.querySelector('div._hui97pi') ||
              root.querySelector('div._ai6fyf')

            const contentText = clean((contentNode as HTMLElement | null)?.innerText || contentNode?.textContent || '')
            const bodyText = contentText || removeHeaderFromText(fullText, headerText)

            return {
              fullText,
              headerText,
              bodyText
            }
          })
          .filter((item) => item.fullText.length > 0)
      })

      const mentions = items
        .map((item: { fullText: string; headerText: string; bodyText: string }, index: number): ExternalMention | null => {
          const headerText = cleanText(item.headerText)
          const fullText = cleanText(item.fullText)
          const ratingValue = parseRatingValue(headerText || fullText)

          let author = headerText
            .replace(/В восторге|Совсем не понравилось|Не понравилось|Понравилось|Было средне/gi, '')
            .replace(/^[А-ЯA-ZЁ]{1,3}\s+/, '')
            .trim()

          author = author.split('·')[0]?.trim() || author

          const dateText = extractDateText(fullText) || extractDateText(item.bodyText)
          let content = removeServiceText(item.bodyText || fullText)

          if (dateText) {
            content = content.replace(dateText, '').trim()
          }

          content = content
            .replace(/^,\s*измен[ёе]н\s*/i, '')
            .replace(/^измен[ёе]н\s*/i, '')
            .replace(/^\d+\s+/, '')
            .trim()

          if (content.length < 2) return null

          const publishedAt = parseRussianDate(dateText)
          if (!publishedAt) return null
          const hash = buildHash(`${firmId}:${author}:${dateText}:${content}`)

          return {
            externalMentionId: `twogis:${firmId}:${hash}`,
            url: normalizedUrl,
            title: author ? `Отзыв 2GIS от ${author}` : 'Отзыв 2GIS',
            content,
            author: author || undefined,
            publishedAt,
            ratingValue
          }
        })
        .filter((item): item is ExternalMention => Boolean(item))

      const seen = new Set<string>()
      return mentions.filter((item) => {
        if (seen.has(item.externalMentionId)) return false
        seen.add(item.externalMentionId)
        return true
      })
    } finally {
      await browser.close()
    }
  }

  async fetchRatingSnapshot(_target?: any) {
    return {
      ratingValue: null,
      reviewsCount: null
    }
  }
}
