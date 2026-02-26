#!/bin/bash

# Database backup helper.
#
# This script creates a logical Postgres backup using pg_dump, writing a file
# into ./backups/ (host path) for docker-compose.production.yml deployments.
#
# Requirements:
# - Docker (for compose deployments), OR local pg_dump in PATH
# - Environment variables:
#   DATABASE_URL (recommended)
#   OR DB_USER/DB_PASSWORD/DB_NAME/DB_HOST/DB_PORT

set -euo pipefail

timestamp=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
out_dir="${BACKUP_DIR:-./backups}"
mkdir -p "$out_dir"

outfile="$out_dir/backup-${timestamp}.sql"

if [ -n "${DATABASE_URL:-}" ]; then
  echo "Creating backup using DATABASE_URL..."
  # Avoid putting password in args: rely on libpq parsing DATABASE_URL.
  # Note: if your pg_dump does not support password prompts in non-interactive,
  # set PGPASSWORD in the environment.
  pg_dump "$DATABASE_URL" --no-owner --no-privileges --file "$outfile"
else
  : "${DB_USER:?Missing DB_USER}"
  : "${DB_PASSWORD:?Missing DB_PASSWORD}"
  : "${DB_NAME:?Missing DB_NAME}"
  DB_HOST="${DB_HOST:-localhost}"
  DB_PORT="${DB_PORT:-5432}"

  echo "Creating backup using DB_* variables..."
  PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --no-owner --no-privileges \
    --file "$outfile"
fi

echo "Backup written: $outfile"

