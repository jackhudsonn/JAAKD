# JAAKD: Queries

The queries our application requires, one per API in [`openapi.yaml`](openapi.yaml).
Implemented with Spring Data JPA; the SQL below is what each repository call runs.

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

### createHolding (`POST /api/holdings`)
Adds a new holding to one of the user's portfolios.
```sql
INSERT INTO holdings ("holdingID", "portfolioID", "instrumentID", "currentQuantity")
VALUES (gen_random_uuid(), :portfolioId, :instrumentId, :currentQuantity);
```

### updateHolding (`PUT /api/holdings/{holdingId}`)
Changes the quantity of a holding the user owns.
```sql
UPDATE holdings
SET "currentQuantity" = :currentQuantity
WHERE "holdingID" = :holdingId
  AND "portfolioID" IN (SELECT "portfolioID" FROM portfolios WHERE "userID" = :userId);
```

---

## Holdings

**getHoldingsByPortfolio** (`GET /api/holdings/portfolio/{portfolioId}`): all holdings in a portfolio.
```sql
SELECT h.* FROM holdings h
JOIN portfolios p ON p."portfolioID" = h."portfolioID"
WHERE h."portfolioID" = :portfolioId AND p."userID" = :userId;
```

**getHoldingById** (`GET /api/holdings/{holdingId}`): one holding.
```sql
SELECT h.* FROM holdings h
JOIN portfolios p ON p."portfolioID" = h."portfolioID"
WHERE h."holdingID" = :holdingId AND p."userID" = :userId;
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

**placeOrder** (`POST /api/portfolios/{portfolioId}/orders`): records the order, then on fill updates the holding and writes the trade, all in one transaction.
```sql
BEGIN;
INSERT INTO "orderLogs" ("logOrderID", "orderID", "portfolioID", "instrumentID", side, quantity, "timestamp", status)
VALUES (gen_random_uuid(), :orderId, :portfolioId, :instrumentId, :side, :quantity, now(), 'ACCEPTED');

INSERT INTO holdings ("holdingID", "portfolioID", "instrumentID", "currentQuantity")
VALUES (gen_random_uuid(), :portfolioId, :instrumentId, :quantityDelta)   -- negative for a SELL
ON CONFLICT ("portfolioID", "instrumentID")
DO UPDATE SET "currentQuantity" = holdings."currentQuantity" + EXCLUDED."currentQuantity";

INSERT INTO trades ("tradeID", "holdingID", "orderLogID")
VALUES (gen_random_uuid(), :holdingId, :logOrderId);
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

## Trades

**getTradesByHolding** (`GET /api/trades/holding/{holdingId}`): trades that changed a holding.
```sql
SELECT t.* FROM trades t
JOIN holdings h   ON h."holdingID"   = t."holdingID"
JOIN portfolios p ON p."portfolioID" = h."portfolioID"
WHERE t."holdingID" = :holdingId AND p."userID" = :userId;
```

**getTradeById** (`GET /api/trades/{tradeId}`): one trade.
```sql
SELECT t.* FROM trades t
JOIN holdings h   ON h."holdingID"   = t."holdingID"
JOIN portfolios p ON p."portfolioID" = h."portfolioID"
WHERE t."tradeID" = :tradeId AND p."userID" = :userId;
```

**createTrade** (`POST /api/trades`): links an order log entry to the holding it changed.
```sql
INSERT INTO trades ("tradeID", "holdingID", "orderLogID")
VALUES (gen_random_uuid(), :holdingId, :orderLogId);
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
