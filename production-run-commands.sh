#!/usr/bin/env bash
set -e

docker compose up -d

pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed

pnpm --filter api build
pnpm --filter worker build
pnpm --filter frontend build

pm2 start infra/pm2/ecosystem.config.js
pm2 save
