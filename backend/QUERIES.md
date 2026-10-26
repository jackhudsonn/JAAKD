# JAAKD: Queries

The queries our application requires, one per API in [`openapi.yaml`](openapi.yaml).
Core flow now uses `OrderLog` as source of truth plus SQL aggregation for holdings.

`:userId` is the signed-in user (resolved from the session cookie). Every query on user data filters by it, so users only see their own data.

---

## Required queries

### findInstrumentByNameAndTime (`GET /api/instruments/prices?name=&at=`) _(planned)_

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

## Auth

Credentials belong to the identity provider, not the application identity
anchors. The base schema contains one link table per provider:
`development_credentials` and `cognito_users`. Only the selected adapter reads
its table. The application queries only `users` and `sessions` after the
provider has authenticated the caller. `:userId` is the application user ID,
which is an application-generated UUID.

**register** (`POST /api/auth/register`): the provider creates the credential or
identity first. After the provider succeeds, the application writes the
`users`, `profiles`, and provider-link rows in one local transaction. For the
development adapter, the provider-side insert is:

```sql
-- development provider only; production credentials live with the provider
INSERT INTO development_credentials ("userID", email, "passwordHash")
VALUES (:userId, :email, :passwordHash);
```

A duplicate email surfaces as `409` (`development_credentials.email` is unique).

**signIn** (`POST /api/auth/login`): the provider verifies the credential, then the
application ensures the identity anchor exists (registration normally created
it) and opens the session.

```sql
-- provider half (development): look up the credential and compare the password hash
SELECT "userID", "passwordHash" FROM development_credentials WHERE email = :email;

-- application half: get-or-create the anchor, refreshing the email it stores
INSERT INTO users ("userID", email, "createdAt")
VALUES (:userId, :email, :createdAt)
ON CONFLICT ("userID") DO UPDATE SET email = EXCLUDED.email;

-- application half: open the session (:refreshToken is null for the development provider)
INSERT INTO sessions ("sessionID", "userID", "refreshToken", "createdAt", "expiresAt")
VALUES (:sessionId, :userId, :refreshToken, :createdAt, :expiresAt);
```

**getSession** (`GET /api/auth/session`): resolve the session cookie to the signed-in
user.

```sql
SELECT u."userID", u.email
FROM sessions s
JOIN users u ON u."userID" = s."userID"
WHERE s."sessionID" = :sessionId
  AND s."expiresAt" > :now;
```

**logout** (`POST /api/auth/logout`): delete the session.

```sql
DELETE FROM sessions WHERE "sessionID" = :sessionId;
```

**changePassword** (`POST /api/auth/change-password`): the provider updates the
credential; the application then revokes the user's other sessions, so a
password change signs out other devices without ending the caller's.

```sql
-- provider half (development): replace the stored hash
UPDATE development_credentials SET "passwordHash" = :newPasswordHash WHERE email = :email;

-- application half: revoke every session for the user except the caller's
DELETE FROM sessions WHERE "userID" = :userId AND "sessionID" <> :currentSessionId;
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

**syncInstrumentFromExternalApi** (`POST /api/instruments/sync/{ticker}`) _(not implemented)_: inserts or refreshes an instrument from a market-data provider.

```sql
INSERT INTO instruments ("instrumentID", ticker, market, name, "instrumentClass", "logoUrl", description)
VALUES (gen_random_uuid(), :ticker, :market, :name, :instrumentClass, :logoUrl, :description)
ON CONFLICT (ticker) DO UPDATE
SET name = EXCLUDED.name, "logoUrl" = EXCLUDED."logoUrl", description = EXCLUDED.description;
```

**refreshPriceHistory** (`POST /api/instruments/prices/refresh`, admin only; also runs nightly at 22:00 UTC): refetches daily candles for every non-cash instrument. Per instrument, one read of the window, then inserts for new days and updates only for changed days (synthetic days replaced by real data, `adjClose` restated after a split or dividend).

```sql
SELECT * FROM "instrumentPrices"
WHERE "instrumentID" = :instrumentId AND "priceDate" BETWEEN :from AND :to;

INSERT INTO "instrumentPrices" ("instrumentID", "priceDate", open, high, low, close, "adjClose", volume, currency, synthetic, "fetchedAt")
VALUES (:instrumentId, :priceDate, :open, :high, :low, :close, :adjClose, :volume, :currency, :synthetic, :fetchedAt);

UPDATE "instrumentPrices"
SET open = :open, high = :high, low = :low, close = :close, "adjClose" = :adjClose,
    volume = :volume, currency = :currency, synthetic = :synthetic, "fetchedAt" = :fetchedAt
WHERE "instrumentID" = :instrumentId AND "priceDate" = :priceDate;
```

**getQuotesByTickers** (`GET /api/instruments/quotes?symbols=`): live quotes for up to 25 tickers, including `changePercent`. No SQL: the backend calls Fauxnance `/quotes`.

**getQuoteByTicker** (`GET /api/instruments/quotes/{ticker}`): live quote for one ticker. No SQL: the backend calls Fauxnance `/quotes`.

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

**deletePortfolio** (`DELETE /api/portfolios/{portfolioId}`): deletes a portfolio (its holdings and watchlists cascade) only when it is truly empty.

Delete guard conditions:

- Block deletion if any owned order log is active (`SUBMITTED`, `PENDING`, `ACCEPTED`).
- Block deletion if any owned holding has `currentQuantity > 0` (cash included, because cash is a holding row).
- Return `409 Conflict` with details flags when blocked.

```sql
DELETE FROM portfolios WHERE "portfolioID" = :portfolioId AND "userID" = :userId;
```

## Orders _(planned)_

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

**getFxOrderLogsByPortfolio** (`GET /api/order-logs/portfolio/{portfolioId}/fx`): FX conversion history only, newest first.
```sql
SELECT o.* FROM "orderLogs" o
JOIN portfolios p ON p."portfolioID" = o."portfolioID"
WHERE o."portfolioID" = :portfolioId
  AND p."userID" = :userId
  AND o.side = 'FX'
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

**cancelOrderByOrderId** (`POST /api/order-logs/{orderId}/cancel`): append-only cancel action over the logical order stream.

Behavior:

- If latest owned status is `SUBMITTED` or `PENDING`, append a new row with status `CANCELLED`.
- If latest owned status is already `CANCELLED`, return that row (`200` idempotent).
- If latest owned status is `ACCEPTED`, `EXECUTED`, `REJECTED`, or `FAILED`, return `409 Conflict`.

```sql
INSERT INTO "orderLogs" ("logOrderID", "orderID", "portfolioID", "instrumentID", side, quantity, "timestamp", metadata, status, "executionPrice")
SELECT gen_random_uuid(), o."orderID", o."portfolioID", o."instrumentID", o.side, o.quantity, now(), o.metadata, 'CANCELLED', o."executionPrice"
FROM "orderLogs" o
JOIN portfolios p ON p."portfolioID" = o."portfolioID"
WHERE o."orderID" = :orderId
  AND p."userID" = :userId
ORDER BY o."timestamp" DESC
LIMIT 1;
```

## Watchlists

**getWatchlists** (`GET /api/portfolios/{portfolioId}/watchlists`): all watchlists in a portfolio owned by the signed-in user.

```sql
SELECT w.*
FROM watchlists w
JOIN portfolios p ON p."portfolioID" = w."portfolioID"
WHERE w."portfolioID" = :portfolioId
  AND p."userID" = :userId
ORDER BY "watchlistID" ASC;
```

**createWatchlist** (`POST /api/portfolios/{portfolioId}/watchlists`): create a named watchlist in a portfolio.

```sql
INSERT INTO watchlists ("watchlistID", "portfolioID", "watchlistName")
SELECT gen_random_uuid(), p."portfolioID", :watchlistName
FROM portfolios p
WHERE p."portfolioID" = :portfolioId
  AND p."userID" = :userId;
```

**renameWatchlist** (`PUT /api/portfolios/{portfolioId}/watchlists/{watchlistId}`): rename a watchlist.

```sql
UPDATE watchlists w
SET "watchlistName" = :watchlistName
FROM portfolios p
WHERE w."watchlistID" = :watchlistId
  AND w."portfolioID" = :portfolioId
  AND w."portfolioID" = p."portfolioID"
  AND p."userID" = :userId;
```

**deleteWatchlist** (`DELETE /api/portfolios/{portfolioId}/watchlists/{watchlistId}`): hard-delete a watchlist and all items.

```sql
DELETE FROM watchlists w
USING portfolios p
WHERE w."watchlistID" = :watchlistId
  AND w."portfolioID" = :portfolioId
  AND w."portfolioID" = p."portfolioID"
  AND p."userID" = :userId;
```

**addWatchlistItem** (`POST /api/portfolios/{portfolioId}/watchlists/{watchlistId}/items`): add an instrument to a watchlist.

```sql
INSERT INTO watchlist_items ("listItemID", "watchlistID", "instrumentID")
SELECT gen_random_uuid(), w."watchlistID", :instrumentId
FROM watchlists w
JOIN portfolios p ON p."portfolioID" = w."portfolioID"
WHERE w."watchlistID" = :watchlistId
  AND w."portfolioID" = :portfolioId
  AND p."userID" = :userId;
```

**deleteWatchlistItem** (`DELETE /api/portfolios/{portfolioId}/watchlists/{watchlistId}/items/{listItemId}`): remove a single watchlist item.

```sql
DELETE FROM watchlist_items wi
USING watchlists w, portfolios p
WHERE wi."listItemID" = :listItemId
  AND wi."watchlistID" = :watchlistId
  AND w."portfolioID" = :portfolioId
  AND wi."watchlistID" = w."watchlistID"
  AND w."portfolioID" = p."portfolioID"
  AND p."userID" = :userId;
```

## Profile

**createCurrentProfile** (`POST /api/profile`): creates the signed-in user's profile if it does not already exist.

```sql
INSERT INTO profiles (
  "userID", "userType", "firstName", "lastName", dob, city, state, country, "zipCode"
)
VALUES (
  :userId, 0, :firstName, :lastName, :dob, :city, :state, :country, :zipCode
);
```

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

## Analytics

Read-only queries against the separate analytics database (schema `analytics`), which `analytics/dbt` rebuilds nightly from a copy of production. Restricted to ADMIN or ANALYST user types (`@RequiresUserType` on `AnalyticsService`). Sort columns come from an allowlist; filters are bound parameters. Paged lists also run the same `WHERE` as `SELECT COUNT(*)`.

**getAnalyticsMeta** (`GET /api/analytics/meta`): when the data was built.

```sql
SELECT source_snapshot_at, built_at FROM analytics.meta_build;
```

The marts count retail portfolios only. Instrument holdings figures (holders, exposure, net flow) come from `agg_instrument_segment`, summed over the segments that match the optional `country` and `ageBand` filters:

```sql
WITH s AS (
  SELECT instrument_id, SUM(holder_count) AS holder_count, SUM(exposure_usd) AS exposure_usd,
         SUM(net_flow_30d_usd) AS net_flow_30d_usd
  FROM analytics.agg_instrument_segment
  WHERE (:country IS NULL OR UPPER(country) = UPPER(:country))
    AND (:ageBand IS NULL OR age_band = :ageBand)
  GROUP BY instrument_id
)
```

**getAnalyticsSummary** (`GET /api/analytics/summary`): exposure and returns by instrument class, optionally for one segment.

```sql
WITH s AS (...)
SELECT a.instrument_class, COUNT(*) AS instrument_count, COALESCE(SUM(s.holder_count), 0) AS position_count,
       COALESCE(SUM(s.exposure_usd), 0) AS exposure_usd, AVG(a.return_1m) AS average_return1m
FROM analytics.agg_instrument_performance a
LEFT JOIN s ON s.instrument_id = a.instrument_id
GROUP BY a.instrument_class
ORDER BY exposure_usd DESC, a.instrument_class;
```

**listAnalyticsCountries** (`GET /api/analytics/countries`): countries for the filter dropdowns, sorted in Java with "Unknown" last.

```sql
SELECT DISTINCT COALESCE(p.country, 'Unknown') AS country FROM analytics.agg_portfolio_performance p;
```

**listAnalyticsSegments** (`GET /api/analytics/segments?by=ageBand|country`): retail portfolios per age band or country, then each segment's class mix, combined in Java.

```sql
SELECT <age_band | COALESCE(country, 'Unknown')> AS segment, COUNT(*) AS portfolio_count,
       COALESCE(SUM(market_value_usd), 0) AS market_value_usd, AVG(return_ytd) AS average_return_ytd
FROM analytics.agg_portfolio_performance p
GROUP BY segment;

SELECT s.<age_band | country> AS segment, d.instrument_class,
       SUM(s.exposure_usd) AS exposure_usd, SUM(s.holder_count) AS holder_count
FROM analytics.agg_instrument_segment s
JOIN analytics.dim_instrument d ON d.instrument_id = s.instrument_id
GROUP BY segment, d.instrument_class
ORDER BY exposure_usd DESC, d.instrument_class;
```

**getAnalyticsSegmentExposure** (`GET /api/analytics/segments/exposure?by=&instrumentClass=|instrumentId=`): each segment's exposure to one class or instrument, next to its total investments; sorted in Java like `/segments`.

```sql
WITH totals AS (
  SELECT s.<age_band | country> AS segment, SUM(s.exposure_usd) AS segment_total_usd
  FROM analytics.agg_instrument_segment s GROUP BY segment
),
focus AS (
  SELECT s.<age_band | country> AS segment, SUM(s.exposure_usd) AS exposure_usd, SUM(s.holder_count) AS holder_count
  FROM analytics.agg_instrument_segment s
  JOIN analytics.dim_instrument d ON d.instrument_id = s.instrument_id
  WHERE (:instrumentClass IS NULL OR d.instrument_class = :instrumentClass)
    AND (:instrumentId IS NULL OR s.instrument_id = :instrumentId)
  GROUP BY segment
)
SELECT t.segment, COALESCE(f.exposure_usd, 0), COALESCE(f.holder_count, 0), t.segment_total_usd
FROM totals t LEFT JOIN focus f ON f.segment = t.segment;
```

**listInstrumentPerformance** (`GET /api/analytics/instruments`): leaderboard, optionally by class, search and segment. Every instrument is listed; outside the segment its holdings figures are 0.

```sql
WITH s AS (...)
SELECT a.<returns and risk>, d.market, d.trading_currency,
       COALESCE(s.holder_count, 0), COALESCE(s.exposure_usd, 0), COALESCE(s.net_flow_30d_usd, 0)
FROM analytics.agg_instrument_performance a
JOIN analytics.dim_instrument d ON d.instrument_id = a.instrument_id
LEFT JOIN s ON s.instrument_id = a.instrument_id
WHERE (:instrumentClass IS NULL OR a.instrument_class = :instrumentClass)
  AND (:search IS NULL OR a.ticker ILIKE :search OR a.name ILIKE :search)  -- '%' || escaped search || '%'
ORDER BY <allowlisted column> <ASC|DESC> NULLS LAST, a.instrument_id
LIMIT :size OFFSET :page * :size;
```

**getInstrumentPerformance** (`GET /api/analytics/instruments/{instrumentId}`): the same row for one instrument, all segments (`WHERE a.instrument_id = :instrumentId`).

**getInstrumentSeries** (`GET /api/analytics/instruments/{instrumentId}/series`): daily prices, one year by default, at most five.

```sql
SELECT price_date, close, close_usd, daily_return, cumulative_return
FROM analytics.fct_instrument_price_daily
WHERE instrument_id = :instrumentId AND price_date BETWEEN :from AND :to
ORDER BY price_date;
```

**listPortfolioPerformance** (`GET /api/analytics/portfolios`): pseudonymous retail portfolios, filterable by country and age band.

```sql
SELECT p.<columns>, COALESCE(p.country, 'Unknown') AS country
FROM analytics.agg_portfolio_performance p
WHERE (:country IS NULL OR UPPER(COALESCE(p.country, 'Unknown')) = UPPER(:country))
  AND (:ageBand IS NULL OR p.age_band = :ageBand)
ORDER BY <allowlisted column> <ASC|DESC> NULLS LAST, p.portfolio_id
LIMIT :size OFFSET :page * :size;
```

**getPortfolioPerformance** (`GET /api/analytics/portfolios/{portfolioId}`): the same row for one portfolio.

**getPortfolioSeries** (`GET /api/analytics/portfolios/{portfolioId}/series`): daily value and time-weighted return.

```sql
SELECT as_of_date, market_value_usd, cash_usd, net_external_flow_usd, daily_return, cumulative_twr
FROM analytics.fct_portfolio_daily
WHERE portfolio_id = :portfolioId AND as_of_date BETWEEN :from AND :to
ORDER BY as_of_date;
```

**getPortfolioClassSeries** (`GET /api/analytics/portfolios/{portfolioId}/class-series?instrumentClass=`): one class's holdings added up per day.

```sql
SELECT h.as_of_date, SUM(h.cost_basis_usd), SUM(h.market_value_usd),
       SUM(h.realized_pnl_to_date_usd), SUM(h.unrealized_pnl_usd)
FROM analytics.fct_holding_daily h
JOIN analytics.dim_instrument i ON i.instrument_id = h.instrument_id
WHERE h.portfolio_id = :portfolioId AND i.instrument_class = :instrumentClass
  AND h.as_of_date BETWEEN :from AND :to
GROUP BY h.as_of_date
ORDER BY h.as_of_date;
```

**getPortfolioHoldingSnapshot** (`GET /api/analytics/portfolios/{portfolioId}/holdings`): open positions on the portfolio's latest built day.

```sql
SELECT h.*, i.ticker, i.name, i.instrument_class
FROM analytics.fct_holding_daily h
JOIN analytics.dim_instrument i ON i.instrument_id = h.instrument_id
WHERE h.portfolio_id = :portfolioId
  AND h.quantity <> 0
  AND h.as_of_date = (SELECT MAX(as_of_date) FROM analytics.fct_holding_daily WHERE portfolio_id = :portfolioId)
ORDER BY h.market_value_usd DESC NULLS LAST, i.ticker;
```

**getHoldingSeries** (`GET /api/analytics/holdings/{holdingId}/series`): daily value and P&L for one holding.

```sql
SELECT as_of_date, quantity, cost_basis_usd, market_value_usd, realized_pnl_to_date_usd, unrealized_pnl_usd
FROM analytics.fct_holding_daily
WHERE holding_id = :holdingId AND as_of_date BETWEEN :from AND :to
ORDER BY as_of_date;
```
