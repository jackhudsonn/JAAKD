-- Create holdings table to track current positions of instruments in portfolios
CREATE TABLE holdings (
  "holdingID" UUID PRIMARY KEY,
  "portfolioID" UUID NOT NULL REFERENCES portfolios("portfolioID") ON DELETE CASCADE,
  "instrumentID" UUID NOT NULL REFERENCES instruments("instrumentID") ON DELETE CASCADE,
  "currentQuantity" DOUBLE PRECISION NOT NULL,
  UNIQUE("portfolioID", "instrumentID")
);

CREATE INDEX IF NOT EXISTS idx_holdings_portfolio ON holdings("portfolioID");
CREATE INDEX IF NOT EXISTS idx_holdings_instrument ON holdings("instrumentID");
