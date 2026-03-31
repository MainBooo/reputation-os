#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:4010/api}"
EMAIL="${1:-demo@reputation.local}"
PASSWORD="${2:-demo123}"

RESP="$(curl -sS -X POST "$API_URL/auth/login" \
  -H 'Content-Type: application/json' \
  --data "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"

TOKEN="$(python3 -c 'import sys, json
raw = sys.argv[1]
data = json.loads(raw)
print(data.get("accessToken") or data.get("token") or data.get("data", {}).get("accessToken") or "")
' "$RESP")"

if [ -z "$TOKEN" ]; then
  echo "ERROR: accessToken not found in response" >&2
  echo "Response:" >&2
  echo "$RESP" >&2
  exit 1
fi

printf '%s\n' "$TOKEN"
