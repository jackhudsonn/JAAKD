#!/usr/bin/env sh
set -eu

# Applies the development-only credential schema when it is present.
# In production the file is not mounted and this script is a no-op, so the
# application schema stays provider- and environment-neutral.
if [ -f /opt/jaakd-dev/01-dev-credentials.sql ]; then
  psql -v ON_ERROR_STOP=1 \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    -f /opt/jaakd-dev/01-dev-credentials.sql
fi
