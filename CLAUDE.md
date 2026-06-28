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
