import { Injectable, Logger } from '@nestjs/common'
import { chromium, Browser, BrowserContext, Page } from 'playwright'
import * as path from 'path'
import { VkAuthSessionService } from './vk-auth-session.service'

export type VkComment = {
  commentId: string
  text: string
  url: string
  author?: string | null
  publishedAt?: Date | null
  rawPayload?: Record<string, unknown> | null
}

export type VkPostResult = {
  url: string
  postUrl: string
  ownerId: string
  postId: string
  text: string
  author?: string | null
  publishedAt?: Date | null
  rawPayload?: Record<string, unknown> | null
  comments: VkComment[]
}

@Injectable()
export class VkPlaywrightSearchService {
  private readonly logger = new Logger(VkPlaywrightSearchService.name)

  constructor(
    private readonly vkAuthSessionService: VkAuthSessionService
  ) {}

  private readonly storagePath = path.resolve(
    '/opt/reputation-os/storage/vk-sessions/vk-session.json'
  )

  private async resolveStorageStatePath(workspaceId?: string): Promise<string | null> {
    try {
      if (workspaceId) {
        const fromDb = await this.vkAuthSessionService.getStorageStatePath(workspaceId)
        if (fromDb) {
          this.logger.log(`VK SESSION: using workspace session ${fromDb}`)
          return fromDb
        }
      }
    } catch (e) {
      this.logger.warn(`VK SESSION: failed to load from DB: ${e instanceof Error ? e.message : e}`)
    }

    this.logger.warn('VK SESSION: no active VK session found')
    return null
  }

  private parsePostIds(url: string): { ownerId: string; postId: string } | null {
    const match = url.match(/wall(-?\d+)_(\d+)/)
    if (!match) return null
    return { ownerId: match[1], postId: match[2] }
  }

  private buildVkLaunchOptions() {
    return {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    }
  }

  private async safeClosePage(page: Page | null | undefined) {
    if (!page) return
    try {
      if (!page.isClosed()) {
        await page.close()
      }
    } catch {}
  }

  private cleanVkText(value: string | null | undefined): string {
    if (!value) return ''

    let text = value
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\u00A0/g, ' ')
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')

    const noisePatterns = [
      /Пожаловаться/gi,
      /Ответить/gi,
      /Поделиться/gi,
      /Поставить лайк/gi,
      /Сначала интересные/gi,
      /Сначала новые/gi,
      /Сначала старые/gi,
      /Показать ещё/gi,
      /Написать комментарий/gi
    ]

    for (const pattern of noisePatterns) {
      text = text.replace(pattern, ' ')
    }

    text = text
      .replace(/[ ]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n')
      .trim()

    return text
  }


  private parseVkPublishedAt(value: string | null | undefined): Date | null {
    const text = (value || '').trim().toLowerCase()
    if (!text) return null

    const months: Record<string, number> = {
      'янв': 0,
      'фев': 1,
      'мар': 2,
      'апр': 3,
      'мая': 4,
      'май': 4,
      'июн': 5,
      'июл': 6,
      'авг': 7,
      'сен': 8,
      'сент': 8,
      'окт': 9,
      'ноя': 10,
      'дек': 11
    }

    const absolute = text.match(/^(\d{1,2})\s+([а-яё]+)\s*(\d{4})?$/i)
    if (absolute) {
      const day = Number(absolute[1])
      const monthToken = absolute[2].slice(0, 4)
      const year = absolute[3] ? Number(absolute[3]) : new Date().getFullYear()

      let month: number | undefined = undefined
      for (const [key, value] of Object.entries(months)) {
        if (monthToken.startsWith(key)) {
          month = value
          break
        }
      }

      if (month !== undefined) {
        const dt = new Date(year, month, day, 0, 0, 0, 0)
        if (!Number.isNaN(dt.getTime())) return dt
      }
    }

    const todayTime = text.match(/^сегодня\s+в\s+(\d{1,2}):(\d{2})$/i)
    if (todayTime) {
      const now = new Date()
      const dt = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        Number(todayTime[1]),
        Number(todayTime[2]),
        0,
        0
      )
      if (!Number.isNaN(dt.getTime())) return dt
    }

    const yesterdayTime = text.match(/^вчера\s+в\s+(\d{1,2}):(\d{2})$/i)
    if (yesterdayTime) {
      const now = new Date()
      const dt = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
        Number(yesterdayTime[1]),
        Number(yesterdayTime[2]),
        0,
        0
      )
      if (!Number.isNaN(dt.getTime())) return dt
    }

    return null
  }

  private cleanVkCommentText(
    value: string | null | undefined,
    author?: string | null,
    ownerName?: string | null,
    publishedAtText?: string | null
  ): string {
    let text = this.cleanVkText(value)
      // remove zero-width chars
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // normalize spaces
      .replace(/\u00A0/g, ' ')
      // remove VK badge
      .replace(/Подтверждённый аккаунт/gi, '')
      // remove VK reply prefixes
      .replace(/^·\s*Автор\s+[^,\n]{1,80}[,:\s·\-—–]*/iu, '')
      .replace(/^·\s*Сообществу\s+[^,\n]{1,120}[,:\s·\-—–]*/iu, '')
      .replace(/^(?:Сообществу\s+){2,}/iu, '')
      // remove ownerName prefix like "ALLERGIA\n,"
      .replace(/^[^\n]{2,50}\n,\s*/g, '')
      // remove leading commas/spaces
      .replace(/^[,.;:!·\-—–\s]+/u, '')
      // normalize newlines
      .replace(/\n+/g, ' ')
      // collapse spaces
      .replace(/[ ]{2,}/g, ' ')
      .trim()

    const cleanAuthor = this.cleanVkText(author || '')
    const cleanOwnerName = this.cleanVkText(ownerName || '')
    const cleanPublishedAtText = this.cleanVkText(publishedAtText || '')

    if (!text) return ''

    const escapeRegExp = (input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    const isVkDateLike = (input: string) => {
      if (!input) return false
      if (/^(сегодня|вчера)$/i.test(input)) return true
      if (/^(сегодня|вчера)\s+в\s+\d{1,2}:\d{2}$/i.test(input)) return true
      if (/^\d{1,2}:\d{2}$/i.test(input)) return true
      if (/^\d{1,2}\s+[а-яё]{3,}(\s+\d{4})?(\s+в\s+\d{1,2}:\d{2})?$/i.test(input)) return true
      if (/^\d{1,2}\s+[а-яё]{3,}\.?$/i.test(input)) return true
      if (/^\d{1,2}\s+[а-яё]{3,}\s+в$/i.test(input)) return true
      return false
    }

    const uniqueLines: string[] = []
    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim()
      if (!line) continue
      if (uniqueLines[uniqueLines.length - 1] === line) continue
      uniqueLines.push(line)
    }

    const lines = uniqueLines.filter((line) => {
      if (!line) return false
      if (cleanAuthor && line === cleanAuthor) return false
      if (cleanOwnerName && line === cleanOwnerName) return false
      if (cleanPublishedAtText && line === cleanPublishedAtText) return false
      if (/^Автор$/i.test(line)) return false
      if (/^Сообществу$/i.test(line)) return false
      if (/^ответить$/i.test(line)) return false
      if (/^поделиться$/i.test(line)) return false
      if (/^пожаловаться$/i.test(line)) return false
      if (/^ещё\s*\d+\s*ответ/i.test(line)) return false
      if (/^\d+$/i.test(line)) return false
      if (isVkDateLike(line)) return false
      if (/^[·,.;:!\-—–]+$/u.test(line)) return false
      return true
    })

    text = lines.join('\n').trim()

    for (const candidate of [cleanAuthor, cleanOwnerName]) {
      if (!candidate) continue
      const escapedCandidate = escapeRegExp(candidate)
      text = text
        .replace(new RegExp(`^${escapedCandidate}[,:\s·\-—–]*`, 'i'), '')
        .replace(new RegExp(`^Автор\s+${escapedCandidate}[,:\s·\-—–]*`, 'i'), '')
        .replace(new RegExp(`^${escapedCandidate}\\n\s*,\s*`, 'i'), '')
        .replace(new RegExp(`^${escapedCandidate}\s*,\s*`, 'i'), '')
        .trim()
    }

    text = text
      .replace(/^·\s*Автор\s+[^,\n]{1,80}[,:\s·\-—–]*/iu, '')
      .replace(/^·\s*Сообществу\s+[^,\n]{1,120}[,:\s·\-—–]*/iu, '')
      .replace(/^(?:Сообществу\s+){2,}/iu, '')
      .replace(/^Автор\s+/i, '')
      .replace(/^Сообществу\s*/i, '')
      .replace(/^Ответить\s*/i, '')
      .replace(/^Поделиться\s*/i, '')
      .replace(/^Пожаловаться\s*/i, '')
      .replace(/^[^\n,]{2,80}\s*[·•]\s*/u, '')
      .replace(/^[,.;:!·\-—–\s]+/u, '')
      .replace(/\s+\d{1,2}\s+[а-яё]{3,}(\s+\d{4})?(\s+в\s+\d{1,2}:\d{2})?(\s+\d+)?$/i, '')
      .replace(/\s+\d{1,2}\s+[а-яё]{3,}\s+в$/i, '')
      .replace(/\s+(сегодня|вчера)(\s+в\s+\d{1,2}:\d{2})?(\s+\d+)?$/i, '')
      .replace(/\s+\d{1,2}:\d{2}(\s+\d+)?$/i, '')
      .replace(/^(?:[A-Za-zА-Яа-яЁё0-9_.\- ]{2,60}),\s+/u, '')
      .replace(/[ ]{2,}/g, ' ')
      .trim()

    if (cleanPublishedAtText && text === cleanPublishedAtText) {
      return ''
    }

    if (cleanAuthor && text === cleanAuthor) {
      return ''
    }

    if (cleanOwnerName && text === cleanOwnerName) {
      return ''
    }

    if (isVkDateLike(text)) {
      return ''
    }

    if (/^[,.;:!\-—–·\s]*$/u.test(text)) {
      return ''
    }

    return text
  }

  private async openSearchPage(page: Page, query: string) {
    await page.goto('https://vk.com/search/statuses', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    })

    await page.waitForTimeout(2500)

    const selectors = [
      '#search-\\:rm\\:',
      'input[type="search"]',
      'input[type="text"]'
    ]

    let filled = false

    for (const selector of selectors) {
      const input = await page.$(selector)
      if (!input) continue

      try {
        await input.click({ timeout: 5000 })
        await input.fill('')
        await input.fill(query)
        await page.keyboard.press('Enter')
        filled = true
        break
      } catch {}
    }

    if (!filled) {
      throw new Error('VK search input not found')
    }

    await page.waitForTimeout(5000)
  }

  private async autoScrollSearchResults(page: Page) {
    let previousHeight = 0

    for (let i = 0; i < 12; i += 1) {
      try {
        const currentHeight = await page.evaluate(() => {
          const el = document.scrollingElement || document.documentElement || document.body
          return el.scrollHeight
        })

        await page.evaluate(() => {
          const el = document.scrollingElement || document.documentElement || document.body
          el.scrollTo({ top: el.scrollHeight, behavior: 'instant' as ScrollBehavior })
        })

        await page.waitForTimeout(1800)

        const nextHeight = await page.evaluate(() => {
          const el = document.scrollingElement || document.documentElement || document.body
          return el.scrollHeight
        })

        this.logger.log(`VK SEARCH SCROLL: step=${i + 1} height=${currentHeight} -> ${nextHeight}`)

        if (nextHeight <= previousHeight || nextHeight === currentHeight) {
          break
        }

        previousHeight = nextHeight
      } catch (e: any) {
        this.logger.warn(`VK SEARCH SCROLL ERROR: ${e?.message || e}`)
        break
      }
    }
  }

  private async collectSearchLinks(page: Page): Promise<string[]> {
    const priorityLinks = await page.$$eval(
      'a[data-testid="post_date_block_preview"][href*="/wall"]',
      (els) => {
        const normalizeWallUrl = (href: string): string | null => {
          const normalized = href.startsWith('http') ? href : `https://vk.com${href}`
          return normalized.match(/https:\/\/vk\.com\/wall-?\d+_\d+/)?.[0] || null
        }

        const extractPositiveInt = (value: string | null | undefined): number => {
          const text = String(value || '').replace(/\s+/g, '')
          if (!text) return 0
          const match = text.match(/\d+/)
          return match ? Number(match[0]) : 0
        }

        const getCommentCountFromCard = (anchor: Element): number => {
          let node: Element | null = anchor

          for (let level = 0; level < 8 && node; level += 1) {
            const selectors = [
              'div.vkuiFlex__host.vkuiFlex__wrap.vkuiRootComponent__host > div:nth-child(4) > span[class*="vkitPostFooterAction__label"]',
              'div[class*="vkuiFlex__wrap"] > div:nth-child(4) > span[class*="vkitPostFooterAction__label"]',
              'div:nth-child(4) > span[class*="vkitPostFooterAction__label"]'
            ]

            for (const selector of selectors) {
              const el = node.querySelector(selector)
              const count = extractPositiveInt(el?.textContent)
              if (count > 0) return count
            }

            node = node.parentElement
          }

          return 0
        }

        const out: string[] = []
        const seen = new Set<string>()

        for (const el of els) {
          const href = (el as HTMLAnchorElement).getAttribute('href') || ''
          const wallUrl = normalizeWallUrl(href)
          if (!wallUrl || seen.has(wallUrl)) continue

          const commentCount = getCommentCountFromCard(el)
          if (commentCount <= 0) continue

          seen.add(wallUrl)
          out.push(wallUrl)
        }

        return out
      }
    ).catch(() => [])

    if (priorityLinks.length) {
      return priorityLinks
    }

    return []
  }

  private async extractPostText(page: Page): Promise<string> {
    const selectors = [
      '[data-testid="post_message"]',
      '.wall_post_text',
      '.vkitPost__text',
      '.pi_text',
      '.PostContentText',
      'div[class*="post_text"]'
    ]

    for (const selector of selectors) {
      try {
        const allTexts = await page.$$eval(selector, (nodes) =>
          nodes
            .map((n) => ((n as HTMLElement).innerText || '').trim())
            .filter(Boolean)
        )

        const best = allTexts
          .map((text) => text.trim())
          .sort((a, b) => b.length - a.length)[0]

        if (best) {
          const cleaned = this.cleanVkText(best)
          if (cleaned && cleaned.length > 3) {
            return cleaned
          }
        }
      } catch {}
    }

    try {
      const title = await page.title()
      return this.cleanVkText(title)
    } catch {
      return ''
    }
  }

  private async extractCommentBlocks(page: Page): Promise<VkComment[]> {
    const commentSelectors = [
      '[data-testid^="wall_comments_comment"]',
      'div[class*="vkitCommentBase__root"]',
      'div[class*="vkitComment__root"]',
      '[id^="-"]',
      '.replies .reply',
      '.vkitComment',
      '[data-testid="comment"]'
    ]

    for (const selector of commentSelectors) {
      try {
        const count = await page.locator(selector).count()
        if (!count) continue

        const comments = await page.$$eval(selector, (nodes) => {
          return nodes
            .map((node, index) => {
              const root = node as HTMLElement
              const id = root.getAttribute('id') || ''

              const text = (root.innerText || '').trim()
              if (!text) return null

              const authorEl =
                root.querySelector('a[href*="/id"]') ||
                root.querySelector('.author') ||
                root.querySelector('[class*="author"]')

              const ownerEl =
                root.querySelector('[class*="OwnerName"]') ||
                root.querySelector('[class*="ownerName"]') ||
                root.querySelector('h4 a')

              const replyLink = root.querySelector('a[href*="reply="]') as HTMLAnchorElement | null
              const replyHref = replyLink?.getAttribute('href') || ''
              const rawIdMatch = id.match(/(\d+)$/)
              const replyIdMatch = replyHref.match(/reply=(\d+)/)

              const dateEl =
                root.querySelector('span[class*="vkitComment__date"] a') ||
                root.querySelector('[class*="vkitComment__date"] a') ||
                root.querySelector('[class*="date"] a')

              const publishedAt =
                (dateEl && (dateEl as HTMLElement).innerText.trim()) || null

              const commentId =
                (rawIdMatch ? rawIdMatch[1] : null) ||
                (replyIdMatch ? replyIdMatch[1] : null)

              if (!commentId) return null

              return {
                commentId,
                text,
                author: ((authorEl as HTMLElement | null)?.innerText || '').trim() || null,
                ownerName: ((ownerEl as HTMLElement | null)?.innerText || '').trim() || null,
                publishedAt
              }
            })
            .filter(Boolean) as Array<{
            commentId: string
            text: string
            author: string | null
            ownerName: string | null
            publishedAt: string | null
          }>
        })

        if (comments.length) {
          const cleaned = comments
            .map((comment) => {
              const ownerName = comment.ownerName ? this.cleanVkText(comment.ownerName) : null
              const authorBase = comment.author ? this.cleanVkText(comment.author) : null
              const author = authorBase || ownerName || null

              let text = this.cleanVkCommentText(
                comment.text,
                author,
                ownerName,
                comment.publishedAt
              )

              if (ownerName) {
                const escapedOwner = ownerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                text = text
                  .replace(new RegExp(`^${escapedOwner}\\s*`, 'i'), '')
                  .replace(new RegExp(`^${escapedOwner}\\s*,\\s*`, 'i'), '')
                  .trim()
              }

              text = text
                .replace(/^,\s*/u, '')
                .replace(/[ ]{2,}/g, ' ')
                .trim()

              return {
                commentId: comment.commentId,
                text,
                url: page.url(),
                author,
                publishedAt: this.parseVkPublishedAt(comment.publishedAt),
                rawPayload: {
                  ownerName,
                  publishedAtText: comment.publishedAt || null
                }
              }
            })
            .filter((comment) => comment.text.length >= 2)

          if (cleaned.length) {
            return cleaned
          }
        }
      } catch {}
    }

    return []
  }

  private async expandMoreComments(page: Page) {
    for (let round = 0; round < 6; round += 1) {
      let clicked = 0

      const selectors = [
        'button',
        'a',
        '[role="button"]'
      ]

      for (const selector of selectors) {
        try {
          const elements = await page.$$(selector)

          for (const element of elements) {
            try {
              const text = ((await element.innerText().catch(() => '')) || '').trim()

              if (!text) continue

              const normalized = text.toLowerCase()

              const shouldClick =
                normalized.includes('показать ещё') ||
                normalized.includes('ещё комментар') ||
                normalized.includes('еще комментар') ||
                normalized.includes('ещё ответ') ||
                normalized.includes('еще ответ') ||
                normalized.includes('показать ответ') ||
                normalized.includes('показать предыдущ')

              if (!shouldClick) continue

              await element.click({ timeout: 2000 }).catch(() => {})
              await page.waitForTimeout(1200)
              clicked += 1
            } catch {}
          }
        } catch {}
      }

      this.logger.log(`VK EXPAND COMMENTS: round=${round + 1} clicked=${clicked}`)

      if (!clicked) {
        break
      }

      await page.evaluate(() => {
        window.scrollBy(0, 1200)
      }).catch(() => {})
      await page.waitForTimeout(1000)
    }
  }

  private async extractExplicitCommentCount(page: Page): Promise<number | null> {
    try {
      return await page.evaluate(() => {
        const extractPositiveInt = (value: string | null | undefined): number => {
          const text = String(value || '').replace(/\s+/g, '')
          if (!text) return 0
          const match = text.match(/\d+/)
          return match ? Number(match[0]) : 0
        }

        const nodes = Array.from(
          document.querySelectorAll('span[class*="vkitPostFooterAction__label"]')
        )

        const counts = nodes
          .map((n) => extractPositiveInt((n as HTMLElement).innerText))
          .filter((n) => n >= 0)

        // VK footer: [likes, shares, views, comments]
        if (counts.length >= 4) {
          return counts[3]
        }

        return null
      })
    } catch {
      return null
    }
  }

  private async hasCommentSignals(page: Page): Promise<boolean> {
    const selectors = [
      '[data-testid^="wall_comments_comment"]',
      'div[class*="vkitCommentBase__root"]',
      'div[class*="vkitComment__root"]',
      '[id^="-"]',
      'a[href*="reply="]',
      'button[aria-label*="Комментар"]',
      'button[aria-label*="комментар"]'
    ]

    for (const selector of selectors) {
      try {
        const count = await page.locator(selector).count()
        if (count > 0) {
          return true
        }
      } catch {}
    }

    try {
      const bodyText = await page.evaluate(() => {
        return (document.body?.innerText || '').slice(0, 12000)
      })

      if (/коммент/i.test(bodyText)) {
        return true
      }
    } catch {}

    return false
  }

  private async openCommentsIfNeeded(page: Page) {
    const openSelectors = [
      'div.vkuiFlex__wrap > div:nth-child(4)',
      'button[aria-label*="Комментар"]',
      'button[aria-label*="комментар"]',
      'a[href*="reply="]'
    ]

    for (const selector of openSelectors) {
      try {
        const btn = await page.$(selector)
        if (!btn) continue
        await btn.click({ timeout: 5000 }).catch(() => {})
        await page.waitForTimeout(2500)
        return
      } catch {}
    }
  }

  async searchPosts(
    queries: string[],
    workspaceId: string,
    companyId: string
  ): Promise<VkPostResult[]> {
    const results: VkPostResult[] = []
    const visited = new Set<string>()
    const maxPostsPerQuery = 12

    let browser: Browser | null = null
    let context: BrowserContext | null = null
    let page: Page | null = null

    try {
      browser = await chromium.launch(this.buildVkLaunchOptions())
      browser.on('disconnected', () => {
        this.logger.log('VK browser closed')
      })

      const storageStatePath = await this.resolveStorageStatePath(workspaceId)
      if (!storageStatePath) {
        throw new Error('VK session is not connected')
      }

      context = await browser.newContext({
        storageState: storageStatePath,
        viewport: { width: 1440, height: 1200 },
        userAgent:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      })

      page = await context.newPage()

      for (const query of queries) {
        try {
          if (!browser.isConnected()) {
            throw new Error('browser disconnected before query')
          }

          this.logger.log(`VK SEARCH START: ${query}`)

          await this.openSearchPage(page, query)
          await this.autoScrollSearchResults(page)

          const links = await this.collectSearchLinks(page)
          const limitedLinks = links.slice(0, maxPostsPerQuery)

          this.logger.log(
            `VK LINKS FOUND: ${links.length}; PROCESSING: ${limitedLinks.length}`
          )

          for (const href of limitedLinks) {

            if (!href) continue
            if (visited.has(href)) continue

            visited.add(href)

            let postPage: Page | null = null

            try {
              if (!browser.isConnected()) {
                throw new Error('browser disconnected before post')
              }

              const ids = this.parsePostIds(href)
              if (!ids) continue

              postPage = await context.newPage()
              

              await postPage.goto(href, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
              })

              await postPage.waitForTimeout(3000)

              // === FAST COMMENT PRESENCE CHECK ===
              const hasRealComments = await postPage.evaluate(() => {
                const hasNodes =
                  document.querySelector('[data-testid^="wall_comments_comment"]') ||
                  document.querySelector('div[class*="vkitComment"]') ||
                  document.querySelector('a[href*="reply="]')

                return Boolean(hasNodes)
              })

              if (!hasRealComments) {
                // быстрый skip без тяжёлого парсинга
                await this.safeClosePage(postPage)
                continue
              }

              const postText = await this.extractPostText(postPage)

              const hasCommentSignals = await this.hasCommentSignals(postPage)
              if (!hasCommentSignals) {
                this.logger.log(`VK POST SKIP: ${href} no comment signals`)
                await this.safeClosePage(postPage)
                continue
              }

              await this.openCommentsIfNeeded(postPage)
              await this.expandMoreComments(postPage)

              const comments = await this.extractCommentBlocks(postPage)

              this.logger.log(`VK POST CHECK: ${href} comments=${comments.length}`)

              if (!comments.length) {
                this.logger.log(`VK POST SKIP: ${href} extracted comments=0`)
                await this.safeClosePage(postPage)
                continue
              }

              results.push({
                url: href,
                postUrl: href,
                ownerId: ids.ownerId,
                postId: ids.postId,
                text: postText,
                author: null,
                publishedAt: null,
                rawPayload: {
                  source: 'playwright',
                  query,
                  workspaceId,
                  companyId
                },
                comments
              })

              await this.safeClosePage(postPage)

              // === THROTTLE (anti-crash) ===
              await page.waitForTimeout(1200)

            } catch (e: any) {
              this.logger.warn(`POST ERROR: ${e?.message || e}`)
              await this.safeClosePage(postPage)
              continue
            }
          }
        } catch (e: any) {
          this.logger.error(`QUERY ERROR (${query}): ${e?.message || e}`)
          continue
        }
      }
    } catch (e: any) {
      this.logger.error(`FATAL: ${e?.message || e}`)
    } finally {
      try {
        if (page && !page.isClosed()) await page.close()
      } catch {}
      try {
        if (context) await context.close()
      } catch {}
      try {
        if (browser && browser.isConnected()) await browser.close()
      } catch {}
    }

    return results
  }
}
