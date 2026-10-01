CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Tables
CREATE TABLE IF NOT EXISTS users (
  "userID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  roles TEXT[] NOT NULL DEFAULT '{CLIENT}',
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

-- Server-side session store. The browser holds only the opaque "sessionID";
-- credentials and provider tokens stay on the server.
CREATE TABLE IF NOT EXISTS sessions (
  "sessionID" UUID PRIMARY KEY,
  "userID" UUID NOT NULL,
  "refreshToken" TEXT NULL, -- provider refresh token; null for the dev provider
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "expiresAt" TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  "userID" UUID PRIMARY KEY,
  "userType" NUMERIC NOT NULL DEFAULT 0,
  "firstName" TEXT,
  "lastName" TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  "zipCode" TEXT,
  dob DATE,
  username TEXT,
  avatar TEXT
);

CREATE TABLE IF NOT EXISTS portfolios (
  "portfolioID" UUID PRIMARY KEY,
  "userID" UUID NOT NULL,
  "portfolioName" TEXT
);

CREATE TABLE IF NOT EXISTS instruments (
  "instrumentID" UUID PRIMARY KEY,
  ticker TEXT NOT NULL,
  market TEXT NOT NULL,
  name TEXT NOT NULL,
  "instrumentClass" TEXT NOT NULL,
  "logoUrl" TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS holdings (
  "holdingID" UUID PRIMARY KEY,
  "portfolioID" UUID NOT NULL,
  "instrumentID" UUID NOT NULL,
  "currentQuantity" NUMERIC(19,6) NOT NULL DEFAULT 0,
  "cumulativeRealizedPnl" NUMERIC(19,6) NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "orderLogs" (
  "logOrderID" UUID PRIMARY KEY,
  "orderID" UUID NOT NULL,
  "portfolioID" UUID NOT NULL,
  "instrumentID" UUID NOT NULL,
  side TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  "timestamp" TIMESTAMP NOT NULL,
  metadata TEXT,
  status TEXT NOT NULL,
  "executionPrice" DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS position_lots (
  "positionLotID" UUID PRIMARY KEY,
  "holdingID" UUID NOT NULL,
  "sourceBuyLogOrderID" UUID NOT NULL,
  "openedAt" TIMESTAMP NOT NULL,
  "originalQuantity" NUMERIC(19,6) NOT NULL,
  "remainingQuantity" NUMERIC(19,6) NOT NULL,
  "unitCost" NUMERIC(19,6) NOT NULL
);

CREATE TABLE IF NOT EXISTS lot_matches (
  "lotMatchID" UUID PRIMARY KEY,
  "sellLogOrderID" UUID NOT NULL,
  "positionLotID" UUID NOT NULL,
  "holdingID" UUID NOT NULL,
  "matchedQuantity" NUMERIC(19,6) NOT NULL,
  "sellUnitPrice" NUMERIC(19,6) NOT NULL,
  "realizedPnlAmount" NUMERIC(19,6) NOT NULL,
  "matchedAt" TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS watchlist_items (
  "listItemID" UUID PRIMARY KEY,
  "portfolioID" UUID NOT NULL,
  "instrumentID" UUID NOT NULL,
  name TEXT
);

-- 2) Constraints
ALTER TABLE users
  ADD CONSTRAINT chk_users_email_not_blank
  CHECK (btrim(email) <> '');

ALTER TABLE users
  ADD CONSTRAINT chk_users_roles_not_empty
  CHECK (array_length(roles, 1) >= 1);

-- A profile can only exist for a registered user; RESTRICT so deleting a user never removes their profile and order history (BR-14, BR-15).
ALTER TABLE profiles
  ADD CONSTRAINT fk_profiles_users
  FOREIGN KEY ("userID") REFERENCES users("userID")
  ON DELETE RESTRICT;

ALTER TABLE sessions
  ADD CONSTRAINT fk_sessions_users
  FOREIGN KEY ("userID") REFERENCES users("userID")
  ON DELETE CASCADE;

ALTER TABLE profiles
  ADD CONSTRAINT chk_profiles_dob_range
  CHECK (dob IS NULL OR dob >= DATE '1900-01-01');

ALTER TABLE portfolios
  ADD CONSTRAINT fk_portfolios_profiles
  FOREIGN KEY ("userID") REFERENCES profiles("userID")
  ON DELETE CASCADE;

ALTER TABLE holdings
  ADD CONSTRAINT fk_holdings_portfolios
  FOREIGN KEY ("portfolioID") REFERENCES portfolios("portfolioID")
  ON DELETE CASCADE;

ALTER TABLE holdings
  ADD CONSTRAINT fk_holdings_instruments
  FOREIGN KEY ("instrumentID") REFERENCES instruments("instrumentID");

ALTER TABLE holdings
  ADD CONSTRAINT uq_holdings_portfolio_instrument
  UNIQUE ("portfolioID", "instrumentID");

ALTER TABLE "orderLogs"
  ADD CONSTRAINT fk_orderlogs_portfolios
  FOREIGN KEY ("portfolioID") REFERENCES portfolios("portfolioID");

ALTER TABLE "orderLogs"
  ADD CONSTRAINT fk_orderlogs_instruments
  FOREIGN KEY ("instrumentID") REFERENCES instruments("instrumentID");

ALTER TABLE "orderLogs"
  ADD CONSTRAINT chk_orderlogs_side
  CHECK (side IN ('BUY', 'SELL', 'DEPOSIT', 'WITHDRAW'));

ALTER TABLE "orderLogs"
  ADD CONSTRAINT chk_orderlogs_status
  CHECK (status IN ('SUBMITTED', 'PENDING', 'CANCELLED', 'ACCEPTED', 'REJECTED', 'EXECUTED', 'FAILED'));

ALTER TABLE position_lots
  ADD CONSTRAINT fk_position_lots_holdings
  FOREIGN KEY ("holdingID") REFERENCES holdings("holdingID")
  ON DELETE CASCADE;

ALTER TABLE position_lots
  ADD CONSTRAINT fk_position_lots_orderlogs
  FOREIGN KEY ("sourceBuyLogOrderID") REFERENCES "orderLogs"("logOrderID");

ALTER TABLE position_lots
  ADD CONSTRAINT chk_position_lots_non_negative
  CHECK ("originalQuantity" >= 0 AND "remainingQuantity" >= 0);

ALTER TABLE position_lots
  ADD CONSTRAINT chk_position_lots_remaining_not_over_original
  CHECK ("remainingQuantity" <= "originalQuantity");

ALTER TABLE lot_matches
  ADD CONSTRAINT fk_lot_matches_orderlogs
  FOREIGN KEY ("sellLogOrderID") REFERENCES "orderLogs"("logOrderID");

ALTER TABLE lot_matches
  ADD CONSTRAINT fk_lot_matches_position_lots
  FOREIGN KEY ("positionLotID") REFERENCES position_lots("positionLotID");

ALTER TABLE lot_matches
  ADD CONSTRAINT fk_lot_matches_holdings
  FOREIGN KEY ("holdingID") REFERENCES holdings("holdingID")
  ON DELETE CASCADE;

ALTER TABLE lot_matches
  ADD CONSTRAINT chk_lot_matches_positive_quantity
  CHECK ("matchedQuantity" > 0);

ALTER TABLE watchlist_items
  ADD CONSTRAINT fk_watchlist_items_portfolios
  FOREIGN KEY ("portfolioID") REFERENCES portfolios("portfolioID")
  ON DELETE CASCADE;

ALTER TABLE watchlist_items
  ADD CONSTRAINT fk_watchlist_items_instruments
  FOREIGN KEY ("instrumentID") REFERENCES instruments("instrumentID");

-- 3) Indexes
CREATE INDEX idx_portfolios_userid ON portfolios ("userID");

CREATE INDEX idx_sessions_userid ON sessions ("userID");

CREATE INDEX idx_holdings_portfolioid ON holdings ("portfolioID");
CREATE INDEX idx_holdings_instrumentid ON holdings ("instrumentID");

CREATE INDEX idx_orderlogs_portfolioid ON "orderLogs" ("portfolioID");
CREATE INDEX idx_orderlogs_instrumentid ON "orderLogs" ("instrumentID");

CREATE UNIQUE INDEX idx_position_lots_source_buy_log_unique ON position_lots ("sourceBuyLogOrderID");
CREATE INDEX idx_position_lots_fifo_scan ON position_lots ("holdingID", "openedAt", "positionLotID") WHERE "remainingQuantity" > 0;

CREATE UNIQUE INDEX idx_lot_matches_sell_log_position_lot_unique ON lot_matches ("sellLogOrderID", "positionLotID");
CREATE INDEX idx_lot_matches_sell_log ON lot_matches ("sellLogOrderID");
CREATE INDEX idx_lot_matches_holding ON lot_matches ("holdingID");

CREATE INDEX idx_watchlist_items_portfolioid ON watchlist_items ("portfolioID");
CREATE INDEX idx_watchlist_items_instrumentid ON watchlist_items ("instrumentID");

-- 4) Grants
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO jaakd_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  profiles,
  portfolios,
  instruments,
  holdings,
  "orderLogs",
  position_lots,
  lot_matches,
  watchlist_items
TO jaakd_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users, sessions TO jaakd_app;

-- 5) Seed data
-- Seed canonical cash instrument used for cash-balance holdings projection
-- Stable lookup key: ticker = 'USD_CASH' (case-insensitive)
INSERT INTO instruments (
  "instrumentID",
  ticker,
  market,
  name,
  "instrumentClass",
  "logoUrl",
  description
)
SELECT
  gen_random_uuid(),
  'USD_CASH',
  'INTERNAL',
  'US Dollar Cash Balance',
  'USD',
  NULL,
  'Synthetic cash instrument used to represent portfolio cash balance in holdings.'
WHERE NOT EXISTS (
  SELECT 1
  FROM instruments i
  WHERE UPPER(i.ticker) = 'USD_CASH'
);
