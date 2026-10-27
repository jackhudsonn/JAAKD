-- Adds the read-only jaakd_analytics_reader role (used by the analytics copy job, analytics/copy)
-- to an existing database (Lightsail prod, dev Postgres).
-- Fresh databases get the same role from backend/db/init/00-create-roles.sh and grants from 01-schema.sql.
-- Safe to rerun. Run as the database owner:
--   psql -v ON_ERROR_STOP=1 -v analytics_db_password=... -f 002_analytics_reader.sql

BEGIN;

SELECT format('CREATE ROLE jaakd_analytics_reader LOGIN PASSWORD %L', :'analytics_db_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jaakd_analytics_reader')
\gexec

SELECT format('ALTER ROLE jaakd_analytics_reader WITH LOGIN PASSWORD %L', :'analytics_db_password')
\gexec

ALTER ROLE jaakd_analytics_reader SET default_transaction_read_only = on;
ALTER ROLE jaakd_analytics_reader SET statement_timeout = '5min';

-- Same grants as 01-schema.sql. No access to users, sessions, payment_methods, preferences,
-- watchlists, watchlist_items, portfolio names or profile names/address.
GRANT USAGE ON SCHEMA public TO jaakd_analytics_reader;
GRANT SELECT ON TABLE
  instruments,
  holdings,
  "orderLogs",
  position_lots,
  lot_matches,
  "instrumentPrices"
TO jaakd_analytics_reader;
GRANT SELECT ("portfolioID", "userID") ON TABLE portfolios TO jaakd_analytics_reader;
GRANT SELECT ("userID", "userType", state, country, dob) ON TABLE profiles TO jaakd_analytics_reader;

COMMIT;
