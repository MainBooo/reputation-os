import { chromium } from 'playwright'
import fs from 'fs'

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222')

  const context = browser.contexts()[0]
  const storage = await context.storageState()

  const path = '/opt/reputation-os/storage/vk-sessions/vk-session.json'
  fs.mkdirSync('/opt/reputation-os/storage/vk-sessions', { recursive: true })
  fs.writeFileSync(path, JSON.stringify(storage, null, 2))

  console.log('SAVED:', path)
}

main()
