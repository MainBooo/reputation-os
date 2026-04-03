import { chromium } from 'playwright'
import * as path from 'path'

async function main() {
  const targetUrl = process.argv[2] || 'https://vk.com/wall-201845544_4199'
  const storagePath = path.resolve('/opt/reputation-os/storage/vk-sessions/vk-session.json')

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  })

  const context = await browser.newContext({
    storageState: storagePath,
    viewport: { width: 1440, height: 1200 },
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  })

  const page = await context.newPage()

  try {
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    })

    await page.waitForTimeout(4000)

    const openSelectors = [
      'div.vkuiFlex__wrap > div:nth-child(4)',
      'button[aria-label*="Комментар"]',
      'button[aria-label*="комментар"]',
      'a[href*="reply="]'
    ]

    for (const selector of openSelectors) {
      try {
        const el = await page.$(selector)
        if (!el) continue
        await el.click({ timeout: 3000 }).catch(() => {})
        await page.waitForTimeout(2500)
      } catch {}
    }

    for (let i = 0; i < 6; i += 1) {
      await page.evaluate(() => {
        window.scrollBy(0, 1400)
      })
      await page.waitForTimeout(1200)
    }

    const selectors = [
      '[id^="-"]',
      '.reply',
      '.replies .reply',
      '.vkitComment',
      '[data-testid="comment"]',
      '.reply_text',
      '[data-testid="comment_text"]',
      '[class*="comment_text"]',
      '[class*="CommentText"]',
      '[class*="commentBody"]',
      'div.vkitComment__text',
      'div.vkitComment__contentWrapper'
    ]

    console.log('URL:', targetUrl)
    console.log('TITLE:', await page.title())
    console.log('--- COUNTS ---')

    for (const selector of selectors) {
      try {
        const count = await page.locator(selector).count()
        console.log(`${selector}: ${count}`)
      } catch (e: any) {
        console.log(`${selector}: ERROR ${e?.message || e}`)
      }
    }

    const rootSelector = '[id^="-"]'
    const rootCount = await page.locator(rootSelector).count().catch(() => 0)

    console.log(`\n--- ROOT SELECTOR: ${rootSelector} count=${rootCount} ---`)

    if (rootCount > 0) {
      const sample = await page.$$eval(rootSelector, (nodes) => {
        return nodes.slice(0, 10).map((node, index) => {
          const root = node as HTMLElement

          const candidates = [
            '.reply_text',
            '[data-testid="comment_text"]',
            '[class*="comment_text"]',
            '[class*="CommentText"]',
            '[class*="commentBody"]',
            'div.vkitComment__text',
            'div.vkitComment__contentWrapper',
            'a[href*="reply="]',
            'span',
            'div'
          ]

          const candidateData = candidates.map((sel) => {
            const el = root.querySelector(sel) as HTMLElement | null
            return {
              selector: sel,
              exists: Boolean(el),
              text: (el?.innerText || '').trim().slice(0, 300)
            }
          })

          const authorCandidates = [
            'a[href*="/id"]',
            'a[href^="/"]',
            '.author',
            '[class*="author"]'
          ]

          const authorData = authorCandidates.map((sel) => {
            const el = root.querySelector(sel) as HTMLElement | null
            return {
              selector: sel,
              exists: Boolean(el),
              text: (el?.innerText || '').trim().slice(0, 200)
            }
          })

          return {
            index,
            id: root.getAttribute('id') || null,
            className: root.className || null,
            rootText: (root.innerText || '').trim().slice(0, 500),
            candidateData,
            authorData,
            html: root.outerHTML.slice(0, 2000)
          }
        })
      })

      console.dir(sample, { depth: null, maxArrayLength: null })
    }
  } finally {
    await page.close().catch(() => {})
    await context.close().catch(() => {})
    await browser.close().catch(() => {})
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
