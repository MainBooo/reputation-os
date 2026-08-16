import { test, expect, type Page } from '@playwright/test'

// Регрессия для бага "форма логина рендерится и тут же исчезает, остаётся
// пустой фон" на мобильном проде. Первопричины (см. итоговый отчёт):
//  1. .next/standalone был повреждён (MODULE_NOT_FOUND на каждый рендер);
//  2. (auth)/login/page.tsx редиректил на /dashboard по одному лишь ФАКТУ
//     наличия cookie accessToken, не проверяя её валидность;
//  3. (app)-сегмент не имел единой проверки сессии и Error Boundary, поэтому
//     невалидный токен приводил к "битому" /dashboard вместо чистого /login.

// Токен подписан локальным JWT_SECRET из apps/api/.env (dev-стенд, не боевой
// секрет) с истёкшим exp — годен только для детерминированного теста.
const EXPIRED_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW5hcWx4c2YwMDA0aWg5eXh0cHdyazY0IiwiZW1haWwiOiJtYXg5MnBvbGVAZ21haWwuY29tIiwiaWF0IjoxNzg1MTMwNzA2LCJleHAiOjE3ODUxMjcxMDZ9.KGc-gXFcXvCN2XNN-BhhMCuNCGxQCzlfeS7I0aeOvlk'
const MALFORMED_TOKEN = 'not-a-real-jwt-token'
const DEMO_EMAIL = 'demo@reputation.local'
const DEMO_PASSWORD = 'demo123'

async function clearClientState(page: Page) {
  await page.context().clearCookies()
  await page.addInitScript(() => {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {}
  })
}

async function setAccessTokenCookie(page: Page, token: string) {
  // _options is Playwright's internal BrowserContext state, not part of the
  // public typings — kept as a runtime-only cast rather than adding a new
  // public API dependency just to read the configured baseURL back out.
  const url = new URL((page.context() as any)._options.baseURL ?? 'http://127.0.0.1:4011')
  await page.context().addCookies([
    {
      name: 'accessToken',
      value: token,
      domain: url.hostname,
      path: '/',
      httpOnly: false,
      sameSite: 'Lax'
    }
  ])
}

function loginForm(page: Page) {
  return page.getByRole('heading', { name: 'Вход в систему' })
}

test.describe('Auth flow — форма логина никогда не остаётся пустым фоном', () => {
  test('новый неавторизованный пользователь видит форму логина и она не исчезает', async ({ page }) => {
    await clearClientState(page)
    await page.goto('/')

    await expect(loginForm(page)).toBeVisible()
    // Раньше форма рендерилась и пропадала "через долю секунды" — ждём с запасом.
    await page.waitForTimeout(1500)
    await expect(loginForm(page)).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('истёкшая cookie: сессия очищается, пользователь оказывается на форме логина, а не на пустом экране', async ({ page }) => {
    await clearClientState(page)
    await setAccessTokenCookie(page, EXPIRED_TOKEN)
    await page.goto('/')

    await expect(loginForm(page)).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(1000)
    await expect(loginForm(page)).toBeVisible()

    // Экран не должен быть пустым в процессе редиректа — тело документа
    // всегда содержит что-то, кроме голого фона.
    const bodyText = await page.locator('body').innerText()
    expect(bodyText.trim().length).toBeGreaterThan(0)

    // Невалидная cookie должна быть реально очищена, не просто проигнорирована.
    const cookies = await page.context().cookies()
    expect(cookies.find((c) => c.name === 'accessToken')).toBeUndefined()
  })

  test('невалидный (не-JWT) токен в cookie тоже ведёт на чистую форму логина', async ({ page }) => {
    await clearClientState(page)
    await setAccessTokenCookie(page, MALFORMED_TOKEN)
    await page.goto('/')

    await expect(loginForm(page)).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(1000)
    await expect(loginForm(page)).toBeVisible()
  })

  test('успешный вход приводит в кабинет', async ({ page }) => {
    await clearClientState(page)
    await page.goto('/login')

    await page.getByPlaceholder('Email').fill(DEMO_EMAIL)
    await page.getByPlaceholder('Пароль').fill(DEMO_PASSWORD)
    await page.getByRole('button', { name: 'Войти' }).click()

    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Панель управления' })).toBeVisible()
  })

  test('API auth недоступен: показывается понятный экран ошибки с "Повторить"/"Выйти", а не пустой фон', async ({ page }) => {
    await clearClientState(page)
    await setAccessTokenCookie(page, EXPIRED_TOKEN)

    // Симулируем недоступность API (не 401 — сетевой сбой/5xx), чтобы попасть
    // именно в error-состояние SessionGuard, а не в unauthenticated-редирект.
    await page.route('**/api/auth/me', (route) => route.abort('failed'))
    await page.goto('/dashboard')

    await expect(page.getByText('Не удалось загрузить профиль')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: 'Повторить' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible()

    const bodyText = await page.locator('body').innerText()
    expect(bodyText.trim().length).toBeGreaterThan(0)
  })

  test('профиль загружен, но workspace отсутствует — layout не пустеет', async ({ page }) => {
    await clearClientState(page)
    await setAccessTokenCookie(page, EXPIRED_TOKEN)

    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'u1', email: DEMO_EMAIL, isActive: true, systemRole: 'USER' })
      })
    )
    await page.route('**/api/workspaces', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )
    await page.route('**/api/billing/entitlements*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
    )

    await page.goto('/dashboard')

    // Layout должен смонтироваться (профиль есть) — экран не пустой, есть
    // навигация и/или явный текст, а не голый фон.
    await page.waitForTimeout(1500)
    const bodyText = await page.locator('body').innerText()
    expect(bodyText.trim().length).toBeGreaterThan(0)
    await expect(page.getByRole('link', { name: 'Настройки' }).first()).toBeVisible()
  })
})

// Примечание: весь describe-блок выше уже гоняется под обоими проектами из
// playwright.config.ts — "mobile-safari" (реальный WebKit + вьюпорт iPhone 13)
// и "desktop-chromium". Отдельный мобильный кейс не нужен: именно
// "новый неавторизованный пользователь..." под mobile-safari и есть точное
// воспроизведение репортнутого бага (Safari/iPhone, чистый контекст).
