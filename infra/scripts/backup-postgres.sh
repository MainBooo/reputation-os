#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/reputation-os/backups/postgres}"
LOG_FILE="${LOG_FILE:-/opt/reputation-os/logs/postgres-backup.log}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-reputation-postgres}"
POSTGRES_DB="${POSTGRES_DB:-reputation_os}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
KEEP_DAYS="${KEEP_DAYS:-7}"

mkdir -p "$BACKUP_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

timestamp="$(date +%Y%m%d_%H%M%S)"
file="$BACKUP_DIR/${POSTGRES_DB}_${timestamp}.sql.gz"
tmp_file="${file}.tmp"

{
  echo "[backup] start $(date -Is) file=$file"

  docker exec "$POSTGRES_CONTAINER" pg_dump \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --no-owner \
    --no-privileges \
    | gzip -9 > "$tmp_file"

  test -s "$tmp_file"
  mv "$tmp_file" "$file"

  find "$BACKUP_DIR" -maxdepth 1 -type f -name "${POSTGRES_DB}_*.sql.gz" -printf '%T@ %p\n' \
    | sort -rn \
    | tail -n +"$((KEEP_DAYS + 1))" \
    | cut -d' ' -f2- \
    | xargs -r rm -f --

  echo "[backup] done $(date -Is) size=$(du -h "$file" | awk '{print $1}')"
} >> "$LOG_FILE" 2>&1
