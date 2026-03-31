import { chromium } from 'playwright'
import fs from 'fs'

async function main() {
  const browser = await chromium.launch({
    headless: false,
  })

  const context = await browser.newContext({
    storageState: '/tmp/vk-profile/Default/Storage/ext/state.json'
  })

  const page = await context.newPage()
  await page.goto('https://vk.com')

  const storage = await context.storageState()

  const path = '/opt/reputation-os/storage/vk-sessions/vk-session.json'
  fs.mkdirSync('/opt/reputation-os/storage/vk-sessions', { recursive: true })
  fs.writeFileSync(path, JSON.stringify(storage, null, 2))

  console.log('SAVED:', path)

  await browser.close()
}

main()
