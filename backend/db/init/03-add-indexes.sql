CREATE INDEX idx_portfolios_userid ON portfolios ("userID");

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
