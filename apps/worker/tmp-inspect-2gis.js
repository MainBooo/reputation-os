const { chromium } = require('playwright')

const url = process.env.TWOGIS_URL || process.argv[2]

if (!url) {
  throw new Error('Usage: TWOGIS_URL="https://2gis.ru/..." node tmp-inspect-2gis.js')
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

async function main() {
  console.log('TWOGIS_INSPECT_START', { url })

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  })

  const page = await browser.newPage({
    viewport: { width: 1440, height: 1200 },
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  })

  const responses = []

  page.on('response', async (response) => {
    const responseUrl = response.url()
    const contentType = response.headers()['content-type'] || ''

    if (
      responseUrl.includes('review') ||
      responseUrl.includes('reviews') ||
      responseUrl.includes('branch') ||
      responseUrl.includes('firm') ||
      responseUrl.includes('rubric') ||
      contentType.includes('json')
    ) {
      responses.push({
        url: responseUrl.slice(0, 320),
        status: response.status(),
        contentType
      })
    }
  })

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(8000)

  for (let i = 0; i < 12; i += 1) {
    await page.mouse.wheel(0, 900)
    await page.waitForTimeout(800)
  }

  const title = await page.title().catch(() => '')
  const finalUrl = page.url()
  const bodyText = clean(await page.locator('body').innerText({ timeout: 5000 }).catch(() => ''))

  const data = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script'))
      .map((script) => script.textContent || '')
      .filter(Boolean)

    const reviewLikeScripts = scripts
      .filter((text) => /review|отзыв|rating|ratingValue|author|rubric|firm|branch/i.test(text))
      .slice(0, 8)
      .map((text) => text.slice(0, 2500))

    const nodes = Array.from(document.querySelectorAll('article, [class], [data-testid], [itemprop]'))
      .map((node) => {
        const el = node
        const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
        const cls = el.getAttribute('class') || ''
        const testId = el.getAttribute('data-testid') || ''
        const itemprop = el.getAttribute('itemprop') || ''
        return { tag: el.tagName, cls, testId, itemprop, text }
      })
      .filter((item) => item.text.length >= 20)
      .filter((item) =>
        /отзыв|рейтинг|оцен|звезд|звёзд|читать|ещё|еще|rating|review|комментар/i.test(
          item.text + ' ' + item.cls + ' ' + item.testId + ' ' + item.itemprop
        )
      )
      .slice(0, 120)

    const microdata = Array.from(document.querySelectorAll('[itemprop]'))
      .map((node) => {
        const el = node
        return {
          tag: el.tagName,
          itemprop: el.getAttribute('itemprop'),
          content: el.getAttribute('content'),
          text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500)
        }
      })
      .slice(0, 160)

    return {
      locationHref: location.href,
      reviewLikeScripts,
      nodes,
      microdata
    }
  })

  console.log('\n===== PAGE =====')
  console.log(JSON.stringify({ title, finalUrl, bodyTextLength: bodyText.length }, null, 2))

  console.log('\n===== BODY TEXT SAMPLE =====')
  console.log(bodyText.slice(0, 6000))

  console.log('\n===== REVIEW-LIKE NETWORK RESPONSES =====')
  console.log(JSON.stringify(responses.slice(0, 120), null, 2))

  console.log('\n===== REVIEW-LIKE DOM NODES =====')
  console.log(JSON.stringify(data.nodes, null, 2))

  console.log('\n===== MICRODATA =====')
  console.log(JSON.stringify(data.microdata, null, 2))

  console.log('\n===== REVIEW-LIKE SCRIPTS SAMPLE =====')
  console.log(JSON.stringify(data.reviewLikeScripts, null, 2))

  await page.screenshot({ path: '/tmp/2gis-inspect.png', fullPage: true }).catch(() => null)
  console.log('\nSCREENSHOT=/tmp/2gis-inspect.png')

  await browser.close()
}

main().catch((error) => {
  console.error('TWOGIS_INSPECT_FAILED', error)
  process.exit(1)
})
