CREATE INDEX idx_portfolios_userid ON portfolios ("userID");

CREATE INDEX idx_holdings_portfolioid ON holdings ("portfolioID");
CREATE INDEX idx_holdings_instrumentid ON holdings ("instrumentID");

CREATE INDEX idx_orderlogs_portfolioid ON "orderLogs" ("portfolioID");
CREATE INDEX idx_orderlogs_instrumentid ON "orderLogs" ("instrumentID");

CREATE INDEX idx_trades_holdingid ON trades ("holdingID");
CREATE INDEX idx_trades_orderlogid ON trades ("orderLogID");

CREATE INDEX idx_watchlist_items_portfolioid ON watchlist_items ("portfolioID");
CREATE INDEX idx_watchlist_items_instrumentid ON watchlist_items ("instrumentID");
