import { chromium } from 'playwright'
import * as path from 'path'

async function dumpCommentState(page: any, label: string) {
  console.log(`\n=== ${label} ===`)

  const counts = await page.evaluate(() => {
    const selectors = [
      '[data-testid^="wall_comments_comment"]',
      'div[class*="vkitCommentBase__root"]',
      'div[class*="vkitComment__root"]',
      '[id^="-"]',
      'a[href*="reply="]',
      'button[aria-label*="Комментар"]',
      'button[aria-label*="комментар"]',
      'a',
      'button',
      '[role="button"]'
    ]

    const out: Record<string, number> = {}

    for (const selector of selectors) {
      try {
        out[selector] = document.querySelectorAll(selector).length
      } catch {
        out[selector] = -1
      }
    }

    return out
  })

  console.log('COUNTS:', counts)

  const commentCandidates = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('a, button, [role="button"]')) as HTMLElement[]

    return nodes
      .map((el) => {
        const text = (el.innerText || '').trim()
        const aria = el.getAttribute('aria-label') || ''
        const href = (el as HTMLAnchorElement).getAttribute?.('href') || ''
        const testid = el.getAttribute('data-testid') || ''
        const cls = String(el.className || '')
        const html = el.outerHTML.slice(0, 800)

        return {
          tag: el.tagName,
          text,
          aria,
          href,
          testid,
          className: cls,
          html
        }
      })
      .filter((item) => {
        const blob = `${item.text} ${item.aria} ${item.href} ${item.testid} ${item.className}`.toLowerCase()
        return (
          blob.includes('коммент') ||
          blob.includes('comment') ||
          blob.includes('reply') ||
          blob.includes('ответ') ||
          /^\d+\s+(коммент|комментар)/i.test(item.text) ||
          /^\d+\s+(comment|comments)/i.test(item.text)
        )
      })
      .slice(0, 50)
  })

  console.log('COMMENT LINK CANDIDATES:')
  console.dir(commentCandidates, { depth: null, maxArrayLength: null })
}

async function main() {
  const targetUrl = process.argv[2]
  if (!targetUrl) {
    throw new Error('Usage: pnpm exec ts-node debug-vk-comment-link.ts <vk-post-url>')
  }

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

    await page.waitForTimeout(5000)

    await dumpCommentState(page, 'BEFORE CLICK')

    const clicked = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('a, button, [role="button"]')) as HTMLElement[]

      const scored = nodes
        .map((el) => {
          const text = (el.innerText || '').trim()
          const aria = el.getAttribute('aria-label') || ''
          const href = (el as HTMLAnchorElement).getAttribute?.('href') || ''
          const testid = el.getAttribute('data-testid') || ''
          const cls = String(el.className || '')
          const blob = `${text} ${aria} ${href} ${testid} ${cls}`.toLowerCase()

          let score = 0
          if (/\d+\s+(коммент|комментар)/i.test(text)) score += 100
          if (/\d+\s+(comment|comments)/i.test(text)) score += 100
          if (blob.includes('коммент')) score += 30
          if (blob.includes('comment')) score += 30
          if (blob.includes('reply')) score += 15
          if (blob.includes('ответ')) score += 15
          if (href.includes('reply=')) score += 10

          return { el, text, aria, href, testid, cls, score }
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)

      const best = scored[0]
      if (!best) return null

      best.el.click()

      return {
        text: best.text,
        aria: best.aria,
        href: best.href,
        testid: best.testid,
        className: best.cls,
        score: best.score
      }
    })

    console.log('\nCLICKED:', clicked)

    await page.waitForTimeout(4000)
    await dumpCommentState(page, 'AFTER CLICK')
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
