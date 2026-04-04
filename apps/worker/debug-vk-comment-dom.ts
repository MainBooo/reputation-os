import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

async function main() {
  const postUrl = process.argv[2] || 'https://vk.com/wall-201845544_4199'
  const storageState = '/opt/reputation-os/storage/vk-sessions/vk-session.json'
  const outDir = '/opt/reputation-os/apps/worker/tmp'
  mkdirSync(outDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  })

  const context = await browser.newContext({
    storageState
  })

  const page = await context.newPage()

  await page.goto(postUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })

  await page.waitForTimeout(5000)

  const expandTexts = [
    'Показать ещё',
    'Показать комментарии',
    'Показать ответы',
    'Ещё комментарии',
    'ещё'
  ]

  for (let round = 0; round < 5; round += 1) {
    const clicked = await page.evaluate((texts) => {
      let count = 0
      const nodes = Array.from(document.querySelectorAll('button, a, div[role="button"]'))
      for (const node of nodes) {
        const text = ((node as HTMLElement).innerText || '').trim()
        if (!text) continue
        if (!texts.some((x) => text.toLowerCase().includes(x.toLowerCase()))) continue
        ;(node as HTMLElement).click()
        count += 1
      }
      return count
    }, expandTexts)

    if (!clicked) break
    await page.waitForTimeout(1200)
  }

  const data = await page.evaluate(() => {
    const selectors = [
      '[data-testid^="wall_comments_comment"]',
      'div[class*="vkitCommentBase__root"]',
      'div[class*="vkitComment__root"]',
      '[id^="-"]'
    ]

    const roots: Element[] = []
    const seen = new Set<Element>()

    for (const selector of selectors) {
      for (const el of Array.from(document.querySelectorAll(selector))) {
        if (seen.has(el)) continue
        const text = ((el as HTMLElement).innerText || '').trim()
        if (!text) continue
        seen.add(el)
        roots.push(el)
      }
    }

    const sample = roots.slice(0, 12).map((root, index) => {
      const children = Array.from(root.querySelectorAll('*'))
        .slice(0, 60)
        .map((el) => {
          const h = el as HTMLElement
          const text = (h.innerText || '').trim()
          return {
            tag: el.tagName.toLowerCase(),
            className: h.className || '',
            id: h.id || '',
            href: (el as HTMLAnchorElement).getAttribute?.('href') || '',
            dataTestId: h.getAttribute('data-testid'),
            text: text.length > 200 ? text.slice(0, 200) : text
          }
        })
        .filter((x) => x.text || x.href || x.dataTestId || x.id)

      return {
        index,
        rootTag: root.tagName.toLowerCase(),
        rootId: (root as HTMLElement).id || '',
        rootClass: (root as HTMLElement).className || '',
        rootDataTestId: (root as HTMLElement).getAttribute('data-testid'),
        innerText: ((root as HTMLElement).innerText || '').trim(),
        outerHTML: root.outerHTML.slice(0, 12000),
        children
      }
    })

    return {
      url: location.href,
      count: roots.length,
      sample
    }
  })

  const file = join(outDir, 'vk-comment-dom.json')
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')

  console.log('DOM_DUMP_FILE:', file)
  console.log('COMMENT_ROOTS:', data.count)
  console.log('SAMPLED:', data.sample.length)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
