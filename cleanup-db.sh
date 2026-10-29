#!/usr/bin/env bash
# Full application reset. This script is never invoked during a normal deployment.
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$SCRIPT_DIR"
command -v docker >/dev/null || { printf '%s\n' 'Docker is required.' >&2; exit 1; }
[[ -f .env ]] || { printf '%s\n' '.env not found in the project directory.' >&2; exit 1; }
[[ -f cleanup-db.sql ]] || { printf '%s\n' 'cleanup-db.sql not found.' >&2; exit 1; }
if [[ "${1:-}" == '--check' ]]; then
  docker compose config --quiet
  printf '%s\n' 'Configuration valid. No database changes were made.'
  exit 0
fi
printf '%s\n' 'This will permanently delete all application data and migration history.' 'Other public-schema tables are kept.'
read -r -p 'Type DELETE to reset the application database: ' CONFIRM
[[ "$CONFIRM" == 'DELETE' ]] || { printf '%s\n' 'Cancelled.'; exit 0; }
# Compose reads .env itself; secrets are neither sourced as shell code nor printed.
docker compose stop frontend backend
docker compose run --rm --no-deps -T migrate npx prisma db execute --stdin --schema prisma/schema.prisma < cleanup-db.sql
printf '%s\n' 'Application tables removed.' 'Recreate the schema and initial account with:' '  docker compose up -d --force-recreate migrate backend frontend'
