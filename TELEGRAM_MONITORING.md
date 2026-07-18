# Telegram Scout

Telegram Scout — автономный ИИ-агент внутри `apps/worker`, который ищет упоминания
компаний непосредственно в текстах сообщений публичных Telegram-каналов, групп и
супергрупп. Это **не Telegram-бот**: агент ничего не отправляет в Telegram, никуда
не вступает и работает только на чтение через MTProto (библиотека `teleproto`).

Он полностью отделён от пользовательского Telegram-бота уведомлений (Telegraf,
`TELEGRAM_BOT_TOKEN`, `apps/worker/src/telegram/`) — разные аккаунты, разные
сессии, разный код.

## Архитектура

```
apps/worker/src/telegram-search/
├── client.ts                      # singleton MTProto-клиент
├── session-store.ts                # чтение/запись файла сессии (0600, вне git)
├── mtproto-lock.ts                 # распределённый Redis-лок вокруг MTProto-сокета
├── telegram-search.processor.ts    # BullMQ worker: discovery/watchlist/entity_search/source_check
├── telegram-watchlist-dispatcher.processor.ts  # FOR UPDATE SKIP LOCKED диспетчер watchlist
└── telegram-scout/
    ├── telegram-scout.types.ts
    ├── telegram-scout.config.ts        # чтение бюджетов из ENV
    ├── telegram-query-builder.service.ts   # strong/medium/weak запросы
    ├── telegram-relevance.service.ts       # эвристика + LLM
    ├── telegram-relevance-context.util.ts
    ├── telegram-global-search.service.ts   # messages.searchGlobal, channels.searchPosts, contacts.Search
    ├── telegram-channel-search.service.ts  # messages.Search внутри конкретного peer
    ├── telegram-api-mapper.ts              # raw teleproto → внутренние типы
    ├── telegram-retry.util.ts
    ├── telegram-result-mapper.ts           # → DedupService.persistMention
    ├── telegram-scout-source.service.ts    # bootstrap Source/CompanySourceTarget
    ├── telegram-watchlist.service.ts       # инкрементальное чтение известных каналов
    └── telegram-scout.service.ts           # оркестратор DISCOVERY/ENTITY_SEARCH
```

Только read/search-методы MTProto используются во всём модуле — `send*`, `join*`,
`delete*` физически нигде не импортируются.

## Отдельная Telegram-сессия

ReputationOS использует **свой собственный** Telegram-аккаунт для Scout —
не тот же, что использует Growth Engine, и не бот уведомлений. Нужны:

- `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` — получить на https://my.telegram.org
  (раздел "API development tools") для отдельного номера телефона.
- `TELEGRAM_SESSION_PATH` — путь к файлу сессии (по умолчанию
  `apps/worker/.session/telegram-search.session`). Файл создаётся правами `0600`,
  лежит **вне git** (см. `.gitignore`: `apps/worker/.session/`) и не должен
  попадать в build-артефакты или логи.

### Первичный вход (login)

```
pnpm tsx scripts/telegram-search-login.ts
```

Скрипт **не запускается автоматически** — это ручная, явно подтверждаемая
операция (ввод номера телефона, SMS-кода, при необходимости пароля 2FA). Скрипт
не читает stdin напрямую (может выполняться в фоне без терминала): он пишет
`apps/worker/.session/login-coordination/waiting-for.txt` с тем, что ожидает
(`phone`/`code`/`password`), и ждёт появления соответствующего файла-ответа.

После успешного входа сессия сохраняется в `TELEGRAM_SESSION_PATH` и переиспользуется
при каждом старте `apps/worker` — повторный логин не требуется, пока сессия не будет
отозвана или файл не будет удалён.

### Ротация сессии

Если сессию нужно заменить (компрометация, смена аккаунта):
1. Остановить `apps/worker`.
2. Удалить файл `TELEGRAM_SESSION_PATH`.
3. Запустить `scripts/telegram-search-login.ts` заново.
4. Перезапустить `apps/worker`.

## Режимы агента

### DISCOVERY

Запускается по расписанию раз в `TELEGRAM_SCOUT_DISCOVERY_INTERVAL_HOURS` часов
(по умолчанию 24) на компанию — только для компаний, явно подключивших Telegram
Scout (`POST /companies/:id/start-telegram-sync`, `CompanySourceTarget` с
`platform=TELEGRAM` и `isActive=true`).

Шаги: построение до 6 запросов (strong/medium/weak) → `messages.searchGlobal`
(отдельно `broadcastsOnly`/`groupsOnly`) → опционально `channels.searchPosts`
(бесплатный hashtag-режим) → `contacts.Search` (доп. кандидаты по названию) →
углублённый `messages.Search` внутри найденных каналов → проверка релевантности →
сохранение подтверждённых `Mention` → кандидаты в watchlist.

Все запущенные запросы и агрегированная статистика прогона (сколько сообщений
просканировано, сколько подтверждено/отсеяно/UNSURE, новые каналы/группы, причина
остановки) сохраняются в `JobLog.result` — отдельной таблицы для этого нет.

### WATCHLIST

Регулярно (диспетчер тикает каждые `TELEGRAM_WATCHLIST_DISPATCHER_INTERVAL_MIN`
минут) проверяет уже известные включённые каналы/группы инкрементально, по
`CompanyTelegramChannel.lastMessageId`. Один физический канал читается **один раз
за цикл**, даже если на него подписаны несколько компаний — курсор каждой
компании продвигается независимо, ошибка одной компании не теряет сообщения для
другой (см. тест `telegram-watchlist.service.spec.ts`).

### SOURCE_CHECK

Ручное действие пользователя — либо «Проверить сейчас» на существующем канале,
либо «Добавить по username» (резолв нового источника через `client.getEntity`,
проверка что это публичный канал/группа/супергруппа, а не пользователь).

### ENTITY_SEARCH

Облегчённый режим — только `contacts.Search` по построенным запросам, без
сканирования сообщений. Кандидаты создаются как чистые предложения
(`enabled=false`, `discoveryMethod=ENTITY_SEARCH`) — всегда требуют
подтверждения пользователя в UI.

## Бюджеты и лимиты

Полный список — в `.env.example`. Ключевые:

| ENV | Назначение |
|---|---|
| `TELEGRAM_SCOUT_MAX_QUERIES_PER_COMPANY` | максимум запросов за DISCOVERY-прогон (по умолчанию 6: 3 strong + 2 medium + 1 weak) |
| `TELEGRAM_SCOUT_MAX_PAGES_PER_QUERY` | максимум страниц пагинации на один запрос |
| `TELEGRAM_SCOUT_MAX_MESSAGES_PER_RUN` | общий бюджет сообщений на весь DISCOVERY-прогон |
| `TELEGRAM_SCOUT_MAX_RUNTIME_MS` | максимальное время выполнения одного прогона |
| `TELEGRAM_SCOUT_MAX_NEW_SOURCES_PER_RUN` | максимум новых источников, создаваемых за прогон |
| `TELEGRAM_WATCHLIST_MAX_MESSAGES_PER_CHANNEL` | бюджет сообщений на один канал за цикл watchlist |

Прогон останавливается при первом из условий: исчерпан бюджет страниц/сообщений/
времени, Telegram вернул пустую страницу, наступил длинный FloodWait, источник
отключён тарифом/пользователем.

## FloodWait

Telegram может вернуть `FLOOD_WAIT_n` при превышении лимита запросов. Scout
никогда не ждёт синхронно `n` секунд внутри job'а — вместо этого пагинация
конкретного запроса останавливается, `stoppedReason='flood_wait'` и
`floodWaitSeconds` записываются в статистику прогона, а job завершается со
статусом `PARTIAL` (не `FAILED`).

## MTProto-лок (Redis)

`concurrency: 1` у BullMQ worker защищает только один Node-процесс. Если
`apps/worker` случайно запущен в нескольких экземплярах, распределённый
Redis-лок (`reputationos:telegram-mtproto:lock`, TTL 30с, heartbeat каждые 10с)
не даёт двум процессам одновременно открыть MTProto-сокет.

**Рекомендуется запускать ровно один экземпляр Telegram Scout worker.** Лок — это
защитная сетка на случай ошибки в деплое, а не штатный режим работы с
несколькими инстансами.

Поведение при занятости лока:
- `WATCHLIST` — без повторной постановки задания; `nextCheckAt` сдвигается на
  +2 минуты, следующий тик диспетчера создаст новое задание сам.
- `DISCOVERY`/`ENTITY_SEARCH`/`SOURCE_CHECK` — постановка нового задания с
  уникальным `jobId` (`{originalJobId}:lock-retry:{n}:{epoch}`), с задержкой
  `TELEGRAM_LOCK_RETRY_DELAY_MS`, не более `TELEGRAM_LOCK_MAX_SELF_REQUEUES` раз.

## Ограничения покрытия (честно)

Telegram Scout **не индексирует весь Telegram**. Покрытие ограничено:
- поисковой выдачей `messages.searchGlobal` — она не гарантированно полная;
- бюджетами страниц/сообщений/времени, описанными выше;
- FloodWait-паузами;
- **приватные каналы и группы недоступны в принципе** — MTProto-аккаунт видит
  только то, к чему у него есть публичный или явный доступ; Scout никуда не
  вступает и не запрашивает доступ;
- платный полнотекстовый режим `channels.searchPosts` (Telegram Stars) не
  реализован — используется только бесплатный hashtag-режим, и только если явно
  включён `TELEGRAM_SCOUT_ENABLE_HASHTAG_POST_SEARCH=true`.

Это отражено в UI (`TelegramScoutPanel`) явным предупреждением.

## Отключение интеграции

- `TELEGRAM_SCOUT_ENABLED=false` (по умолчанию) — worker пропускает все
  Telegram-джобы без обращения к MTProto, ничего не логирует как ошибку.
- На уровне компании — выключить тумблер в `TelegramMonitoringToggle` (ставит
  `CompanySourceTarget.isActive=false`), либо удалить/выключить отдельные
  каналы в `TelegramChannelsManager`.
- На уровне тарифа — `telegramMonitoringEnabled` в `PlanLimits`; доступно только
  на PRO и AGENCY.

## Безопасность

- Файл сессии никогда не коммитится, не логируется и не возвращается ни одним
  API-эндпоинтом.
- `accessHash` каналов/групп не хранится в БД — резолв всегда идёт через публичный
  `username` и внутренний entity-кэш `teleproto`.
- API-эндпоинты не возвращают `session`, `apiHash`, `accessHash`, Redis-токен лока
  или другие внутренние секреты.
- Redis-лог событий (`telegram_mtproto_lock_busy`/`_lost`) не содержит токен лока.

## Известные ограничения v1

- Автоматическая корректировка `checkIntervalMin` и автоотключение шумных
  источников самим Scout (упомянутые в исходном ТЗ как допустимые в узком
  диапазоне при explicit opt-in) не реализованы в v1 — интервал проверки
  источника меняется только вручную через API/UI.
- `autoAddToWatchlist` для найденных DISCOVERY-кандидатов по умолчанию `false`
  и не имеет отдельного UI-переключателя в v1 — источники всегда требуют
  ручного подтверждения в `TelegramChannelsManager`.
