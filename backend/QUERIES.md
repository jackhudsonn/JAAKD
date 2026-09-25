# JAAKD: Queries

The queries our application requires, one per API in [`openapi.yaml`](openapi.yaml).
Core flow now uses `OrderLog` as source of truth plus SQL aggregation for holdings.

`:userId` is the signed-in user (from the JWT). Every query on user data filters by it, so users only see their own data.

---

## Required queries

### findInstrumentByNameAndTime (`GET /api/instruments/prices?name=&at=`) *(planned)*
Finds an instrument by name or ticker and returns its latest price at or before a given time. Needs a new `instrumentPrices` table (instrumentID, price, quotedAt).
```sql
SELECT i."instrumentID", i.ticker, i.name, p.price, p."quotedAt"
FROM instruments i
JOIN "instrumentPrices" p ON p."instrumentID" = i."instrumentID"
WHERE (i.name ILIKE :name OR i.ticker ILIKE :name)
  AND p."quotedAt" <= :at
ORDER BY p."quotedAt" DESC
LIMIT 1;
```

### autoCreateHoldingOnExecution (`POST /api/order-logs/{logOrderId}/execute`)
Creates a holding on first interaction with an instrument in a portfolio.
```sql
INSERT INTO holdings ("holdingID", "portfolioID", "instrumentID")
SELECT gen_random_uuid(), o."portfolioID", o."instrumentID"
FROM "orderLogs" o
WHERE o."logOrderID" = :logOrderId
  AND NOT EXISTS (
      SELECT 1
      FROM holdings h
      WHERE h."portfolioID" = o."portfolioID"
        AND h."instrumentID" = o."instrumentID"
  );
```

---

## Holdings

**getHoldingsByPortfolio** (`GET /api/holdings/portfolio/{portfolioId}`): all holdings in a portfolio, including executed order IDs.
```sql
SELECT
  h."holdingID",
  h."portfolioID",
  h."instrumentID",
  COALESCE(
    ARRAY_AGG(o."logOrderID") FILTER (WHERE o."logOrderID" IS NOT NULL),
    ARRAY[]::uuid[]
  ) AS executed_order_log_ids
FROM holdings h
JOIN portfolios p ON p."portfolioID" = h."portfolioID"
LEFT JOIN "orderLogs" o
  ON o."portfolioID" = h."portfolioID"
 AND o."instrumentID" = h."instrumentID"
 AND o.status = 'EXECUTED'
WHERE h."portfolioID" = :portfolioId AND p."userID" = :userId
GROUP BY h."holdingID", h."portfolioID", h."instrumentID";
```

**getHoldingById** (`GET /api/holdings/{holdingId}`): one holding, including executed order IDs.
```sql
SELECT
  h."holdingID",
  h."portfolioID",
  h."instrumentID",
  COALESCE(
    ARRAY_AGG(o."logOrderID") FILTER (WHERE o."logOrderID" IS NOT NULL),
    ARRAY[]::uuid[]
  ) AS executed_order_log_ids
FROM holdings h
JOIN portfolios p ON p."portfolioID" = h."portfolioID"
LEFT JOIN "orderLogs" o
  ON o."portfolioID" = h."portfolioID"
 AND o."instrumentID" = h."instrumentID"
 AND o.status = 'EXECUTED'
WHERE h."holdingID" = :holdingId AND p."userID" = :userId
GROUP BY h."holdingID", h."portfolioID", h."instrumentID";
```

**deleteHolding** (`DELETE /api/holdings/{holdingId}`): removes a holding.
```sql
DELETE FROM holdings
WHERE "holdingID" = :holdingId
  AND "portfolioID" IN (SELECT "portfolioID" FROM portfolios WHERE "userID" = :userId);
```

## Instruments

**getAllInstruments** (`GET /api/instruments`): every tradable instrument.
```sql
SELECT * FROM instruments;
```

**getInstrumentById** (`GET /api/instruments/{instrumentId}`): one instrument.
```sql
SELECT * FROM instruments WHERE "instrumentID" = :instrumentId;
```

**getInstrumentByTicker** (`GET /api/instruments/ticker/{ticker}`): look up by ticker, case-insensitive.
```sql
SELECT * FROM instruments WHERE UPPER(ticker) = UPPER(:ticker);
```

**createInstrument** (`POST /api/instruments`): adds an instrument.
```sql
INSERT INTO instruments ("instrumentID", ticker, market, name, "instrumentClass", "logoUrl", description)
VALUES (gen_random_uuid(), :ticker, :market, :name, :instrumentClass, :logoUrl, :description);
```

**updateInstrument** (`PUT /api/instruments/{instrumentId}`): edits name, logo or description.
```sql
UPDATE instruments
SET name = :name, "logoUrl" = :logoUrl, description = :description
WHERE "instrumentID" = :instrumentId;
```

**deleteInstrument** (`DELETE /api/instruments/{instrumentId}`): removes an instrument.
```sql
DELETE FROM instruments WHERE "instrumentID" = :instrumentId;
```

**syncInstrumentFromExternalApi** (`POST /api/instruments/sync/{ticker}`) *(not implemented)*: inserts or refreshes an instrument from a market-data provider.
```sql
INSERT INTO instruments ("instrumentID", ticker, market, name, "instrumentClass", "logoUrl", description)
VALUES (gen_random_uuid(), :ticker, :market, :name, :instrumentClass, :logoUrl, :description)
ON CONFLICT (ticker) DO UPDATE
SET name = EXCLUDED.name, "logoUrl" = EXCLUDED."logoUrl", description = EXCLUDED.description;
```

## Portfolios

**getCurrentUserPortfolios** (`GET /api/portfolios`): the user's portfolios.
```sql
SELECT * FROM portfolios WHERE "userID" = :userId;
```

**getPortfolioById** (`GET /api/portfolios/{portfolioId}`): one portfolio.
```sql
SELECT * FROM portfolios WHERE "portfolioID" = :portfolioId AND "userID" = :userId;
```

**createPortfolio** (`POST /api/portfolios`): creates a portfolio.
```sql
INSERT INTO portfolios ("portfolioID", "userID", "portfolioName")
VALUES (gen_random_uuid(), :userId, :portfolioName);
```

**updatePortfolio** (`PUT /api/portfolios/{portfolioId}`): renames a portfolio.
```sql
UPDATE portfolios SET "portfolioName" = :portfolioName
WHERE "portfolioID" = :portfolioId AND "userID" = :userId;
```

**deletePortfolio** (`DELETE /api/portfolios/{portfolioId}`): deletes a portfolio (its holdings and watchlist items cascade).
```sql
DELETE FROM portfolios WHERE "portfolioID" = :portfolioId AND "userID" = :userId;
```

## Orders *(planned)*

**placeOrder** (`POST /api/portfolios/{portfolioId}/orders`): records an order log and later marks it executed.
```sql
BEGIN;
INSERT INTO "orderLogs" ("logOrderID", "orderID", "portfolioID", "instrumentID", side, quantity, "timestamp", status)
VALUES (gen_random_uuid(), :orderId, :portfolioId, :instrumentId, :side, :quantity, now(), 'ACCEPTED');
COMMIT;
```

## Order logs

**getOrderLogsByPortfolio** (`GET /api/order-logs/portfolio/{portfolioId}`): order history, newest first.
```sql
SELECT o.* FROM "orderLogs" o
JOIN portfolios p ON p."portfolioID" = o."portfolioID"
WHERE o."portfolioID" = :portfolioId AND p."userID" = :userId
ORDER BY o."timestamp" DESC;
```

**getOrderLogById** (`GET /api/order-logs/{logOrderId}`): one order log entry.
```sql
SELECT o.* FROM "orderLogs" o
JOIN portfolios p ON p."portfolioID" = o."portfolioID"
WHERE o."logOrderID" = :logOrderId AND p."userID" = :userId;
```

**createOrderLog** (`POST /api/order-logs`): records an order status entry (starts as SUBMITTED).
```sql
INSERT INTO "orderLogs" ("logOrderID", "orderID", "portfolioID", "instrumentID", side, quantity, "timestamp", metadata, status, "executionPrice")
VALUES (gen_random_uuid(), :orderId, :portfolioId, :instrumentId, :side, :quantity, now(), :metadata, 'SUBMITTED', :executionPrice);
```

**markOrderLogExecuted** (`POST /api/order-logs/{logOrderId}/execute`): marks an order log as EXECUTED and triggers holding auto-create.
```sql
UPDATE "orderLogs" o
SET status = 'EXECUTED', "executionPrice" = COALESCE(:executionPrice, o."executionPrice")
FROM portfolios p
WHERE o."logOrderID" = :logOrderId
  AND p."portfolioID" = o."portfolioID"
  AND p."userID" = :userId;
```

## Watchlists

**getWatchlistItemsByPortfolio** (`GET /api/watchlists/portfolio/{portfolioId}`): watched instruments in a portfolio.
```sql
SELECT w.* FROM watchlist_items w
JOIN portfolios p ON p."portfolioID" = w."portfolioID"
WHERE w."portfolioID" = :portfolioId AND p."userID" = :userId;
```

**getWatchlistItemById** (`GET /api/watchlists/{listItemId}`): one watchlist item.
```sql
SELECT w.* FROM watchlist_items w
JOIN portfolios p ON p."portfolioID" = w."portfolioID"
WHERE w."listItemID" = :listItemId AND p."userID" = :userId;
```

**createWatchlistItem** (`POST /api/watchlists`): adds an instrument to a watchlist.
```sql
INSERT INTO watchlist_items ("listItemID", "portfolioID", "instrumentID", name)
VALUES (gen_random_uuid(), :portfolioId, :instrumentId, :name);
```

**updateWatchlistItem** (`PUT /api/watchlists/{listItemId}`): renames a watchlist item.
```sql
UPDATE watchlist_items SET name = :name
WHERE "listItemID" = :listItemId
  AND "portfolioID" IN (SELECT "portfolioID" FROM portfolios WHERE "userID" = :userId);
```

**deleteWatchlistItem** (`DELETE /api/watchlists/{listItemId}`): removes a watchlist item.
```sql
DELETE FROM watchlist_items
WHERE "listItemID" = :listItemId
  AND "portfolioID" IN (SELECT "portfolioID" FROM portfolios WHERE "userID" = :userId);
```

## Profile

**getCurrentProfile** (`GET /api/profile`): the user's profile.
```sql
SELECT * FROM profiles WHERE "userID" = :userId;
```

**updateProfile** (`PUT /api/profile`): edits the user's profile.
```sql
UPDATE profiles
SET "firstName" = :firstName, "lastName" = :lastName, username = :username, city = :city,
    state = :state, country = :country, "zipCode" = :zipCode, dob = :dob, avatar = :avatar
WHERE "userID" = :userId;
```
