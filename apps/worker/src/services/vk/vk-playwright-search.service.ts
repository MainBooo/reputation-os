import { Injectable, Logger } from '@nestjs/common'
import { chromium, Browser, BrowserContext, Page } from 'playwright'
import * as path from 'path'

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

  private readonly storagePath = path.resolve(
    '/opt/reputation-os/storage/vk-sessions/vk-session.json'
  )

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

  private normalizeWallUrl(href: string): string | null {
    if (!href) return null
    const full = href.startsWith('http') ? href : `https://vk.com${href}`
    const match = full.match(/https:\/\/vk\.com\/wall-?\d+_\d+/)
    return match ? match[0] : null
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

  private async collectSearchLinks(page: Page): Promise<string[]> {
    const selectors = [
      'a[href*="/wall"]',
      '#spa_layout_content a[href*="/wall"]',
      'main a[href*="/wall"]'
    ]

    const out = new Set<string>()

    for (const selector of selectors) {
      try {
        const hrefs = await page.$$eval(selector, (els) =>
          els
            .map((e) => (e as HTMLAnchorElement).getAttribute('href') || '')
            .filter(Boolean)
        )

        for (const href of hrefs) {
          const normalized = href
            ? (href.startsWith('http') ? href : `https://vk.com${href}`)
            : null

          const wallUrl = normalized ? normalized.match(/https:\/\/vk\.com\/wall-?\d+_\d+/)?.[0] : null
          if (wallUrl) out.add(wallUrl)
        }
      } catch {}
    }

    return Array.from(out)
  }

  private async extractPostText(page: Page): Promise<string> {
    const selectors = [
      'div[data-testid="post_message"]',
      '.wall_post_text',
      '.vkitPost__text',
      '.pi_text',
      'article'
    ]

    for (const selector of selectors) {
      try {
        const el = await page.$(selector)
        if (!el) continue
        const text = (await el.innerText()).trim()
        if (text) return text
      } catch {}
    }

    return ''
  }

  private async extractCommentBlocks(page: Page): Promise<VkComment[]> {
    const commentSelectors = [
      '[id^="-"]',
      '.replies .reply',
      '.vkitComment'
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
              const textEl =
                root.querySelector('div.vkitComment__contentWrapper') ||
                root.querySelector('.reply_text') ||
                root.querySelector('[data-testid="comment_text"]') ||
                root

              const authorEl =
                root.querySelector('a[href*="/id"]') ||
                root.querySelector('a[href^="/"]') ||
                root.querySelector('.author')

              const text = (textEl?.textContent || '').trim()
              if (!text) return null

              const rawIdMatch = id.match(/(\d+)$/)
              const commentId = rawIdMatch ? rawIdMatch[1] : String(index + 1)

              return {
                commentId,
                text,
                author: (authorEl?.textContent || '').trim() || null
              }
            })
            .filter(Boolean) as Array<{
              commentId: string
              text: string
              author: string | null
            }>
        })

        if (comments.length) {
          return comments.map((comment) => ({
            commentId: comment.commentId,
            text: comment.text,
            url: page.url(),
            author: comment.author,
            publishedAt: null,
            rawPayload: null
          }))
        }
      } catch {}
    }

    return []
  }

  private async openCommentsIfNeeded(page: Page) {
    const openSelectors = [
      'div.vkuiFlex__wrap > div:nth-child(4)',
      'button[aria-label*="Комментар"]',
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

    let browser: Browser | null = null
    let context: BrowserContext | null = null
    let page: Page | null = null

    try {
      browser = await chromium.launch(this.buildVkLaunchOptions())
      browser.on('disconnected', () => {
        this.logger.warn('VK browser disconnected unexpectedly')
      })

      context = await browser.newContext({
        storageState: this.storagePath,
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

          const links = await this.collectSearchLinks(page)
          this.logger.log(`VK LINKS FOUND: ${links.length}`)

          for (const href of links) {
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

              const postText = await this.extractPostText(postPage)

              await this.openCommentsIfNeeded(postPage)

              const comments = await this.extractCommentBlocks(postPage)

              this.logger.log(`VK POST CHECK: ${href} comments=${comments.length}`)

              if (!comments.length) {
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
