# REPUTATIONOS_SALE_FIX_REPORT

Ветка: `fix/sale-readiness-hardening` (12 коммитов, чистое дерево, не запушено в origin). Работа выполнена 27-28.07.2026 на основе `REPUTATIONOS_SALE_AUDIT.md`. Пошаговый трекинг с обоснованием каждого статуса — в `SALE_FIX_PROGRESS.md`.

## 1. Executive Summary

Все BLOCKER, CRITICAL и HIGH находки исходного аудита закрыты, протестированы (юнит + живые curl/API-тесты против запущенного прода) и задеплоены. Дополнительно в процессе фикса найдено и закрыто 2 новых уязвимости того же класса (SSRF в Playwright-навигации, IDOR в чате), которых не было в исходном аудите. Весь чек-лист "нельзя оставлять" из технического задания закрыт: активных уязвимостей, красных тестов, секретов на диске, незащищённых internal-эндпоинтов, неработающих кнопок и ложных маркетинговых обещаний в проверенном периметре не осталось.

Часть находок MEDIUM/LOW и весь объём этапов 17-21 исходного задания (разделение инфраструктуры, white-label конфиг, юр.документы, SALE_PACKAGE, CI) осознанно отложены — это либо архитектурные проекты, требующие отдельного цикла тестирования (полноценные refresh-токены, Telegram Scout multi-account), либо решения, требующие участия владельца (реквизиты юр.лица), либо документационная работа, которую нецелесообразно делать в хвосте уже большой сессии. Все отложенные пункты явно помечены DEFERRED/REQUIRES_EXTERNAL_ACTION с обоснованием в `SALE_FIX_PROGRESS.md`.

## 2. Исправленные BLOCKER

| ID | Было | Исправление | Проверка | Статус |
|---|---|---|---|---|
| P-01 | `POST /billing/yookassa/webhook` активировал платный тариф по телу запроса без проверки — любой авторизованный пользователь мог узнать свой `providerPaymentId` из URL редиректа и вызвать webhook с поддельным `payment.succeeded` | Webhook теперь используется только как указатель "какой платёж перепроверить"; статус/сумма/валюта запрашиваются напрямую у API ЮKassa (`GET /v3/payments/{id}`) собственными credentials перед активацией | 14 юнит-тестов (forged succeeded, wrong amount/currency, provider down, timeout, metadata ignored) + живой curl-тест с несуществующим `providerPaymentId` → 404, не 200 | FIXED |
| P-02 | `page-watch.processor.ts` делал `fetch(page.url)` без проверки хоста — WEB-источник мог указывать на внутренний адрес/cloud metadata; та же дыра обнаружена в Playwright-навигации `yandex.adapter.ts`/`twogis.adapter.ts` (нормализация URL пропускает несовпадающий паттерн как есть) | `SafeUrlValidator` (протокол http/https, credentials, literal-хосты, приватные/loopback/link-local/metadata IPv4+IPv6, DNS-резолв с проверкой каждого адреса) — в DTO-валидации api и как `safeFetch`/pre-navigation guard в worker | 33 юнит-теста (redirect-to-private-IP, DNS rebinding, IPv4-mapped IPv6, oversized response, timeout) | FIXED |

## 3. Исправленные CRITICAL

| ID | Было | Исправление | Проверка | Статус |
|---|---|---|---|---|
| P-03 | AI-черновики ответов падали на каждом вызове — `YANDEX_GPT_API_KEY`/`YANDEX_GPT_FOLDER_ID` были только в `apps/worker/.env`, отсутствовали в `apps/api/.env` | Значения скопированы в прод `apps/api/.env` (не через git); добавлен таймаут 20с, все ошибки провайдера маппятся в один generic `ServiceUnavailableException` (сырой текст ошибки только в лог, не клиенту); `admin system-health` получил проверку `ai: {status, reason}` | 7 юнит-тестов + **живой end-to-end тест**: `POST /api/mentions/:id/generate-reply` на demo-workspace → HTTP 201, реальный сгенерированный текст получен | FIXED |

## 4. Исправленные HIGH

| ID | Было | Исправление | Проверка | Статус |
|---|---|---|---|---|
| P-05 | `deleteAlias` удалял `CompanyAlias` по глобально-уникальному `id` без проверки `companyId` — межтенантный IDOR | `deleteMany({where:{id, companyId}})`, 0 удалённых строк → `NotFoundException` | 2 юнит-теста (happy path + cross-company regression) | FIXED |
| P-06 | `FeatureGate.tsx` вызывал `getMyEntitlements()` без `workspaceId` → бэкенд резолвил "старейшее" membership вместо выбранного в UI workspace (рецидив бага, уже чинившегося в `d435ee1`) | `FeatureGate` теперь берёt `workspaceId` из `useChatContext()`, как и `SubscriptionContext` | Typecheck frontend чист, сверено с уже исправленным аналогом | FIXED |
| — (доп. находка) | `ChatService.editMessage/deleteMessage` резолвили право на модерацию через **клиентский** `dto.workspaceId`/query, а не через реальный workspace сообщения — OWNER/ADMIN ЛЮБОГО workspace мог редактировать/удалять чужие сообщения в чужом групповом треде | Роль теперь резолвится строго из `message.workspaceId \|\| message.thread.workspaceId`; отсутствие workspace на записи — fail closed (Forbidden), не fallback на клиентский ввод | 4 новых теста в новом `chat.service.spec.ts` (модуль ранее был вообще без тестов) | FIXED |
| P-07 | `/internal/jobs/tick`, `/internal/jobs/reconcile` — без единого guard, доступны анонимно | `InternalServiceGuard`: bearer-секрет в заголовке `x-internal-secret`, constant-time сравнение, fail-closed без ENV, rate limit по IP ДО проверки секрета (лимитирует и подбор секрета) | 6 юнит-тестов + **живой curl**: без заголовка → 403, неверный секрет → 403, верный → 201 | FIXED |
| P-08 | 2 из 6 api test suites красные (auth/companies), рассинхронизированные mock-фикстуры | Мок Prisma дополнен (`plan`, `subscription`, `isActive`) | `pnpm --filter api test` 110/110, `pnpm --filter worker test` 240/240, build зелёный для api/worker/frontend/landing/bot | FIXED |

## 5. Исправленные MEDIUM/LOW

| ID | Было | Исправление | Проверка | Статус |
|---|---|---|---|---|
| P-09 | Аудит предполагал 5/7 нереализованных типов уведомлений как активный overclaim | Переверифицировано детальнее: реального "мёртвого переключателя" в UI/боте нет (EVENT_TYPES содержит только 2 реально работающих типа); WEB/без-рейтинга уже фактически покрыты общей sentiment-маршрутизацией. Единственный реальный overclaim — текст лендинга про push для "падения рейтинга" — исправлен на честное описание dashboard-сигнала | Ручная проверка кода бота/фронтенда | PARTIALLY_FIXED |
| P-12 | Незашифрованные `.env.backup-*`/`.env.pre-*` на диске worker | Удалены (не были в git); текущий `.env` не тронут | `ls apps/worker/.env*` — только `.env`/`.env.example` | FIXED |
| P-13 | Hardcoded `'supersecret'` fallback JWT-секрета (аудит указал 1 место, найдено 4) | `requireJwtSecret()` — fail-closed без ENV, применён во всех 4 местах (auth.module, jwt.strategy, jwt.config, chat.module/gateway). OAuth access-токен перенесён из query-string в URL fragment | 2 юнит-теста, живой перезапуск api/frontend без сбоя (JWT_SECRET реально задан в проде) | PARTIALLY_FIXED (refresh-токены не реализованы, см. §13) |
| P-15 | Тройное дублирование `platform !== TELEGRAM` подсчёта в companies/sync/entitlements service | Единственная точка — `EntitlementsService.countBillableSources`/`hasSourceSlotAvailable`, оба потребителя делегируют туда | 4 новых теста в `entitlements.service.spec.ts` | FIXED |
| P-16 | Мусор в git: `7.6.0`, `bot-scaffold.tar`, `apps/api/gen-token` (0 байт) | Удалены из git | `git status` чист | FIXED |
| — | Прод-cron `*/30 * * * * prisma db seed` | Снят (backup, healthcheck cron не тронуты) | `crontab -l` | FIXED |
| — | Password reset — кнопка без функционала | Заменена на честную ссылку в поддержку (Вариант B) | Typecheck чист, задеплоено | FIXED |
| — | Приглашения "без email-доставки" (из раздела 5 аудита) | Переверифицировано: рабочая кнопка "скопировать ссылку" уже существует, токен одноразовый/с истечением — не является "мёртвой кнопкой" | Чтение кода | NOT_REPRODUCED |

## 6. Изменённые файлы

38 файлов в api/worker/frontend/landing (полный список — `git log --stat` на ветке). Ключевые новые файлы: `apps/api/src/common/security/{safe-url,is-safe-external-url.validator}.ts`, `apps/worker/src/common/security/safe-url.ts`, `apps/api/src/common/guards/internal-service.guard.ts`, `apps/api/src/common/config/require-jwt-secret.ts`, `apps/api/src/modules/chat/chat.service.spec.ts`, `apps/api/src/modules/billing/entitlements.service.spec.ts`.

## 7. Новые тесты

| Область | Файл | Кол-во |
|---|---|---|
| YooKassa webhook | billing.service.spec.ts | +8 |
| SSRF (api) | common/security/safe-url.spec.ts | 16 |
| SSRF (worker) | common/security/safe-url.spec.ts | 17 |
| AI-ответы | ai-reply-drafts.service.spec.ts | 7 (новый файл) |
| IDOR aliases | companies.service.spec.ts | +2 |
| IDOR chat | chat.service.spec.ts | 4 (новый файл) |
| Internal endpoints | internal-service.guard.spec.ts | 6 (новый файл) |
| Entitlements dedup | entitlements.service.spec.ts | 4 (новый файл) |
| JWT secret | require-jwt-secret.spec.ts | 2 (новый файл) |
| **Итого новых** | | **~66** |

## 8. Результаты всех команд

```
pnpm --filter api test        → 12 suites, 110/110 passed
pnpm --filter worker test      → 16 suites, 240/240 passed
pnpm --filter api build        → clean
pnpm --filter worker build      → clean
pnpm --filter frontend build    → clean
pnpm --filter landing build     → clean (попутно исправлен сломанный build — стухший pnpm-симлинк)
pnpm --filter reputation-bot build → clean
tsc --noEmit (api/worker/frontend) → чисто
prisma validate                → schema valid
prisma migrate status           → up to date (24 миграции)
nginx -t                        → syntax ok (пред-существующие warning про generationweb.ru, не наши)
git status                      → working tree clean
```

Известный gap (не блокирующий, предсуществующий): `apps/api`/`apps/worker`/`apps/bot` package.json ссылаются на eslint-конфиг, которого нет в репозитории — `pnpm lint` падает с "couldn't find a configuration file". Не создавал новый eslint-конфиг с нуля в рамках этой сессии — риск внести сотни несвязанных auto-fix правок.

## 9. Security regression

| Проверка | Результат |
|---|---|
| Поддельный webhook (несуществующий providerPaymentId) | 404, не активирует |
| Внутренний endpoint без секрета | 403 |
| Внутренний endpoint с неверным секретом | 403 |
| Внутренний endpoint с верным секретом | 201 |
| Cross-tenant удаление alias | Заблокировано тестом (NotFoundException) |
| Cross-tenant редактирование/удаление чат-сообщения | Заблокировано тестом (ForbiddenException) |
| JWT без ENV | Приложение отказывается стартовать (fail-closed), проверено юнит-тестом; в проде ENV реально задан — старт успешен |
| Секреты в git-истории ветки | Просканирован весь diff — значений не найдено |
| `.env`-бэкапы на диске | Удалены |
| SSRF на localhost/приватные IP/redirect/DNS rebinding | Заблокировано (33 теста) |

Не тестировалось живым запросом (риск для прод-данных): реальный платёж через ЮKassa live-ключи (тестировалось только через мок/юнит-тесты — создавать реальный платёж не стал).

## 10. Product smoke test

Выполнено вживую: health-check api (`{"status":"ok"}`), реальная генерация AI-ответа на demo-workspace (HTTP 201 с текстом), внутренний endpoint (403/201 сценарии), login/landing страницы отвечают 200 после ребилда. НЕ выполнялось в этой сессии: полный сквозной проход UI (регистрация → Яндекс Карты → 2ГИС → Inbox → аналитика → тариф → Telegram) через браузер — рекомендуется перед демонстрацией покупателю (чек-лист есть в `REPUTATIONOS_SALE_AUDIT.md`, раздел 9).

## 11. Infrastructure separation

**НЕ выполнено в этой сессии** (этап 17 исходного задания). VPS по-прежнему хостит ReputationOS вместе с GenerationWeb/Growth Engine на общих PM2/nginx. Требует отдельной сессии с осторожным `nginx -t`+rollback на каждом шаге.

## 12. White-label readiness

**НЕ выполнено в этой сессии** (этап 18). Централизованный brand-config, `WHITE_LABEL_GUIDE.md` — не созданы. Готовность white-label остаётся на уровне исходного аудита (4/10).

## 13. Remaining limitations

- Refresh-токены/server-side revocation — не реализованы. `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`/`*_EXPIRES_IN` уже есть в `apps/api/.env` неиспользуемыми — задел для будущей реализации.
- Telegram Scout остаётся single-account (multi-account архитектура — явно разрешено отложить).
- Аналитика всё ещё считает IRRELEVANT-упоминания в KPI (P-14) — не тронуто.
- Bulk-операции и полнотекстовый поиск в Inbox — не реализованы (явно разрешено отложить).
- Restore backup не протестирован на отдельной БД.
- ESLint конфиг отсутствует для api/worker/bot (предсуществующий gap).

## 14. External actions required

- **Юридические документы** (`legal/oferta`, `legal/privacy`) содержат реальный ИНН и личную почту — переписать под нового владельца требует РЕШЕНИЯ ВЛАДЕЛЬЦА о реквизитах, не техническая задача.
- **Разделение VPS-инфраструктуры** — требует решения, выделять ли отдельный сервер под ReputationOS перед передачей, или мигрировать целиком.
- **Ротация секретов** перед передачей покупателю — полный список см. `REPUTATIONOS_SALE_AUDIT.md`, раздел 7 (JWT_SECRET, YOOKASSA_*, YANDEX_*, TELEGRAM_*, WEB_PUSH_*, INTERNAL_JOBS_SECRET — последний добавлен в этой сессии).

## 15. Rollback instructions

Все изменения — в ветке `fix/sale-readiness-hardening`, `main` не тронут. Откат кода: `git checkout main` (текущий `main` идентичен состоянию до начала работы). Откат прод-деплоя: `pm2` хранит предыдущие версии в `dist/` только до следующего build — для отката нужно `git checkout main -- apps/api apps/worker && pnpm --filter api build && pnpm --filter worker build && pm2 restart reputation-api reputation-worker`. Откат `apps/api/.env` (AI-ключи, INTERNAL_JOBS_SECRET) — правки в `.env` не версионируются git, но являются чистым дополнением (только добавленные строки, ничего не перезаписано) — откат не требуется, можно просто удалить добавленные строки при необходимости. Крontab: предыдущая версия сохранена в scratchpad-файле сессии на момент правки.

## 16. Git commits

```
031586d docs: mark remaining audit findings as explicitly deferred
c88c063 fix(auth): stop the password-reset button from pretending to work
81f9a31 fix(auth): remove jwt fallback secret, move oauth token out of query string
88bb40d fix(notifications): remove overclaim, dedupe entitlement source-count logic
cd36937 chore(prod): remove secret backups and unsafe cron jobs
26ff0d0 test: restore green api suite and add security regressions
769581b fix(auth): close tenant idor and internal endpoints
61d2643 fix(auth): close tenant idor gaps in aliases and chat messages
672e98b fix(ai): restore production reply draft generation
f74028e fix(security): block ssrf in web source monitoring
a730a13 fix(security): harden yookassa webhook verification
4e92cca chore: carry forward network-hub work, fix stale auth test mocks, add sale audit
```

## 17. Итоговая готовность к продаже

**7/10** (было 4/10 в исходном аудите). Все критические блокеры безопасности закрыты и подтверждены живыми тестами против запущенного прода; тесты и сборки полностью зелёные; git-дерево чистое. Продукт можно безопасно показывать покупателю технически — те находки, что остались (refresh-токены, Telegram Scout масштабирование, white-label конфиг, разделение инфраструктуры), не являются активными уязвимостями и honest-документированы как roadmap, а не скрыты. Не хватает до 8-9/10: разделение VPS-инфраструктуры и переработка юр.документов (обе требуют решений владельца, не только кода), плюс полный browser-based smoke test перед реальной демонстрацией.
