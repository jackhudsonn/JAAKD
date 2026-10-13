# JAAKD: Queries

The queries our application requires, one per API in [`openapi.yaml`](openapi.yaml).
Core flow now uses `OrderLog` as source of truth plus SQL aggregation for holdings.

`:userId` is the signed-in user (resolved from the session cookie). Every query on user data filters by it, so users only see their own data.

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

## Auth

Credentials belong to the identity provider, not the application schema. The
application queries only `users` and `sessions`, and only after the provider has
authenticated the caller. `:userId` is the provider's identity claim (a UUID).

**register** (`POST /api/auth/register`): no application query. The provider creates
the credential; the application `users` row is not created until the first sign
in.
```sql
-- development provider only; production credentials live with the provider
INSERT INTO development_credentials ("userID", email, "passwordHash")
VALUES (:userId, :email, :passwordHash);
```
A duplicate email surfaces as `409` (`development_credentials.email` is unique).

**signIn** (`POST /api/auth/login`): the provider verifies the credential, then the
application provisions its identity anchor and opens the session.
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

**getAllInstruments** (`GET /api/instruments`): every tradable instrument, with optional `query` (ticker/name contains), optional `instrumentType`, and optional paging (`page`, `size`).
```sql
SELECT *
FROM instruments
WHERE (:instrumentType IS NULL OR "instrumentClass" = :instrumentType)
  AND (
    :query IS NULL
    OR UPPER(ticker) LIKE UPPER('%' || :query || '%')
    OR UPPER(name) LIKE UPPER('%' || :query || '%')
  )
ORDER BY ticker ASC, "instrumentID" ASC;
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

**deletePortfolio** (`DELETE /api/portfolios/{portfolioId}`): deletes a portfolio (its holdings and watchlist items cascade) only when it is truly empty.

Delete guard conditions:
- Block deletion if any owned order log is active (`SUBMITTED`, `PENDING`, `ACCEPTED`).
- Block deletion if any owned holding has `currentQuantity > 0` (cash included, because cash is a holding row).
- Return `409 Conflict` with details flags when blocked.

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

## Audit

**searchAuditUsers** (`GET /api/audit/users`): case-insensitive search across user email and profile identity fields for admin/auditor users.
```sql
SELECT
  u."userID" AS userId,
  u.email,
  p.username,
  p."firstName" AS firstName,
  p."lastName" AS lastName
FROM users u
LEFT JOIN profiles p ON p."userID" = u."userID"
WHERE UPPER(u.email) LIKE UPPER('%' || :query || '%')
   OR UPPER(COALESCE(p.username, '')) LIKE UPPER('%' || :query || '%')
   OR UPPER(COALESCE(p."firstName", '')) LIKE UPPER('%' || :query || '%')
   OR UPPER(COALESCE(p."lastName", '')) LIKE UPPER('%' || :query || '%')
ORDER BY u."userID" ASC;
```

**searchAuditOrderLogs** (`GET /api/audit/order-logs`): day-scoped audit log filtering with optional user/status/ticker/instrumentType filters for admin/auditor users.
```sql
SELECT o.*
FROM "orderLogs" o
JOIN portfolios p ON p."portfolioID" = o."portfolioID"
JOIN instruments i ON i."instrumentID" = o."instrumentID"
WHERE o."timestamp" >= :start
  AND o."timestamp" < :end
  AND (:userId IS NULL OR p."userID" = :userId)
  AND (:status IS NULL OR o.status = :status)
  AND (:ticker IS NULL OR UPPER(i.ticker) = UPPER(:ticker))
  AND (:instrumentType IS NULL OR i."instrumentClass" = :instrumentType)
ORDER BY o."timestamp" DESC, o."logOrderID" DESC;
```

**getAuditUserPortfolios** (`GET /api/audit/users/{userId}/portfolios`): paged cross-user portfolio list for admin/auditor users.
```sql
SELECT p.*
FROM portfolios p
WHERE p."userID" = :userId
ORDER BY p."portfolioID" ASC;
```

**getAuditUserHoldings** (`GET /api/audit/users/{userId}/holdings`): paged cross-user holding list with optional portfolio filter for admin/auditor users.
```sql
SELECT h.*
FROM holdings h
JOIN portfolios p ON p."portfolioID" = h."portfolioID"
WHERE p."userID" = :userId
  AND (:portfolioId IS NULL OR p."portfolioID" = :portfolioId)
ORDER BY h."holdingID" ASC;
```

**getAuditHoldingPositionLots** (`GET /api/audit/holdings/{holdingId}/position-lots`): paged lot list for a holding (cross-user) for admin/auditor users.
```sql
SELECT pl.*
FROM position_lots pl
WHERE pl."holdingID" = :holdingId
ORDER BY pl."openedAt" ASC, pl."positionLotID" ASC;
```

**getAuditHoldingLotMatches** (`GET /api/audit/holdings/{holdingId}/lot-matches`): paged match list for a holding (cross-user) for admin/auditor users.
```sql
SELECT lm.*
FROM lot_matches lm
WHERE lm."holdingID" = :holdingId
ORDER BY lm."matchedAt" ASC, lm."lotMatchID" ASC;
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
