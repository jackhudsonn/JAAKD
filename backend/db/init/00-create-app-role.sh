#!/usr/bin/env sh
set -eu

if [ -z "${JAAKD_APP_DB_PASSWORD:-}" ]; then
  echo "ERROR: JAAKD_APP_DB_PASSWORD is required" >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set app_db_password="$JAAKD_APP_DB_PASSWORD" <<'EOSQL'
SELECT format('CREATE ROLE jaakd_app LOGIN PASSWORD %L', :'app_db_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jaakd_app')
\gexec

SELECT format('ALTER ROLE jaakd_app WITH LOGIN PASSWORD %L', :'app_db_password')
\gexec
EOSQL
