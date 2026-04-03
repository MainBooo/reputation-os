import { chromium } from 'playwright'
import * as path from 'path'

async function main() {
  const query = process.argv[2] || 'stereopeople'
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
    await page.goto('https://vk.com/search/statuses', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    })

    await page.waitForTimeout(3000)

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

    for (let i = 0; i < 5; i += 1) {
      await page.evaluate(() => {
        const el = document.scrollingElement || document.documentElement || document.body
        el.scrollTo({ top: el.scrollHeight, behavior: 'instant' as ScrollBehavior })
      })
      await page.waitForTimeout(1500)
    }

    const data = await page.$$eval('a[href*="/wall"]', (els) => {
      const normalizeWallUrl = (href: string): string | null => {
        const normalized = href.startsWith('http') ? href : `https://vk.com${href}`
        return normalized.match(/https:\/\/vk\.com\/wall-?\d+_\d+/)?.[0] || null
      }

      return els.slice(0, 40).map((el, index) => {
        const a = el as HTMLAnchorElement
        const href = a.getAttribute('href') || ''
        const wallUrl = normalizeWallUrl(href)

        const chain = []
        let cur: HTMLElement | null = a
        for (let depth = 0; depth < 6 && cur; depth += 1) {
          chain.push({
            depth,
            tag: cur.tagName,
            testid: cur.getAttribute('data-testid') || '',
            cls: String(cur.className || '').slice(0, 180),
            text: (cur.innerText || '').trim().slice(0, 300)
          })
          cur = cur.parentElement
        }

        return {
          index,
          href,
          wallUrl,
          text: (a.innerText || '').trim().slice(0, 200),
          chain
        }
      })
    })

    console.dir(data, { depth: null, maxArrayLength: null })
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
