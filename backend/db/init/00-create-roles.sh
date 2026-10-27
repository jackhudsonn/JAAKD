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

# Optional read-only role for the analytics copy job (analytics/copy). Skipped when no password
# is set; its grants are applied in 01-schema.sql only if the role exists.
if [ -z "${JAAKD_ANALYTICS_DB_PASSWORD:-}" ]; then
  echo "JAAKD_ANALYTICS_DB_PASSWORD not set; skipping jaakd_analytics_reader"
  exit 0
fi

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set analytics_db_password="$JAAKD_ANALYTICS_DB_PASSWORD" <<'EOSQL'
SELECT format('CREATE ROLE jaakd_analytics_reader LOGIN PASSWORD %L', :'analytics_db_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jaakd_analytics_reader')
\gexec

SELECT format('ALTER ROLE jaakd_analytics_reader WITH LOGIN PASSWORD %L', :'analytics_db_password')
\gexec

ALTER ROLE jaakd_analytics_reader SET default_transaction_read_only = on;
ALTER ROLE jaakd_analytics_reader SET statement_timeout = '5min';
EOSQL
