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
