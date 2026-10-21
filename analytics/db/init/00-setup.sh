#!/usr/bin/env sh
set -eu

# Runs once, on the analytics container's first start with an empty volume, and applies
# /opt/jaakd-analytics/setup.sql (mounted from analytics/db/). setup.sql is safe to rerun:
#   docker exec jaakd-analytics-postgres sh /docker-entrypoint-initdb.d/00-setup.sh

if [ -z "${ANALYTICS_PIPELINE_DB_PASSWORD:-}" ]; then
  echo "ERROR: ANALYTICS_PIPELINE_DB_PASSWORD is required" >&2
  exit 1
fi

if [ -z "${ANALYTICS_APP_READER_DB_PASSWORD:-}" ]; then
  echo "ERROR: ANALYTICS_APP_READER_DB_PASSWORD (ANALYTICS_DB_PASSWORD in .env) is required" >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set pipeline_password="$ANALYTICS_PIPELINE_DB_PASSWORD" \
  --set app_reader_password="$ANALYTICS_APP_READER_DB_PASSWORD" \
  -f /opt/jaakd-analytics/setup.sql
