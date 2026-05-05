#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:4010/api/health}"
FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1:4011/login}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-reputation-postgres}"
POSTGRES_DB="${POSTGRES_DB:-reputation_os}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
REDIS_CONTAINER="${REDIS_CONTAINER:-reputation-redis}"

fail() {
  echo "[healthcheck] FAILED: $1" >&2
  exit 1
}

curl -fsS "$API_URL" >/dev/null || fail "api health is not reachable: $API_URL"
curl -fsSI "$FRONTEND_URL" >/dev/null || fail "frontend is not reachable: $FRONTEND_URL"

docker exec "$POSTGRES_CONTAINER" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null || fail "postgres is not ready"
docker exec "$REDIS_CONTAINER" redis-cli ping | grep -q '^PONG$' || fail "redis is not ready"

pm2 describe reputation-api >/dev/null || fail "pm2 reputation-api missing"
pm2 describe reputation-worker >/dev/null || fail "pm2 reputation-worker missing"
pm2 describe reputation-frontend >/dev/null || fail "pm2 reputation-frontend missing"

echo "[healthcheck] OK $(date -Is)"
