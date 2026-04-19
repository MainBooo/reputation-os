import { chromium } from 'playwright'

type ExternalMention = {
  externalMentionId: string
  url: string
  title: string | null
  content: string
  author: string | null
  publishedAt: Date
  ratingValue: number | null
}

export class YandexAdapter {
  private normalizeReviewsUrl(url: string) {
    const trimmed = url.trim()
    const orgMatch = trimmed.match(/https?:\/\/yandex\.ru\/maps\/org\/[^/?#]+\/\d+/i)

    if (orgMatch?.[0]) {
      return `${orgMatch[0].replace(/\/$/, '')}/reviews/`
    }

    return trimmed
  }

  async discoverTargets(_input?: unknown) {
    return []
  }

  async fetchMentions(target?: { id?: string; externalUrl?: string | null }): Promise<ExternalMention[]> {
    if (!target?.externalUrl) {
      console.log('[DEBUG][YANDEX] skip: no externalUrl')
      return []
    }

    let browser: any = null

    try {
      const normalizedUrl = this.normalizeReviewsUrl(target.externalUrl)

      console.log('[DEBUG][YANDEX] playwright start url=', target.externalUrl)
      console.log('[DEBUG][YANDEX] normalized reviews url=', normalizedUrl)

      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0',
        locale: 'ru-RU'
      })

      const page = await context.newPage()

      await page.goto(normalizedUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 45000
      })

      await page.waitForTimeout(5000)

      await page.evaluate(() => {
        const buttons = Array.from(
          document.querySelectorAll('[class*="expand"], [aria-label="Ещё"]')
        )

        for (const btn of buttons) {
          try {
            ;(btn as HTMLElement).click()
          } catch {}
        }
      })

      try {
        await page.waitForSelector('[data-review-id], .business-review-view', { timeout: 15000 })
      } catch {
        console.log('[DEBUG][YANDEX] no review selector found')
      }

      for (let i = 0; i < 6; i++) {
        await page.mouse.wheel(0, 3000)
        await page.waitForTimeout(1500)
      }

      for (let i = 0; i < 8; i++) {
        await page.evaluate(() => {
          const candidates = [
            document.querySelector('[class*="scroll__container"]'),
            document.querySelector('[class*="reviews-view__list"]'),
            document.querySelector('[class*="items-view"]'),
            document.querySelector('[class*="business-reviews-card-view"]'),
            document.querySelector('[class*="tabs-select-view__content"]')
          ].filter(Boolean) as HTMLElement[]

          const container =
            candidates.find((node) => node.scrollHeight > node.clientHeight) ||
            document.scrollingElement ||
            document.documentElement

          container.scrollTop += 2500
        })

        await page.waitForTimeout(1200)
      }

      for (let pass = 0; pass < 3; pass++) {
        const expandButtons = page.locator('.business-review-view__expand[role="button"]')
        const count = await expandButtons.count()

        if (!count) break

        for (let i = 0; i < count; i++) {
          const button = expandButtons.nth(i)

          try {
            if (await button.isVisible({ timeout: 500 })) {
              await button.click({ timeout: 1500 })
              await page.waitForTimeout(150)
            }
          } catch {}
        }
      }

      const reviews = await page.evaluate(
        ({ externalUrl, targetId }: { externalUrl: string; targetId?: string }) => {
          const reviewNodes = Array.from(
            document.querySelectorAll<HTMLElement>('[data-review-id], .business-review-view')
          )

          function getText(review: HTMLElement) {
            const selectors = [
              '.business-review-view__body-text',
              '.business-review-view__comment',
              '[class*="review-text"]',
              '[class*="business-review-view__body"]',
              '[class*="text"]'
            ]

            for (const selector of selectors) {
              const node = review.querySelector<HTMLElement>(selector)
              const text = (node?.textContent || '').replace(/\s+/g, ' ').trim()
              if (text.length > 0) return text
            }

            return (review.textContent || '').replace(/\s+/g, ' ').trim()
          }

          function getAuthor(review: HTMLElement) {
            const selectors = [
              '[itemprop="author"]',
              '.business-review-view__author',
              '[class*="user-name"]',
              '[class*="author"]'
            ]

            for (const selector of selectors) {
              const node = review.querySelector<HTMLElement>(selector)
              const text = (node?.textContent || '').replace(/\s+/g, ' ').trim()
              if (text.length > 0) return text
            }

            return null
          }

          function getPublishedAt(review: HTMLElement) {
            const meta = review.querySelector<HTMLMetaElement>('meta[itemprop="datePublished"]')
            const content = meta?.getAttribute('content')?.trim()
            return content || null
          }

          function getRating(review: HTMLElement) {
            const ratingMeta =
              review.querySelector<HTMLMetaElement>('meta[itemprop="ratingValue"]') ||
              review.querySelector<HTMLMetaElement>('[itemprop="reviewRating"] meta[itemprop="ratingValue"]')

            const ratingMetaValue = ratingMeta?.getAttribute('content')?.trim()
            if (ratingMetaValue) {
              const parsed = Number(ratingMetaValue.replace(',', '.'))
              if (Number.isFinite(parsed)) return parsed
            }

            const fullStars = review.querySelectorAll(
              '.business-rating-badge-view__star._full, .business-rating-badge-view__star_full'
            ).length
            if (fullStars > 0) return fullStars

            const filledStars = review.querySelectorAll('[class*="star_full"]').length
            if (filledStars > 0) return filledStars

            return null
          }

          return reviewNodes
            .map((review, index) => {
              let content = getText(review)

              content = content
                .replace(/\s*Ещё\s*$/gi, '')
                .replace(/…\s*Ещё\s*$/gi, '')
                .replace(/\.\.\.\s*Ещё\s*$/gi, '')
                .trim()

              const publishedAt = getPublishedAt(review)
              const ratingValue = getRating(review)
              const author = getAuthor(review)
              const reviewId =
                review.getAttribute('data-review-id') ||
                review.getAttribute('data-review') ||
                publishedAt ||
                `${targetId || 'target'}-${index}`

              return {
                externalMentionId: `yandex:${targetId || 'target'}:${reviewId}`,
                url: externalUrl,
                title: null,
                content,
                author,
                publishedAt,
                ratingValue
              }
            })
            .filter((item) => item.content && item.content.length > 20)
            .slice(0, 50)
        },
        { externalUrl: normalizedUrl, targetId: target.id }
      )

      console.log('[DEBUG][YANDEX] extracted count=', reviews.length)
      console.log('[DEBUG][YANDEX] first=', reviews[0] || null)

      return reviews.map((item: {
        externalMentionId: string
        url: string
        title: string | null
        content: string
        author: string | null
        publishedAt: string | null
        ratingValue: number | null
      }) => ({
        externalMentionId: item.externalMentionId,
        url: item.url,
        title: item.title,
        content: item.content,
        author: item.author,
        publishedAt: item.publishedAt ? new Date(item.publishedAt) : new Date(),
        ratingValue: item.ratingValue ?? null
      }))
    } catch (e) {
      console.error('[DEBUG][YANDEX] error=', e)
      return []
    } finally {
      if (browser) {
        await browser.close().catch(() => null)
      }
    }
  }

  async fetchRatingSnapshot(_target?: unknown) {
    return null
  }
}
