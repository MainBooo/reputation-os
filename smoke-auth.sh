#!/usr/bin/env bash
set -e

API="http://127.0.0.1:4010/api"
EMAIL="admin@example.com"
PASSWORD="StrongPass123!"

echo "== REGISTER =="
REGISTER_RESPONSE=$(curl -s -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

echo "$REGISTER_RESPONSE"
echo
echo

echo "== LOGIN =="
LOGIN_RESPONSE=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

echo "$LOGIN_RESPONSE"
echo
echo

TOKEN=$(printf '%s' "$LOGIN_RESPONSE" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')

if [ -z "$TOKEN" ]; then
  echo "FAILED_TO_EXTRACT_TOKEN"
  exit 1
fi

echo "== AUTH ME =="
curl -s "$API/auth/me" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

echo "== WORKSPACES =="
curl -s "$API/workspaces" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

echo "== TOKEN =="
echo "$TOKEN"
