-- Run manually after startup. This file is intentionally outside backend/db/init.

-- 1) Basic structure checks
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'portfolios', 'instruments', 'holdings', 'orderLogs', 'position_lots', 'lot_matches', 'watchlist_items', 'users')
ORDER BY table_name;

-- 1b) Ensure the canonical cash instrument exists
SELECT "instrumentID", ticker, market, name, "instrumentClass"
FROM instruments
WHERE UPPER(ticker) = 'USD_CASH';

-- 2) Foreign key index checks
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('portfolios', 'holdings', 'orderLogs', 'position_lots', 'lot_matches', 'watchlist_items')
ORDER BY tablename, indexname;

-- 2a) Ensure the profiles-to-users foreign key exists
SELECT
  conname,
  conrelid::regclass AS source_table,
  confrelid::regclass AS target_table,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname = 'fk_profiles_users';

-- 2b) Role privilege checks
SELECT has_table_privilege('jaakd_app', 'public.users', 'SELECT') AS jaakd_app_can_select_users;
SELECT has_table_privilege('jaakd_app', 'public.sessions', 'INSERT') AS jaakd_app_can_insert_sessions;

-- 3) Deliberate bad insert to prove profiles must reference users
-- Expected: this block fails on the profiles insert.
BEGIN;

INSERT INTO profiles ("userID", "userType")
VALUES (gen_random_uuid(), 0);

ROLLBACK;

-- 4) Deliberate bad insert to prove unique("portfolioID","instrumentID") is enforced
-- Expected: this script fails on the second holdings insert.
BEGIN;

INSERT INTO users ("userID")
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT ("userID") DO NOTHING;

INSERT INTO profiles ("userID", "userType")
VALUES ('00000000-0000-0000-0000-000000000001', 0)
ON CONFLICT ("userID") DO NOTHING;

INSERT INTO portfolios ("portfolioID", "userID", "portfolioName")
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'verify-portfolio')
ON CONFLICT ("portfolioID") DO NOTHING;

INSERT INTO instruments ("instrumentID", ticker, market, name, "instrumentClass")
VALUES ('00000000-0000-0000-0000-000000000003', 'VCHK', 'TEST', 'Verify Check', 'EQUITY')
ON CONFLICT ("instrumentID") DO NOTHING;

INSERT INTO holdings ("holdingID", "portfolioID", "instrumentID", "currentQuantity", "cumulativeRealizedPnl", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 10.000000, 0.000000, now());

-- Deliberate duplicate on ("portfolioID","instrumentID")
INSERT INTO holdings ("holdingID", "portfolioID", "instrumentID", "currentQuantity", "cumulativeRealizedPnl", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 20.000000, 0.000000, now());

ROLLBACK;
