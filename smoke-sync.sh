#!/usr/bin/env bash
set -e

API="http://127.0.0.1:4010/api"
EMAIL="admin@example.com"
PASSWORD="StrongPass123!"

json_get_token() {
  python3 -c 'import sys, json; print(json.load(sys.stdin)["accessToken"])'
}

json_get_first_workspace_id() {
  python3 -c 'import sys, json; print(json.load(sys.stdin)[0]["id"])'
}

json_get_company_id() {
  python3 -c 'import sys, json; print(json.load(sys.stdin)["id"])'
}

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

TOKEN=$(printf '%s' "$LOGIN_RESPONSE" | json_get_token)

echo "== WORKSPACES =="
WORKSPACES_RESPONSE=$(curl -s "$API/workspaces" \
  -H "Authorization: Bearer $TOKEN")

echo "$WORKSPACES_RESPONSE"
echo
echo

WORKSPACE_ID=$(printf '%s' "$WORKSPACES_RESPONSE" | json_get_first_workspace_id)

echo "== CREATE COMPANY =="
CREATE_COMPANY_RESPONSE=$(curl -s -X POST "$API/companies" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"workspaceId\": \"$WORKSPACE_ID\",
    \"name\": \"Sync Test Company\",
    \"website\": \"https://sync-test.example.com\"
  }")

echo "$CREATE_COMPANY_RESPONSE"
echo
echo

COMPANY_ID=$(printf '%s' "$CREATE_COMPANY_RESPONSE" | json_get_company_id)

echo "== ADD ALIAS =="
curl -s -X POST "$API/companies/$COMPANY_ID/aliases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "value": "Sync Test",
    "priority": 100,
    "isPrimary": false
  }'
echo
echo

echo "== AVAILABLE SOURCES FROM DB =="
SOURCE_ID=$(docker exec -i reputation-postgres psql -U postgres -d reputation_os -Atc 'select id from "Source" limit 1;' | tr -d '\r')
docker exec -i reputation-postgres psql -U postgres -d reputation_os -c 'select * from "Source";'
echo
echo "SOURCE_ID=$SOURCE_ID"
echo

if [ -z "$SOURCE_ID" ]; then
  echo "NO_SOURCE_ROWS"
  exit 1
fi

echo "== GET SOURCES BEFORE =="
curl -s "$API/companies/$COMPANY_ID/sources" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

echo "== ADD SOURCE TARGET =="
curl -s -X POST "$API/companies/$COMPANY_ID/sources" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"sourceId\": \"$SOURCE_ID\",
    \"externalUrl\": \"https://sync-test.example.com\",
    \"displayName\": \"Official Website\",
    \"syncReviewsEnabled\": true,
    \"syncRatingsEnabled\": true,
    \"syncMentionsEnabled\": true
  }"
echo
echo

echo "== GET SOURCES AFTER =="
curl -s "$API/companies/$COMPANY_ID/sources" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

echo "== DISCOVER SOURCES =="
curl -s -X POST "$API/companies/$COMPANY_ID/discover-sources" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

echo "== START SYNC =="
curl -s -X POST "$API/companies/$COMPANY_ID/start-sync" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

echo "== INTERNAL JOBS TICK =="
curl -s -X POST "$API/internal/jobs/tick"
echo
echo

echo "== INTERNAL JOBS RECONCILE =="
curl -s -X POST "$API/internal/jobs/reconcile"
echo
echo

echo "== IDS =="
echo "WORKSPACE_ID=$WORKSPACE_ID"
echo "COMPANY_ID=$COMPANY_ID"
echo "SOURCE_ID=$SOURCE_ID"
