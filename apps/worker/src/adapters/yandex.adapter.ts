import { chromium } from 'playwright'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'

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

    const oidMatch = trimmed.match(/[?&]oid=(\d+)/)
    if (oidMatch?.[1]) {
      return `https://yandex.ru/maps/org/placeholder/${oidMatch[1]}/reviews/`
    }

    return trimmed
  }

  private async ensureNewestSort(page: any) {
    try {
      const readCurrentSortLabel = async () => {
        const labelSelectors = [
          '.rating-ranking-view',
          '[class*="rating-ranking-view"]',
          '[aria-label*="По новизне"]',
          '[aria-label*="По умолчанию"]'
        ]

        for (const selector of labelSelectors) {
          try {
            const locator = page.locator(selector).first()
            if (await locator.isVisible({ timeout: 500 })) {
              const text = ((await locator.textContent()) || '').replace(/\s+/g, ' ').trim()
              if (text) return text
              const aria = ((await locator.getAttribute('aria-label')) || '').trim()
              if (aria) return aria
            }
          } catch {}
        }

        return null
      }

      const beforeLabel = await readCurrentSortLabel()

      const toggleSelectors = [
        'body > div.body > div.app > div.sidebar-container > aside > div.sidebar-view__panel._no-padding > div.scroll._width_wide > div > div.scroll__content > div > div.business-card-view._wide > div > div.business-card-view__extend > div > div > div.business-tab-wrapper._materialized > div > div:nth-child(2) > div > div.card-reviews-view._wide > div:nth-child(2) > div > div.sticky-wrapper._position_top._border_auto > div.business-reviews-card-view__header > div.business-reviews-card-view__title > div > div > div > div > span:nth-child(1)',
        '.rating-ranking-view[role="button"]',
        '[class*="rating-ranking-view"][role="button"]',
        '.rating-ranking-view',
        '[class*="rating-ranking-view"]',
        'text=По умолчанию',
        'text=По новизне'
      ]

      let toggleClicked = false

      for (const selector of toggleSelectors) {
        const locator = page.locator(selector).first()

        try {
          if (await locator.isVisible({ timeout: 800 })) {
            await locator.scrollIntoViewIfNeeded().catch(() => null)
            await locator.click({ timeout: 1500 })
            toggleClicked = true
            break
          }
        } catch {}
      }

      if (!toggleClicked) {
        return
      }

      await page.waitForTimeout(700)

      const newestOptionSelectors = [
        '.rating-ranking-view__popup-line[aria-label="По новизне"]',
        '[class*="rating-ranking-view__popup-line"][aria-label="По новизне"]',
        '[role="button"][aria-label="По новизне"]',
        'text=По новизне'
      ]

      for (const selector of newestOptionSelectors) {
        const locator = page.locator(selector).first()

        try {
          if (await locator.isVisible({ timeout: 1000 })) {
            await locator.scrollIntoViewIfNeeded().catch(() => null)

            try {
              await locator.click({ timeout: 1500 })
            } catch {
              await locator.evaluate((node: HTMLElement) => node.click())
            }

            await page.waitForTimeout(1500)

            const afterLabel = await readCurrentSortLabel()
            return
          }
        } catch {}
      }

    } catch (e) {
    }
  }

  private async dismissYandexPopups(page: any) {
    const selectors = [
      'button:has-text("Запретить")',
      'text=Запретить',
      'button:has-text("Открыть мобильную версию")',
      'text=Открыть мобильную версию',
      'button:has-text("Не сейчас")',
      'text=Не сейчас',
      '[aria-label="Закрыть"]',
      'button[aria-label="Закрыть"]',
      '[class*="close"]'
    ]

    for (let pass = 0; pass < 3; pass++) {
      for (const selector of selectors) {
        try {
          const locator = page.locator(selector).first()

          if (await locator.isVisible({ timeout: 700 })) {
            await locator.click({ timeout: 1500 }).catch(async () => {
              await locator.evaluate((node: HTMLElement) => node.click())
            })
            await page.waitForTimeout(1000)
          }
        } catch {}
      }
    }
  }

  async discoverTargets(_input?: unknown) {
    return []
  }

  private async saveDebugSnapshot(page: any, reason: string, targetId?: string) {
    try {
      const dir = '/opt/reputation-os/storage/yandex-debug'
      await mkdir(dir, { recursive: true })

      const safeTargetId = targetId || 'unknown-target'
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const base = join(dir, safeTargetId + '-' + reason + '-' + stamp)

      const meta = {
        reason,
        targetId: safeTargetId,
        url: page.url(),
        title: await page.title().catch(() => null),
        savedAt: new Date().toISOString()
      }

      await writeFile(base + '.json', JSON.stringify(meta, null, 2), 'utf8')
      await writeFile(base + '.html', await page.content(), 'utf8')
      await page.screenshot({ path: base + '.png', fullPage: true }).catch(() => null)

    } catch (e) {
    }
  }

  private async logReviewDomStats(page: any, stage: string) {
    try {
      const stats = await page.evaluate(() => ({
        url: location.href,
        title: document.title,
        dataReviewId: document.querySelectorAll('[data-review-id]').length,
        businessReviewView: document.querySelectorAll('.business-review-view').length,
        reviewResults: document.documentElement.innerHTML.includes('"reviewResults"'),
        reviewId: document.documentElement.innerHTML.includes('"reviewId"'),
        bodyText: document.querySelectorAll('.business-review-view__body-text').length,
        body: document.querySelectorAll('.business-review-view__body').length
      }))

    } catch (e) {
    }
  }

  async fetchMentions(target?: { id?: string; externalUrl?: string | null }): Promise<ExternalMention[]> {
    if (!target?.externalUrl) {
      return []
    }

    let browser: any = null

    try {
      const normalizedUrl = this.normalizeReviewsUrl(target.externalUrl)


      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        locale: 'ru-RU',
        viewport: { width: 1280, height: 800 }
      })

      const page = await context.newPage()

      await page.goto(normalizedUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 45000
      })

      await page.waitForTimeout(5000)

      const currentUrl = page.url()
      const currentTitle = await page.title().catch(() => '')

      if (currentUrl.includes('/showcaptcha') || currentTitle.includes('Вы не робот')) {
        await this.saveDebugSnapshot(page, 'captcha', target.id)
        throw new Error('YANDEX_CAPTCHA_REQUIRED')
      }

        await this.dismissYandexPopups(page)

      await this.ensureNewestSort(page)

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
        await page.waitForSelector(
          '.card-reviews-view, [class*="card-reviews-view"], [class*="business-reviews-card-view"]',
          { timeout: 15000 }
        )
      } catch {
      }

      try {
        await page.waitForSelector('[data-review-id], .business-review-view', { timeout: 15000 })
      } catch {
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

          if (reviewNodes.length === 0) {


            const html = document.documentElement.innerHTML


            const marker = '"reviewResults":{"reviews":'


            const markerIndex = html.indexOf(marker)



            if (markerIndex >= 0) {


              const arrayStart = html.indexOf('[', markerIndex)



              if (arrayStart >= 0) {


                let depth = 0


                let inString = false


                let escaped = false


                let arrayEnd = -1



                for (let i = arrayStart; i < html.length; i++) {


                  const ch = html[i]



                  if (escaped) {


                    escaped = false


                    continue


                  }



                  if (ch === '\\') {


                    escaped = true


                    continue


                  }



                  if (ch === '"') {


                    inString = !inString


                    continue


                  }



                  if (inString) continue



                  if (ch === '[') depth++


                  if (ch === ']') depth--



                  if (depth === 0) {


                    arrayEnd = i + 1


                    break


                  }


                }



                if (arrayEnd > arrayStart) {


                  try {


                    const items = JSON.parse(html.slice(arrayStart, arrayEnd))



                    return items


                      .map((item: any, index: number) => {


                        const content = String(item.text || '').replace(/\s+/g, ' ').trim()


                        if (!content) return null



                        const ratingValue = Number(item.rating || item.ratingValue || item.ratingData?.ratingValue || 0) || null



                        return {


                          externalMentionId: item.reviewId || `yandex-json-${targetId || 'target'}-${index}`,


                          url: externalUrl,


                          title: null,

                          author: item.author?.name || item.authorName || item.user?.name || null,


                          content,


                          publishedAt: item.updatedTime || item.date || item.createdTime || item.publishTime || item.time || null,


                          ratingValue


                        }


                      })


                      .filter(Boolean)


                  } catch (e) {




                  }


                }


              }


            }


          }



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
            .filter((item) => item.content && item.content.trim().length >= 2)
            .slice(0, 50)
        },
        { externalUrl: normalizedUrl, targetId: target.id }
      )

      const visibleTextReviews = await page.evaluate(
        ({ externalUrl, targetId }: { externalUrl: string; targetId?: string }) => {
          const clean = (value: unknown) => String(value || '').replace(/\s+/g, ' ').trim()

          const monthNames = [
            'января',
            'февраля',
            'марта',
            'апреля',
            'мая',
            'июня',
            'июля',
            'августа',
            'сентября',
            'октября',
            'ноября',
            'декабря'
          ]

          const dateRe = new RegExp(
            `^(сегодня|вчера|\\d{1,2}\\s+(${monthNames.join('|')})(\\s+\\d{4})?)$`,
            'i'
          )

          const isMetaLine = (line: string) =>
            /лайк|отзыв|отзыва|отзывов|подписчик|подписчика|подписчиков|знаток города/i.test(line)

          const lines = String(document.body?.innerText || '')
            .split('\n')
            .map(clean)
            .filter(Boolean)

          const items: Array<{
            externalMentionId: string
            url: string
            title: null
            content: string
            author: string | null
            publishedAt: string | null
            ratingValue: null
          }> = []

          for (let i = 0; i < lines.length; i += 1) {
            if (lines[i] !== 'Подписаться') continue

            let dateIndex = -1

            for (let j = i + 1; j <= Math.min(i + 4, lines.length - 1); j += 1) {
              if (dateRe.test(lines[j])) {
                dateIndex = j
                break
              }
            }

            if (dateIndex < 0) continue

            let author: string | null = null

            for (let j = i - 1; j >= Math.max(0, i - 5); j -= 1) {
              const candidate = lines[j]
              if (!candidate || isMetaLine(candidate)) continue
              if (candidate === 'Посмотреть ответ организации') continue
              if (/^\\d+$/.test(candidate)) continue

              author = candidate
              break
            }

            const contentParts: string[] = []

            for (let j = dateIndex + 1; j < Math.min(lines.length, dateIndex + 10); j += 1) {
              const line = lines[j]
              if (!line) continue
              if (line === 'Подписаться') break
              if (line === 'Ещё') break
              if (line === 'Посмотреть ответ организации') break
              if (line === 'Написать отзыв') break
              if (/^123456$/.test(line)) break
              if (dateRe.test(line)) break
              if (/^Рейтинг\s+/i.test(line)) break
              if (/^\\d+$/.test(line)) break

              contentParts.push(line)

              if (contentParts.join(' ').length >= 500) break
            }

            const content = clean(contentParts.join(' '))
              .replace(/\s*Ещё\s*$/gi, '')
              .trim()

            if (content.length < 2) continue

            const rawId = `${targetId || 'target'}:${author || 'unknown'}:${lines[dateIndex]}:${content.slice(0, 80)}`
            const externalMentionId = `yandex-visible:${rawId}`

            items.push({
              externalMentionId,
              url: externalUrl,
              title: null,
              content,
              author,
              publishedAt: null,
              ratingValue: null
            })
          }

          return items
        },
        { externalUrl: normalizedUrl, targetId: target.id }
      )

      const combinedReviews = [...reviews]

      for (const item of visibleTextReviews) {
        const isDuplicate = combinedReviews.some((existing: any) => {
          const sameContent = String(existing?.content || '').trim() === String(item.content || '').trim()
          const sameAuthor = String(existing?.author || '').trim() === String(item.author || '').trim()

          return sameContent && sameAuthor
        })

        if (!isDuplicate) combinedReviews.push(item)
      }


      const sortedReviews = [...combinedReviews]
        .filter((item: any) => item?.content && String(item.content).trim().length >= 2)
        .sort((a: any, b: any) => {
          const aTime = a?.publishedAt ? new Date(a.publishedAt).getTime() : 0
          const bTime = b?.publishedAt ? new Date(b.publishedAt).getTime() : 0

          const safeATime = Number.isFinite(aTime) ? aTime : 0
          const safeBTime = Number.isFinite(bTime) ? bTime : 0

          return safeBTime - safeATime
        })
        .slice(0, 50)


      if (sortedReviews.length === 0) {
        await this.saveDebugSnapshot(page, 'zero-reviews', target.id)
        return []
      }

      return sortedReviews.map((item: {
        externalMentionId: string
        url?: string
        title?: string | null
        content: string
        author: string | null
        publishedAt: string | null
        ratingValue: number | null
      }) => {
        const parsedPublishedAt = item.publishedAt ? new Date(item.publishedAt) : new Date()
        const publishedAt = Number.isFinite(parsedPublishedAt.getTime()) ? parsedPublishedAt : new Date()

        return {
          externalMentionId: item.externalMentionId,
          url: item.url || normalizedUrl,
          title: item.title || null,
          content: item.content,
          author: item.author,
          publishedAt,
          ratingValue: item.ratingValue ?? null
        }
      })
    } catch (e) {
      throw e
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
