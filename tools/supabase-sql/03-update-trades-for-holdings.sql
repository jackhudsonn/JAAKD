-- Update trades table: replace porfolioID with holdingID to reference the new holdings entity
ALTER TABLE trades 
DROP COLUMN "porfolioID",
ADD COLUMN "holdingID" UUID NOT NULL REFERENCES holdings("holdingID") ON DELETE CASCADE;

-- Create unique constraint to ensure one holding per trade per orderLog
CREATE UNIQUE INDEX IF NOT EXISTS idx_trades_holding_orderlog ON trades("holdingID", "orderLogID");
