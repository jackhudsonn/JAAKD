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
