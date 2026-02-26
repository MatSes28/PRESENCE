#!/bin/bash

# Database restore helper.
#
# Restores a logical Postgres dump into the configured database.
#
# Requirements:
# - local psql in PATH
# - Environment variables:
#   DATABASE_URL (recommended)
#   OR DB_USER/DB_PASSWORD/DB_NAME/DB_HOST/DB_PORT

set -euo pipefail

backup_file="${1:-}"
if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
  echo "Usage: $0 <path-to-backup.sql>" >&2
  exit 1
fi

if [ -n "${DATABASE_URL:-}" ]; then
  echo "Restoring backup using DATABASE_URL..."
  psql "$DATABASE_URL" -f "$backup_file"
else
  : "${DB_USER:?Missing DB_USER}"
  : "${DB_PASSWORD:?Missing DB_PASSWORD}"
  : "${DB_NAME:?Missing DB_NAME}"
  DB_HOST="${DB_HOST:-localhost}"
  DB_PORT="${DB_PORT:-5432}"

  echo "Restoring backup using DB_* variables..."
  PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -f "$backup_file"
fi

echo "Restore completed: $backup_file"

