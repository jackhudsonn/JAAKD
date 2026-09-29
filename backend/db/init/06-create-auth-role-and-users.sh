#!/usr/bin/env sh
set -eu

if [ -z "${JAAKD_AUTH_DB_PASSWORD:-}" ]; then
  echo "ERROR: JAAKD_AUTH_DB_PASSWORD is required" >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set auth_db_password="$JAAKD_AUTH_DB_PASSWORD" <<'EOSQL'
SELECT format('CREATE ROLE jaakd_auth LOGIN PASSWORD %L', :'auth_db_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jaakd_auth')
\gexec

SELECT format('ALTER ROLE jaakd_auth WITH LOGIN PASSWORD %L', :'auth_db_password')
\gexec

CREATE TABLE IF NOT EXISTS users (
  "userID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  "passwordHash" TEXT NOT NULL,
  roles TEXT[] NOT NULL DEFAULT '{CLIENT}',
  "refreshToken" TEXT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE users FROM PUBLIC;
REVOKE ALL ON TABLE users FROM jaakd_app;

GRANT USAGE ON SCHEMA public TO jaakd_auth;
GRANT SELECT, INSERT, UPDATE ON TABLE users TO jaakd_auth;
EOSQL
