-- Run manually after startup. This file is intentionally outside backend/db/init.

-- 1) Basic structure checks
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'portfolios', 'instruments', 'holdings', 'orderLogs', 'trades', 'watchlist_items')
ORDER BY table_name;

-- 2) Foreign key index checks
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('portfolios', 'holdings', 'orderLogs', 'trades', 'watchlist_items')
ORDER BY tablename, indexname;

-- 3) Deliberate bad insert to prove unique("portfolioID","instrumentID") is enforced
-- Expected: this script fails on the second holdings insert.
BEGIN;

INSERT INTO profiles ("userID", email, "userType")
VALUES ('00000000-0000-0000-0000-000000000001', 'verify@example.com', 0)
ON CONFLICT ("userID") DO NOTHING;

INSERT INTO portfolios ("portfolioID", "userID", "portfolioName")
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'verify-portfolio')
ON CONFLICT ("portfolioID") DO NOTHING;

INSERT INTO instruments ("instrumentID", ticker, market, name, "instrumentClass")
VALUES ('00000000-0000-0000-0000-000000000003', 'VCHK', 'TEST', 'Verify Check', 'EQUITY')
ON CONFLICT ("instrumentID") DO NOTHING;

INSERT INTO holdings ("holdingID", "portfolioID", "instrumentID", "currentQuantity")
VALUES ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 10.0);

-- Deliberate duplicate on ("portfolioID","instrumentID")
INSERT INTO holdings ("holdingID", "portfolioID", "instrumentID", "currentQuantity")
VALUES ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 20.0);

ROLLBACK;
