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

ALTER TABLE trades
  ADD CONSTRAINT fk_trades_holdings
  FOREIGN KEY ("holdingID") REFERENCES holdings("holdingID")
  ON DELETE CASCADE;

ALTER TABLE trades
  ADD CONSTRAINT fk_trades_orderlogs
  FOREIGN KEY ("orderLogID") REFERENCES "orderLogs"("logOrderID");

ALTER TABLE trades
  ADD CONSTRAINT uq_trades_orderlog
  UNIQUE ("orderLogID");

ALTER TABLE watchlist_items
  ADD CONSTRAINT fk_watchlist_items_portfolios
  FOREIGN KEY ("portfolioID") REFERENCES portfolios("portfolioID")
  ON DELETE CASCADE;

ALTER TABLE watchlist_items
  ADD CONSTRAINT fk_watchlist_items_instruments
  FOREIGN KEY ("instrumentID") REFERENCES instruments("instrumentID");
