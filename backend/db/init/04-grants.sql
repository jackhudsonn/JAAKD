GRANT USAGE ON SCHEMA public TO jaakd_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  profiles,
  portfolios,
  instruments,
  holdings,
  "orderLogs",
  trades,
  watchlist_items
TO jaakd_app;
