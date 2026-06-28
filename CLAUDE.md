# ReputationOS — Claude Code Guide

## ReputationOS billing/admin state

Current billing model:
- Real plans: FREE, START, PRO, AGENCY.
- Do not use old fake plan codes: STARTER, BUSINESS, ENTERPRISE, CUSTOM.
- Workspace-level manual billing is implemented through admin panel.
- Plan stores base limits.
- Subscription stores selected plan, status and manual overrides.
- EntitlementsService should be the single source of effective workspace rights.
- Backend must enforce limits; frontend only displays them.

Important billing commits:
- `7caadb6` admin SaaS panel with billing, health and audit logs.
- `0f957c6` real plans in manual billing.
- `82e1607` subscription entitlements for push, telegram, members, web source.
- `e2507e5` active subscription enforcement in worker and sources.

Critical rules:
- Never put secrets into docs, CLAUDE.md, logs or git.
- `.env` files must stay ignored.
- Billing webhook requires `BILLING_WEBHOOK_SECRET`.
- After changing API/worker/bot TypeScript, run build because PM2 runs compiled `dist`.
- Do not remove old PostgreSQL enum values unless a dedicated safe migration is planned.

Known limitations:
- `maxWebPages` enforcement is next phase.
- Bot may still read `plan.limits` directly and ignore FeatureOverrides.
- `user.isActive` login guard is next phase.
- Full global workspace guard is intentionally not implemented yet.

## Build & deploy

PM2 runs compiled JS — always rebuild after TypeScript changes:

```bash
cd apps/api && npm run build
cd apps/worker && npm run build
cd apps/bot && npm run build   # only if bot was changed

pm2 restart reputation-api --update-env
pm2 restart reputation-worker --update-env
pm2 restart reputation-bot --update-env   # only if bot was changed
```

See `docs/billing-enforcement-2026-06-28.md` for full enforcement context.

## Current session state — 28.06.2026

### Project

ReputationOS — B2B SaaS мониторинга репутации.

Production:

* App: https://reputation.generationweb.ru/
* Landing: https://reputationos.generationweb.ru/
* Server path: `/opt/reputation-os`
* Branch: `feature/billing`

Stack:

* Backend: NestJS 10
* Frontend: Next.js 14 app router
* Landing: Next.js 14
* DB: PostgreSQL + Prisma
* Redis/BullMQ
* PM2

PM2 processes:

* `reputation-api`
* `reputation-frontend`
* `reputation-landing`
* `reputation-worker`
* `reputation-bot`

Important runtime note:

* Redis port `6380` is correct for ReputationOS production.
* Do not “fix” Redis back to 6379 unless fresh diagnostics prove it is broken.
* Old `ECONNREFUSED 127.0.0.1:6380` lines in logs were historical/reconnect noise, not current crash.
* Runtime was checked and considered stable before paywall work.

---

## Recently completed work

### Chat module

A production chat module was implemented and pushed.

Workspace chat:

* `WORKSPACE` thread works.
* “Общий чат” is created/opened automatically.
* Chat drawer opens from a separate chat button near notification bell.
* Chat is separate from notification bell.
* Ordinary chat messages must not pollute notification center.
* Invite notification bug was fixed: accepting workspace invite now marks related notification as read/resolved.
* Commit for invite/chat fixes: `383d815`.

Direct chats:

* Added `DIRECT` chat type.
* Added `ChatParticipant`.
* `workspaceId` became nullable where needed for DIRECT chats.
* Added `POST /api/chat/direct`.
* `/team` has a block to start direct chat by registered user email.
* Direct chats are visible only to participants.
* Drawer title changed from “Командный чат” to “Сообщения”.
* Thread groups: workspace chats and personal messages.
* Commit for direct chats: `0e13b92`.

Important chat rules:

* Workspace/company/mention chats use workspace membership access.
* Direct chats use ChatParticipant access.
* Owner/Admin workspace permissions must not apply to DIRECT chats.
* Ordinary chat/direct messages should not create notification bell records.
* Chat unread badge is separate from notification bell badge.

---

## YooKassa / Landing pricing work

YooKassa asked:

1. Show fixed prices on site, not “от ... ₽”.
2. Explain what the project does and what the user pays for.

Landing was updated:

* Fixed public pricing:

  * Старт — 990 ₽/мес
  * Бизнес — 2 990 ₽/мес
  * Агентство — 6 990 ₽/мес
* FAQ now explains that ReputationOS is an online service for monitoring reviews, mentions and company reputation.
* User pays for access to SaaS cabinet, analytics, notifications and review tools.
* Landing URL for YooKassa: `https://reputationos.generationweb.ru/#pricing`

Important:

* Keep public landing prices fixed and visible without login.
* Do not use “от”, “по запросу”, “индивидуально” in tariff prices for YooKassa-facing pricing.
* Do not describe the business as resale, marketplace, or third-party goods.

---

## Current unfinished task — subscription prompts / paywall

User wants subscription offers spread across the app, not only on checkout page.

Important discovered issue:

* Landing prices were updated to:

  * Старт — 990 ₽/мес
  * Бизнес — 2 990 ₽/мес
  * Агентство — 6 990 ₽/мес
* App checkout still showed old/different prices on screenshot:

  * Старт — 990 ₽/мес
  * Про — 1 990 ₽/мес
  * Агентство — 3 990 ₽/мес

First priority:

* Unify tariff names/prices across the whole project:

  * START / Старт — 990 ₽/мес
  * PRO technical key may remain, but UI label should be “Бизнес” — 2 990 ₽/мес
  * AGENCY / Агентство — 6 990 ₽/мес

Find and update all pricing sources:

* landing pricing
* app billing checkout
* backend billing/plan config
* Prisma seed
* admin billing/tariffs if hardcoded
* plan limits/config/constants
* any UI text that says Pro/Про if final UI should say Бизнес

Paywall UX target:

* Do not block the whole app.
* Do not spam aggressive popups.
* Add contextual subscription prompts.

Needed frontend pieces:

1. Subscription status provider/hook if not already complete.
2. Topbar plan badge:

   * “Нет тарифа”
   * “Триал”
   * “Старт”
   * “Бизнес”
   * “Агентство”
     Click should lead to billing/checkout.
3. Dashboard upgrade banner for users without active subscription.
4. `SubscriptionRequiredModal`.
5. Soft popup once per session/day for users without active plan.

   * Do not show on `/billing`, `/billing/checkout`, `/settings`, `/team`, `/admin`.
6. `SubscriptionGate` for paid features.

Feature keys to gate:

* ADD_COMPANY
* SYNC_REVIEWS
* WEB_MONITORING
* AI_REPLIES
* TELEGRAM_NOTIFICATIONS
* PUSH_NOTIFICATIONS
* ADVANCED_ANALYTICS
* EXPORTS if present

Suggested free/no-subscription access:

* login/register
* dashboard preview
* billing
* settings
* team
* chat
* invite handling

Suggested paid/limited actions:

* adding companies
* active monitoring/sync
* AI replies
* Telegram/Push notifications
* advanced analytics
* web monitoring
* exports if present

Backend:

* Frontend paywall is UX only.
* Backend must still enforce limits/permissions for paid features.
* Check existing billing guards before adding duplicates.

---

## Current Claude Code interruption state

Claude Code stopped due to limit while working on paywall/subscription prompts.

Visible partial change before stop:

* `apps/frontend/components/layout/Topbar.tsx` was being edited.
* It added imports roughly like:

  * `useSubscription` from subscription context
  * `getPlanBadgeLabel`
  * `isSubscriptionActive`
* It started adding plan badge JSX in Topbar.
* This work may be partial and uncommitted.

When continuing:

1. Do not start from scratch.
2. First run:

   * `git status`
   * `git diff --stat`
   * inspect partial diffs
3. Continue from current diff.
4. Finish paywall work.
5. Run builds.
6. Restart PM2.
7. Commit and push.

Commands after implementation:

```bash
cd /opt/reputation-os
git status
npx prisma generate --schema=prisma/schema.prisma
cd apps/api && npm run build
cd ../frontend && npm run build
pm2 restart reputation-api reputation-frontend
```

If landing changed:

```bash
cd /opt/reputation-os/apps/landing
npm run build
pm2 restart reputation-landing
```

Final report should include:

* final tariff names/prices;
* where price mismatches were found;
* files changed;
* where subscription prompts were added;
* backend guards checked/added;
* browser test checklist.
