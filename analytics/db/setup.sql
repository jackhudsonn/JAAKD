-- Analytics database setup: roles, schemas and the raw tables the nightly copy job loads.
-- Safe to rerun. Plain Postgres only (no extensions, no provider features) so the same file
-- runs on local Docker, Lightsail and Aurora.
--
-- Run as the database owner/superuser with two psql variables:
--   psql -v ON_ERROR_STOP=1 -v pipeline_password=... -v app_reader_password=... -f setup.sql
-- Locally this is done by init/00-setup.sh on the container's first start.
--
-- Raw tables mirror the source tables in backend/db/init/01-schema.sql (same names, quoted
-- camelCase columns and types), limited to the columns analytics needs. CREATE TABLE IF NOT
-- EXISTS does not change an existing table: when a source column changes, alter the raw table
-- to match (the copy job's drift check fails until it does).

BEGIN;

-- 1) Roles
-- analytics_pipeline: owns everything; used by the copy job and dbt.
-- analytics_app_reader: used by the backend; may only read schema "analytics".
SELECT format('CREATE ROLE analytics_pipeline LOGIN PASSWORD %L', :'pipeline_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'analytics_pipeline')
\gexec

SELECT format('ALTER ROLE analytics_pipeline WITH LOGIN PASSWORD %L', :'pipeline_password')
\gexec

SELECT format('CREATE ROLE analytics_app_reader LOGIN PASSWORD %L', :'app_reader_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'analytics_app_reader')
\gexec

SELECT format('ALTER ROLE analytics_app_reader WITH LOGIN PASSWORD %L', :'app_reader_password')
\gexec

ALTER ROLE analytics_app_reader SET default_transaction_read_only = on;

-- A non-superuser setup user (Lightsail/Aurora master user) must be a member of
-- analytics_pipeline to create objects owned by it below.
SELECT format('GRANT analytics_pipeline TO %I', current_user)
WHERE NOT pg_has_role(current_user, 'analytics_pipeline', 'MEMBER')
\gexec

-- 2) Database: only the two roles connect; dates are bucketed in UTC.
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database())
\gexec

-- CREATE lets dbt run "create schema if not exists" on its own schemas.
SELECT format('GRANT CONNECT, CREATE, TEMPORARY ON DATABASE %I TO analytics_pipeline', current_database())
\gexec

SELECT format('GRANT CONNECT ON DATABASE %I TO analytics_app_reader', current_database())
\gexec

SELECT format('ALTER DATABASE %I SET timezone = %L', current_database(), 'UTC')
\gexec

-- 3) Schemas
-- raw: nightly copy of production (copy job). analytics_staging: dbt staging/intermediate views.
-- analytics: dbt marts, the contract the backend reads.
CREATE SCHEMA IF NOT EXISTS raw AUTHORIZATION analytics_pipeline;
CREATE SCHEMA IF NOT EXISTS analytics_staging AUTHORIZATION analytics_pipeline;
CREATE SCHEMA IF NOT EXISTS analytics AUTHORIZATION analytics_pipeline;

ALTER SCHEMA raw OWNER TO analytics_pipeline;
ALTER SCHEMA analytics_staging OWNER TO analytics_pipeline;
ALTER SCHEMA analytics OWNER TO analytics_pipeline;

-- 4) Backend read access: schema "analytics" only, including marts dbt creates later.
GRANT USAGE ON SCHEMA analytics TO analytics_app_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO analytics_app_reader;

-- 5) Raw tables, created as analytics_pipeline so it owns them.
SET ROLE analytics_pipeline;

ALTER DEFAULT PRIVILEGES IN SCHEMA analytics GRANT SELECT ON TABLES TO analytics_app_reader;

-- No logoUrl/description: not used by analytics.
CREATE TABLE IF NOT EXISTS raw.instruments (
  "instrumentID" UUID PRIMARY KEY,
  ticker TEXT NOT NULL,
  market TEXT NOT NULL,
  name TEXT NOT NULL,
  "instrumentClass" TEXT NOT NULL,
  "tradingCurrency" TEXT NOT NULL
);

-- No portfolioName: user-entered, may be personal.
CREATE TABLE IF NOT EXISTS raw.portfolios (
  "portfolioID" UUID PRIMARY KEY,
  "userID" UUID NOT NULL
);

-- Only non-identifying profile fields. "ageBand" is computed on prod from dob, which never leaves it.
CREATE TABLE IF NOT EXISTS raw.profiles (
  "userID" UUID PRIMARY KEY,
  "userType" NUMERIC NOT NULL,
  state TEXT,
  country TEXT,
  "ageBand" TEXT NOT NULL,
  CONSTRAINT chk_raw_profiles_age_band
    CHECK ("ageBand" IN ('<25', '25-34', '35-44', '45-54', '55-64', '65+', 'unknown'))
);

CREATE TABLE IF NOT EXISTS raw.holdings (
  "holdingID" UUID PRIMARY KEY,
  "portfolioID" UUID NOT NULL,
  "instrumentID" UUID NOT NULL,
  "currentQuantity" NUMERIC(19,6) NOT NULL,
  "cumulativeRealizedPnl" NUMERIC(19,6) NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL
);

-- metadata is kept: FX conversions record the target currency and amount there.
CREATE TABLE IF NOT EXISTS raw."orderLogs" (
  "logOrderID" UUID PRIMARY KEY,
  "orderID" UUID NOT NULL,
  "portfolioID" UUID NOT NULL,
  "instrumentID" UUID NOT NULL,
  side TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  "timestamp" TIMESTAMP NOT NULL,
  metadata TEXT,
  status TEXT NOT NULL,
  "executionPrice" DOUBLE PRECISION,
  "quotedPrice" DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS raw.position_lots (
  "positionLotID" UUID PRIMARY KEY,
  "holdingID" UUID NOT NULL,
  "sourceBuyLogOrderID" UUID NOT NULL,
  "openedAt" TIMESTAMP NOT NULL,
  "originalQuantity" NUMERIC(19,6) NOT NULL,
  "remainingQuantity" NUMERIC(19,6) NOT NULL,
  "unitCost" NUMERIC(19,6) NOT NULL
);

CREATE TABLE IF NOT EXISTS raw.lot_matches (
  "lotMatchID" UUID PRIMARY KEY,
  "sellLogOrderID" UUID NOT NULL,
  "positionLotID" UUID NOT NULL,
  "holdingID" UUID NOT NULL,
  "matchedQuantity" NUMERIC(19,6) NOT NULL,
  "sellUnitPrice" NUMERIC(19,6) NOT NULL,
  "realizedPnlAmount" NUMERIC(19,6) NOT NULL,
  "matchedAt" TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS raw."instrumentPrices" (
  "instrumentID" UUID NOT NULL,
  "priceDate" DATE NOT NULL,
  open NUMERIC(24,10) NOT NULL,
  high NUMERIC(24,10) NOT NULL,
  low NUMERIC(24,10) NOT NULL,
  close NUMERIC(24,10) NOT NULL,
  "adjClose" NUMERIC(24,10) NOT NULL,
  volume BIGINT,
  currency TEXT NOT NULL,
  synthetic BOOLEAN NOT NULL,
  "fetchedAt" TIMESTAMP NOT NULL,
  PRIMARY KEY ("instrumentID", "priceDate")
);

-- One row per table per copy run; meta_build reads MAX(source_snapshot_at) for "data as of".
CREATE TABLE IF NOT EXISTS raw._load_log (
  run_id UUID NOT NULL,
  table_name TEXT NOT NULL,
  row_count BIGINT NOT NULL,
  source_snapshot_at TIMESTAMPTZ NOT NULL,
  loaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, table_name)
);

RESET ROLE;

COMMIT;
