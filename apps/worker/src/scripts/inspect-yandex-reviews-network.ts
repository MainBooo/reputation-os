import { chromium } from 'playwright'

async function main() {
  const url = process.argv[2] || 'https://yandex.ru/maps/org/placeholder/127042067973/reviews/'

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'ru-RU',
    viewport: { width: 1280, height: 900 }
  })

  const page = await context.newPage()

  page.on('response', async (response) => {
    const u = response.url()
    const l = u.toLowerCase()

    if (l.includes('review') || l.includes('business') || l.includes('127042067973')) {
      console.log('[RESPONSE]', response.status(), u)

      try {
        const body = await response.text()
        console.log('[BODY_PREVIEW]', body.slice(0, 600).replace(/\s+/g, ' '))
      } catch {}
    }
  })

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(15000)
  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
