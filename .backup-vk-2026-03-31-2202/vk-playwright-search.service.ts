import { Injectable, Logger } from '@nestjs/common'
import { chromium } from 'playwright'
import { VkAuthSessionService } from './vk-auth-session.service'

type VkCommentResult = {
  commentId: string
  text: string
  author: string | null
  url: string
  publishedAt: Date
}

type VkPostResult = {
  ownerId: string
  postId: string
  url: string
  text: string
  author: string | null
  publishedAt: Date
  comments: VkCommentResult[]
  rawPayload: Record<string, unknown>
}

@Injectable()
export class VkPlaywrightSearchService {
  private readonly logger = new Logger(VkPlaywrightSearchService.name)

  constructor(
    private readonly vkAuthSessionService: VkAuthSessionService
  ) {}

  private parseWallIds(link: string): { ownerId: string; postId: string } | null {
    const match = link.match(/wall(-?\d+)_(\d+)/)
    if (!match) return null
    return { ownerId: match[1], postId: match[2] }
  }

  async searchPosts(queries: string[], workspaceId: string): Promise<VkPostResult[]> {
    const storageStatePath = await this.vkAuthSessionService.getStorageStatePath(workspaceId)

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    })

    const context = await browser.newContext(
      storageStatePath
        ? { storageState: storageStatePath }
        : {}
    )

    const page = await context.newPage()
    const results: VkPostResult[] = []
    const seenPostUrls = new Set<string>()

    try {
      for (const query of queries) {
        const searchUrl = `https://vk.com/search?c[q]=${encodeURIComponent(query)}&c[section]=posts`

        this.logger.log(`VK search start: ${query}`)
        this.logger.log(`VK search storageState: ${storageStatePath || 'NONE'}`)

        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await page.waitForTimeout(2500)

        try {
          await page.waitForSelector('a[href*="wall"]', { timeout: 15000 })
        } catch (error) {
          this.logger.warn(`VK search selector timeout for query "${query}"`)
        }

        for (let i = 0; i < 5; i += 1) {
          await page.mouse.wheel(0, 2000).catch(() => null)
          await page.waitForTimeout(1000)
        }

        const postUrls = await page.$$eval('a[href*="wall"]', (elements) => {
          return Array.from(
            new Set(
              elements
                .map((el) => (el as HTMLAnchorElement).href)
                .filter((href) => typeof href === 'string' && href.includes('wall'))
            )
          )
        }).catch(() => [])

        console.log('VK SEARCH LINKS:', postUrls.length)
        console.log('VK SEARCH SAMPLE:', JSON.stringify(postUrls.slice(0, 5)))

        for (const rawUrl of postUrls.slice(0, 20)) {
          const postUrl = rawUrl.startsWith('http') ? rawUrl : `https://vk.com${rawUrl}`
          if (seenPostUrls.has(postUrl)) continue
          seenPostUrls.add(postUrl)

          const ids = this.parseWallIds(postUrl)
          if (!ids) continue

          const detail = await context.newPage()
          const comments: VkCommentResult[] = []

          try {
            await detail.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
            await detail.waitForTimeout(2000)

            for (let i = 0; i < 4; i += 1) {
              await detail.mouse.wheel(0, 1800).catch(() => null)
              await detail.waitForTimeout(800)
            }

            const text =
              await detail.locator('.wall_post_text').first().innerText().catch(() => '') ||
              await detail.locator('[data-testid="post_view"] .wall_post_text').first().innerText().catch(() => '')

            const author =
              await detail.locator('.author').first().innerText().catch(() => null) ||
              await detail.locator('a.author').first().innerText().catch(() => null)

            const replyItems = detail.locator('.reply, [id^="reply"], .RepliesList .Reply')
            const replyCount = Math.min(await replyItems.count().catch(() => 0), 30)

            for (let j = 0; j < replyCount; j += 1) {
              const reply = replyItems.nth(j)

              const replyText =
                await reply.locator('.reply_text').innerText().catch(() => '') ||
                await reply.innerText().catch(() => '')

              if (!replyText.trim()) continue

              const rawId = await reply.getAttribute('id').catch(() => null)
              const commentId =
                rawId?.replace(/^reply/, '').replace(/^wpt/, '').trim() || `${ids.postId}_${j + 1}`

              const replyAuthor =
                await reply.locator('.reply_author').first().innerText().catch(() => null) ||
                await reply.locator('a').first().innerText().catch(() => null)

              comments.push({
                commentId,
                text: replyText,
                author: replyAuthor,
                url: `${postUrl}?reply=${commentId}`,
                publishedAt: new Date()
              })
            }

            results.push({
              ownerId: ids.ownerId,
              postId: ids.postId,
              url: postUrl,
              text,
              author,
              publishedAt: new Date(),
              comments,
              rawPayload: {
                query,
                ownerId: ids.ownerId,
                postId: ids.postId,
                url: postUrl,
                commentsCount: comments.length,
                usedStorageState: Boolean(storageStatePath)
              }
            })
          } catch (error) {
            this.logger.warn(`VK detail page failed for ${postUrl}: ${String(error)}`)
          } finally {
            await detail.close().catch(() => null)
          }
        }
      }
    } finally {
      await page.close().catch(() => null)
      await context.close().catch(() => null)
      await browser.close().catch(() => null)
    }

    return results
  }
}
