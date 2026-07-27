import { defineConfig, devices } from '@playwright/test'

// Гоняем против реального pm2-инстанса (тот же .next/standalone билд, что и
// прод), а не против отдельного dev-сервера — иначе тест ничего не скажет
// про реальное поведение прода.
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4011'

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] }
    },
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
