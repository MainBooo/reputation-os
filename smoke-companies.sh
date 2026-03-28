#!/usr/bin/env bash
set -e

API="http://127.0.0.1:4010/api"
EMAIL="admin@example.com"
PASSWORD="StrongPass123!"

extract_json_field() {
  python3 -c 'import sys, json; data=json.load(sys.stdin); print(data["accessToken"])'
}

extract_first_workspace_id() {
  python3 -c 'import sys, json; data=json.load(sys.stdin); print(data[0]["id"])'
}

extract_company_id() {
  python3 -c 'import sys, json; data=json.load(sys.stdin); print(data["id"])'
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

TOKEN=$(printf '%s' "$LOGIN_RESPONSE" | extract_json_field)

if [ -z "$TOKEN" ]; then
  echo "FAILED_TO_EXTRACT_TOKEN"
  exit 1
fi

echo "== WORKSPACES =="
WORKSPACES_RESPONSE=$(curl -s "$API/workspaces" \
  -H "Authorization: Bearer $TOKEN")

echo "$WORKSPACES_RESPONSE"
echo
echo

WORKSPACE_ID=$(printf '%s' "$WORKSPACES_RESPONSE" | extract_first_workspace_id)

if [ -z "$WORKSPACE_ID" ]; then
  echo "FAILED_TO_EXTRACT_WORKSPACE_ID"
  exit 1
fi

echo "== CREATE COMPANY =="
CREATE_COMPANY_RESPONSE=$(curl -s -X POST "$API/companies" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"workspaceId\": \"$WORKSPACE_ID\",
    \"name\": \"Acme Inc\",
    \"website\": \"https://acme.example.com\"
  }")

echo "$CREATE_COMPANY_RESPONSE"
echo
echo

COMPANY_ID=$(printf '%s' "$CREATE_COMPANY_RESPONSE" | extract_company_id)

if [ -z "$COMPANY_ID" ]; then
  echo "FAILED_TO_EXTRACT_COMPANY_ID"
  exit 1
fi

echo "== GET COMPANY =="
curl -s "$API/companies/$COMPANY_ID" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

echo "== GET COMPANY SOURCES =="
curl -s "$API/companies/$COMPANY_ID/sources" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

echo "== GET COMPANY MENTIONS =="
curl -s "$API/companies/$COMPANY_ID/mentions" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

echo "== GET RATINGS OVERVIEW =="
curl -s "$API/companies/$COMPANY_ID/ratings/overview" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

echo "== GET ANALYTICS OVERVIEW =="
curl -s "$API/companies/$COMPANY_ID/analytics/overview" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

echo "== IDS =="
echo "WORKSPACE_ID=$WORKSPACE_ID"
echo "COMPANY_ID=$COMPANY_ID"
