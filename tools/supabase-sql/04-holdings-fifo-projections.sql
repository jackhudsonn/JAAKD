-- Add FIFO projection columns to holdings and create FIFO lot tables

-- 1) Extend holdings projection fields (idempotent)
ALTER TABLE holdings
ADD COLUMN IF NOT EXISTS "currentQuantity" NUMERIC(19,6) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "cumulativeRealizedPnl" NUMERIC(19,6) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2) Ensure one holding per portfolio/instrument
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'holdings_portfolio_instrument_unique'
  ) THEN
    ALTER TABLE holdings
    ADD CONSTRAINT holdings_portfolio_instrument_unique UNIQUE ("portfolioID", "instrumentID");
  END IF;
END$$;

-- 3) FIFO buy lots
CREATE TABLE IF NOT EXISTS position_lots (
  "positionLotID" UUID PRIMARY KEY,
  "holdingID" UUID NOT NULL REFERENCES holdings("holdingID") ON DELETE CASCADE,
  "sourceBuyLogOrderID" UUID NOT NULL REFERENCES "orderLogs"("logOrderID") ON DELETE RESTRICT,
  "openedAt" TIMESTAMPTZ NOT NULL,
  "originalQuantity" NUMERIC(19,6) NOT NULL,
  "remainingQuantity" NUMERIC(19,6) NOT NULL,
  "unitCost" NUMERIC(19,6) NOT NULL,
  CONSTRAINT position_lots_non_negative CHECK ("originalQuantity" >= 0 AND "remainingQuantity" >= 0),
  CONSTRAINT position_lots_remaining_not_over_original CHECK ("remainingQuantity" <= "originalQuantity")
);

-- 4) A buy execution should map to at most one lot row
CREATE UNIQUE INDEX IF NOT EXISTS idx_position_lots_source_buy_log_unique
  ON position_lots("sourceBuyLogOrderID");

-- 5) FIFO query support: oldest open lots for a holding
CREATE INDEX IF NOT EXISTS idx_position_lots_fifo_scan
  ON position_lots("holdingID", "openedAt", "positionLotID")
  WHERE "remainingQuantity" > 0;

-- 6) Sell-to-lot realization slices
CREATE TABLE IF NOT EXISTS lot_matches (
  "lotMatchID" UUID PRIMARY KEY,
  "sellLogOrderID" UUID NOT NULL REFERENCES "orderLogs"("logOrderID") ON DELETE RESTRICT,
  "positionLotID" UUID NOT NULL REFERENCES position_lots("positionLotID") ON DELETE RESTRICT,
  "holdingID" UUID NOT NULL REFERENCES holdings("holdingID") ON DELETE CASCADE,
  "matchedQuantity" NUMERIC(19,6) NOT NULL,
  "sellUnitPrice" NUMERIC(19,6) NOT NULL,
  "realizedPnlAmount" NUMERIC(19,6) NOT NULL,
  "matchedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT lot_matches_positive_quantity CHECK ("matchedQuantity" > 0)
);

-- 7) Idempotency guard for executed sell logs
CREATE UNIQUE INDEX IF NOT EXISTS idx_lot_matches_sell_log_position_lot_unique
  ON lot_matches("sellLogOrderID", "positionLotID");

CREATE INDEX IF NOT EXISTS idx_lot_matches_sell_log
  ON lot_matches("sellLogOrderID");

CREATE INDEX IF NOT EXISTS idx_lot_matches_holding
  ON lot_matches("holdingID");
