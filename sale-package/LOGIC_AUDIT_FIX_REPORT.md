# ReputationOS Logic Audit Fix Report

## Baseline

- Branch: `fix/logic-audit-hardening`
- Base branch: `main`
- Commit before: `66cb0c3 merge: sale readiness hardening`

Аудит выполнялся по текущему коду, а не по предположениям из задания. `demo@reputation.local`, его credentials и seed не изменялись.

## Summary

- Confirmed: 23
- Fixed: 18
- Already fixed / verified: 5
- Not reproduced: 3
- Deferred: 3 документированных ограничения, не P0/P1
- Remaining P0: 0
- Remaining P1: 0

## P0 findings

### P0-1 — Stale paid background jobs survived subscription expiry

- Status: FIXED
- Severity: CRITICAL
- Root cause: repeatable BullMQ registration и payload считались достаточным основанием для sync; processors не имели единого актуального entitlement gate.
- Files: `apps/worker/src/services/job-eligibility.service.ts`, sync/page/Telegram processors, scheduler.
- Fix: central worker-side gate читает текущую subscription/workspace/company/source/target/sync flags перед каждым внешним запросом. Истёкшая подписка получает FREE policy без удаления данных.
- Tests: expired PRO blocks WEB/Telegram, сохраняет FREE Yandex/2GIS; inactive entities and stale jobs exit before adapter.
- Residual risk: новые external processors обязаны подключать тот же gate; это проверяется code review, автоматического архитектурного lint rule нет.

### P0-2 — Inactive company/source/target could still sync

- Status: FIXED
- Severity: CRITICAL
- Root cause: state проверялся при создании cron/API action, но не непосредственно перед adapter call.
- Files: `job-eligibility.service.ts`, `reviews-sync`, `mentions-sync`, `rating-refresh`, `page-watch`, Telegram services/processors.
- Fix: fail-closed checks current `workspace.isActive`, `company.isActive`, `source.isEnabled`, target/page/link active state and capability-specific flag; target rechecked inside processing loop.
- Tests: inactive company/workspace/page/target query gates, processor stale exit.
- Residual risk: none known.

### P0-3 — Ghost repeatables and cross-company Telegram cron removal

- Status: FIXED
- Severity: CRITICAL
- Root cause: BullMQ repeat hash changes leave old cron; previous single-job helper could remove another company's Telegram registration.
- Files: `repeatable-cron.util.ts`, `scheduler.service.ts`.
- Fix: startup reconciliation removes missing/wrong-interval registrations only for known job name + ReputationOS ID prefix; Telegram replacement scoped per company. Retired watchlist dispatcher remains disabled.
- Tests: stale/old cron removed, foreign namespace preserved, company B Telegram cron preserved.
- Residual risk: Redis loss recreates schedules on worker start as designed.

### P0-4 — Reconcile cron multiplied full-table scans

- Status: FIXED
- Severity: CRITICAL
- Root cause: one reconcile job was registered per company, but processor ignored `companyId` and scanned all Mention rows each time.
- Files: `reconcile.processor.ts`.
- Fix: require companyId, validate active company/workspace and scope query to company.
- Tests: static type/build plus scheduler/job regression suite.
- Residual risk: reconciliation currently only inspects; delete reconciliation is not implemented.

### P0-5 — Checkout selected an implicit workspace and lacked OWNER-only policy

- Status: FIXED
- Severity: CRITICAL
- Root cause: checkout resolved a user's first workspace and billing mutations were not uniformly role-bound.
- Files: checkout DTO/controller/service, frontend checkout/payment result.
- Fix: required explicit `workspaceId`; backend validates active workspace, membership and exact `OWNER` role. `ADMIN` and `MEMBER` receive 403. Payment and trusted provider metadata carry the selected workspace; activation uses local Payment.
- Tests: selected workspace, non-member, OWNER/ADMIN/MEMBER.
- Residual risk: `SUPER_ADMIN` uses separate guarded admin billing endpoints, not workspace checkout.

### P0-6 — Yearly checkout could fall back to monthly price

- Status: FIXED
- Severity: CRITICAL
- Root cause: backend/UI tolerated absent `priceYearly`.
- Files: `billing.service.ts`, checkout UI.
- Fix: yearly requires finite positive `priceYearly`; no fallback. UI labels it unavailable and disables selection/payment.
- Tests: null, zero, exact yearly and monthly price.
- Residual risk: none known.

### P0-7 — Unsafe subscription upgrade/downgrade/renewal lifecycle

- Status: FIXED
- Severity: CRITICAL
- Root cause: successful payment overwrote plan without explicit period policy; no scheduled downgrade fields.
- Files: Prisma schema/migration, BillingService, EntitlementsService.
- Fix: full-price upgrade starts a new full period immediately; same-plan renewal extends current boundary; paid downgrade schedules at current boundary and preserves paid access; cancel at period end falls back to FREE after expiry. Period is 30/365 days.
- Tests: upgrade, downgrade, same-plan renewal, period boundaries.
- Residual risk: no prorating and no automatic recurring provider charge; both are explicit product limitations.

### P0-8 — Duplicate checkout/webhook races could double-apply payment

- Status: FIXED
- Severity: CRITICAL
- Root cause: check-then-update lacked a DB claim and workspace could open parallel checkouts.
- Files: Payment `checkoutKey`, BillingService transaction.
- Fix: unique pending checkout reservation per workspace; conditional `updateMany(PENDING)` claims payment inside the same transaction as subscription write. Pending provider payments are not locally expired without provider confirmation, avoiding a paid-but-rejected late payment.
- Tests: duplicate checkout conflict, already processed and concurrent webhook claim.
- Residual risk: provider payment creation is necessarily outside DB transaction; creation failure marks local payment canceled and releases reservation. An indefinitely pending provider payment may require owner sync/provider cancellation before a new checkout.

### P0-9 — YooKassa webhook trusted insufficient provider data

- Status: FIXED / EXTENDED PREVIOUS HARDENING
- Severity: CRITICAL
- Root cause: sale-readiness already performed server-to-server verification, but missing remote amount was accepted.
- Files: `billing.service.ts`, billing tests.
- Fix: production YooKassa verification now fails closed on missing/wrong amount, wrong currency/status/id, provider/network failure; payload metadata ignored; local Payment is authority.
- Tests: valid succeeded, forged pending, missing/wrong amount, wrong currency, unknown payment, duplicate, provider failure.
- Residual risk: MOCK intentionally has no remote verification and must not be configured in production.

### P0-10 — Analytics used ingestion time and synthetic rating history

- Status: FIXED
- Severity: CRITICAL
- Root cause: date filters used `createdAt`; frontend generated smoothed/index-offset ratings without snapshots.
- Files: AnalyticsService/controller, dashboard/analytics components.
- Fix: all business period filters use `publishedAt`; null publication date is excluded. Reputation trend uses only `RatingSnapshot`; otherwise “Недостаточно данных”.
- Tests: historical import not counted today, publishedAt where clauses, empty/snapshot-only rating trend.
- Residual risk: older rows without `publishedAt` require data-quality backfill if owner wants them in period reports.

### P0-11 — Cross-workspace source IDOR

- Status: FIXED
- Severity: CRITICAL
- Root cause: source-target creation read only the source platform by UUID and did not verify `Source.workspaceId`.
- Files: CompaniesService and tests.
- Fix: source must belong to the company's workspace and be enabled; foreign UUID returns NotFound. Existing company/mention/chat/AI/manual-sync boundaries were reverified.
- Tests: foreign sourceId, cross-workspace analytics, existing company/mention/chat suites.
- Residual risk: ACL remains service-local rather than a universal resource interceptor.

### P0-12 — Duplicate Mention/Rating writes under concurrent jobs

- Status: FIXED
- Severity: CRITICAL
- Root cause: mention check-then-create surfaced P2002 during a race; rating jobs always inserted snapshots.
- Files: DedupService, RatingService, Prisma migration.
- Fix: Mention P2002 loser rereads and updates winner; repeated externalId updates content/rating/author/publishedAt. Rating snapshots upsert by source-target + UTC day.
- Tests: repeated update, concurrent unique race, daily rating upsert.
- Residual risk: external deletion is intentionally not inferred.

### P0-13 — SSRF/auth/internal endpoint regression risk

- Status: VERIFIED / ALREADY FIXED
- Severity: CRITICAL
- Root cause: previous sale-readiness findings.
- Files: safe URL utilities/validators, JWT config, guards, auth/chat modules.
- Fix: no rewrite; verified HTTP(S)-only, private/loopback/link-local/DNS/redirect blocking, required JWT secret, SuperAdmin/InternalService guards and WebSocket auth.
- Tests: existing SSRF 33-case suite, auth/internal/chat regression suites.
- Residual risk: DNS pinning at socket level is limited by current HTTP libraries; every redirect and pre-request resolution is checked.

## P1 findings

### P1-1 — Inbox/analytics/report counted different mention sets

- Status: FIXED
- Severity: HIGH
- Root cause: duplicated relevance conditions and period semantics.
- Files: `mention-visibility.filter.ts`, MentionsService, AnalyticsService, report page.
- Fix: canonical relevant set = inbox visible, not manual-review, not irrelevant unless human marked relevant.
- Tests: existing nullable/review-decision mention tests plus analytics where assertions.
- Residual risk: review queue and irrelevant tab intentionally show different documented sets.

### P1-2 — KPI deltas were misleading zeroes

- Status: FIXED
- Severity: HIGH
- Root cause: no equal-length comparison and frontend defaulted missing values to 0.
- Files: AnalyticsService and frontend API/dashboard.
- Fix: previous period has same duration; absent baseline returns null and UI renders `—`.
- Tests: previous=0 delta regression.
- Residual risk: none known.

### P1-3 — Report mixed all-time, 7-day and limited samples

- Status: FIXED
- Severity: HIGH
- Root cause: KPI calculated from first 100 mentions while title claimed 7–30 days.
- Files: report page and AnalyticsService platform aggregate.
- Fix: one inclusive 30-day from/to for all KPI/platforms/examples; server aggregates full set; only examples are limited. Fake “AI summary” renamed “Автоматическое резюме”.
- Tests: analytics period tests and frontend type/build.
- Residual risk: report is HTML print view, not immutable generated PDF.

### P1-4 — Generic AI prompt invented a premium venue context

- Status: FIXED
- Severity: HIGH
- Root cause: universal industry-specific role and impossible “different from previous” instruction.
- Files: AiReplyDraftsService.
- Fix: neutral company representative; explicit company/platform/author/rating/review/tone/language; sanitized optional description limited to 1000 chars; impossible instruction removed.
- Tests: AI service suite and build.
- Residual risk: prompt injection inside review/company description is mitigated by structural prompt but not a formal content sandbox.

### P1-5 — AI monthly quota race/double request

- Status: FIXED
- Severity: HIGH
- Root cause: count then external call then create allowed concurrent overrun and charged semantics were ambiguous on provider failure.
- Files: AI service/DTO/frontend, Prisma migration.
- Fix: short per-workspace Postgres advisory-lock transaction reserves a `GENERATING` row; provider call occurs outside transaction; failure deletes reservation; `requestId` makes completed retry idempotent and in-progress duplicate returns conflict.
- Tests: quota limit, reservation lock, failure cleanup, request idempotency.
- Residual risk: crashed GENERATING reservations stop counting after two minutes but remain for audit/cleanup.

### P1-6 — Unsupported source silently did nothing

- Status: FIXED
- Severity: HIGH
- Root cause: SourceAdapterFactory returned EmptyAdapter for unsupported enum values.
- Files: adapter factory, CompaniesService.
- Fix: GOOGLE/TELEGRAM/unknown throw explicit unsupported error; CUSTOM remains intentional no-op.
- Tests: factory and API source tests.
- Residual risk: GOOGLE enum remains for backward compatibility.

### P1-7 — Sync errors/status and retries were inconsistent

- Status: FIXED
- Severity: HIGH
- Root cause: review errors could be masked and `lastSyncedAt` was not strictly success-only.
- Files: reviews processor, job log status, TwoGis tests.
- Fix: per-target failures recorded, total failure throws for bounded BullMQ retry, partial success remains visible, lastSyncedAt only after adapter success, CANCELLED used for entitlement/state skip.
- Tests: success, zero results, total/partial failure, lastSyncedAt update failure.
- Residual risk: Telegram FloodWait intentionally ends a run PARTIAL and waits for the next scheduled/manual run instead of causing a retry storm.

### P1-8 — Scheduled downgrade was ignored by notification worker

- Status: FIXED
- Severity: HIGH
- Root cause: AlertsService duplicated subscription logic and continued reading current plan after scheduled boundary.
- Files: AlertsService and JobEligibilityService.
- Fix: push/Telegram notification capability uses the same effective-plan resolver as sync jobs; FREE push continues if allowed, paid Telegram notifications stop.
- Tests: central entitlement suite and full worker suite.
- Residual risk: subscription billing reminders deliberately bypass feature entitlement as system messages.

### P1-9 — Telegram runtime documentation contradicted code

- Status: FIXED
- Severity: HIGH
- Root cause: docs still promised a frequent standalone watchlist dispatcher.
- Files: `TELEGRAM_MONITORING.md`, `.env.example`, buyer docs.
- Fix: docs now state daily per-company discovery containing watchlist checks; stale frequent dispatcher remains retired.
- Tests: repeatable reconciliation and Telegram suites.
- Residual risk: one MTProto account is still a scaling limitation.

## P2 findings

### P2-1 — Hardcoded reputation label

- Status: FIXED
- Severity: MEDIUM
- Root cause: positive label was not tied to rating.
- Files: AnalyticsDashboard.
- Fix: single threshold function: excellent ≥4.5, good ≥4.0, attention ≥3.0, critical below 3.0; no rating shows insufficient data.
- Tests: frontend type/build.
- Residual risk: thresholds are product policy and may later become configurable.

### P2-2 — Legacy README/DEPLOY and unsafe ENV example

- Status: FIXED
- Severity: MEDIUM
- Root cause: root docs were an obsolete Telegram scaffold and `.env.example` used a weak sample JWT secret / retired dispatcher variable.
- Files: README, DEPLOY, root and API `.env.example`.
- Fix: current monorepo/deploy/runtime policy documented; placeholders replace weak samples.
- Tests: documentation review.
- Residual risk: infrastructure-specific PM2/nginx details require buyer environment decisions.

### P2-3 — External review deletion reconciliation

- Status: DEFERRED / DOCUMENTED LIMITATION
- Severity: MEDIUM
- Root cause: adapters do not receive authoritative deletion/tombstone feeds.
- Files: `KNOWN_LIMITATIONS.md`.
- Fix: no unsafe inferred deletion added; historical data remains.
- Tests: repeated sync update/dedup.
- Residual risk: a review removed upstream remains visible historically.

## Security verification

Tenant isolation: sensitive company/mention/source/chat/billing/AI/manual-sync routes trace resource → company → workspace → membership. New foreign-source IDOR regression added.
YooKassa: server-side lookup; local Payment authority; exact status/id/amount/currency; transactional idempotency; payload metadata ignored.
SSRF: sale-readiness protection preserved for DTO/API and worker HTTP/Playwright paths, including redirect revalidation.
JWT/Auth: no fallback JWT secret; auth routes guarded/rate-limited; admin requires SuperAdminGuard.
Internal endpoints: `InternalServiceGuard` + rate limit preserved.
Secrets: no tracked production secret value was printed or added. Example files contain placeholders only.

## Billing policy

- Billing manager: workspace `OWNER` only; `ADMIN`/`MEMBER` forbidden with 403.
- Workspace selection: explicit required `workspaceId`; no `findFirst()` checkout selection.
- Upgrade: separate full payment starts the higher-plan 30/365-day period immediately; no free remaining-period upgrade.
- Downgrade: lower paid plan is scheduled at the current paid boundary; current access remains until then.
- Renewal: same plan extends from current boundary; expired plan starts from payment time.
- Yearly validation: positive `priceYearly` required; exact backend amount; no fallback.
- Expiry: subscription entitlements fall back to FREE; companies, mentions, ratings, settings and history are retained.

## Background job policy

- Every external processor uses current DB entitlement and entity flags; queue data is not authority.
- Inactive workspace/company/source/target/page/link or disabled sync flag yields CANCELLED/skip before external I/O.
- Scheduler reconciles known ReputationOS repeatables at worker start and removes obsolete/wrong-interval jobs only in their namespace.
- Processor validation remains mandatory even if reconciliation is delayed or Redis contains stale jobs.
- Retry is bounded by BullMQ policy; total adapter failure throws, success timestamps are success-only, no infinite FloodWait loop.

## Analytics semantics

- Period date: `publishedAt` only; `createdAt` is ingestion/audit time.
- `publishedAt=null`: excluded from period analytics and reports rather than counted on ingestion day.
- Relevant mention: inbox-visible, not awaiting manual review, not classified/human-marked irrelevant unless human explicitly marks relevant.
- KPI delta: current range versus immediately previous equal-length range; no previous baseline → null/`—`.
- Report: one inclusive 30-day range for every aggregate; examples alone are limited.
- Rating trend: real RatingSnapshot only; no synthetic interpolation/offset/random values.

## Telegram runtime behavior

- One daily per-company `telegram.discovery` repeatable by default (`TELEGRAM_SCOUT_DISCOVERY_INTERVAL_HOURS`, default 24).
- That run performs discovery and incremental checks for enabled watchlist channels.
- Manual add/check/discovery endpoints remain available but enforce current company access and Telegram entitlement.
- Standalone frequent watchlist dispatcher is retired and its stale repeatables are removed on startup.
- MTProto is protected by a Redis lock and queue concurrency; one shared account remains a documented BETA limitation.

## Remaining limitations

- Telegram Scout remains single-account; FloodWait completes PARTIAL and waits for a later run.
- No upstream review deletion reconciliation.
- GOOGLE adapter is not implemented and is explicitly rejected.
- No prorating, automatic recurring charge engine or calendar-month billing; periods are fixed 30/365 days.
- Existing ESLint scripts lack a compatible project config and remain a documented baseline issue.

## Validation

| Команда | Результат |
|---|---|
| Prisma generate | PASS |
| API tests | PASS — 129/129 |
| Worker tests | PASS — 254/254 |
| API TypeScript/build | PASS |
| Worker TypeScript/build | PASS |
| Frontend TypeScript | PASS |
| Frontend e2e | PASS — 12/12 on deployed commit `2c82cf8` using Chromium and WebKit (17.5s) |
| lint | BASELINE BLOCKED — missing/incompatible ESLint config in project |
| API production build | PASS |
| Worker production build | PASS |
| Frontend Next production build | PASS |
| Landing Next production build | PASS |
| Bot production build | PASS |
| Root Turbo wrapper | BLOCKED by sandbox pnpm auto-install/store path; every package build was executed directly and passed |

## Git

- Commit before: `66cb0c3`
- Implementation commit after: `2c82cf8 fix: harden billing sync analytics and tenant logic`.
- Branch merged into `main` by fast-forward after successful production verification; no history rewrite.
- Production verification: migration applied, five PM2 services online, frontend/landing HTTP 200, unauthenticated API/proxy HTTP 401, Playwright 12/12 PASS.
