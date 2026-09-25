# JAAKD Backend

Spring Boot API backend for JAAKD. Connects directly to Supabase Postgres (privileged role) and validates Supabase-issued JWTs from the Angular client.

## Architecture

```
Angular client --HTTPS + Supabase JWT--> this backend --JDBC (privileged role)--> Supabase Postgres
```

- The client never queries trading data directly against Supabase — only auth (sign up/in/out, session, JWT) goes straight to Supabase from the client. All domain data (orders, holdings, portfolios) goes through this backend's REST API.
- This backend connects to Postgres with a **privileged DB role** (not the anon/publishable key), so it can read/write regardless of Row Level Security policies.
- This backend validates every incoming request's `Authorization: Bearer <token>` (except `/actuator/**`) against Supabase's JWKS endpoint — no shared secret involved.

## Identity chain

`auth.users.id` → `profiles.userID` — the `handle_new_user()` signup trigger sets `profiles."userID" = auth.users.id` directly, so the JWT's `sub` claim can be used as `profiles.userID` with no extra lookup. (This wasn't always true — see git history if profile rows ever look orphaned from an auth account.)

## What's implemented

| Area | Status |
|---|---|
| Postgres connectivity (JPA/Hibernate) | ✅ Done, verified live |
| JWT validation (Supabase ES256 / JWKS) | ✅ Done, verified live (`/actuator/health` public, `/api/**` returns 401 without a token) |
| JPA entities/repositories for all 8 real Supabase tables | ✅ Done, schema-validated against the live DB |
| Order log execution/accounting logic (ownership-scoped endpoints, FIFO projection, cash-in-holdings routing) | ✅ In progress — core execution and projection path implemented |

## Execution accounting behavior

- `POST /api/order-logs/{logOrderId}/execute` is the accounting entrypoint.
- BUY and SELL executions are projected through FIFO tables:
	- BUY creates one `position_lots` row and increments `holdings.currentQuantity`.
	- SELL consumes oldest open lots, writes `lot_matches`, decrements `holdings.currentQuantity`, and updates `holdings.cumulativeRealizedPnl`.
- DEPOSIT and WITHDRAW executions update only the dedicated cash instrument holding:
	- DEPOSIT increments `holdings.currentQuantity`.
	- WITHDRAW decrements `holdings.currentQuantity` and rejects if balance would go negative.
- Execution projection is idempotent: re-calling execute for an already `EXECUTED` log does not re-apply accounting side effects.
- `position_lots` and `lot_matches` are internal projection tables in this phase and do not have public REST endpoints.

## Reconciliation diagnostics

- `GET /api/holdings/portfolio/{portfolioId}/reconcile` replays executed order logs and compares expected projection values to persisted `holdings` rows.
- Reconciliation includes the dedicated cash instrument holding.
- Response includes mismatch count and per-instrument diagnostics (`expectedQuantity`, `actualQuantity`, expected/actual realized PnL, reason).
- Access policy: diagnostics endpoints are restricted to privileged user types (`ADMIN` or `AUDITOR`); retail clients are denied with HTTP 403.

## Order log diagnostics

- `GET /api/order-logs/diagnostics/portfolio/{portfolioId}` returns order logs newest first for diagnostics workflows.
- This endpoint is intended for privileged diagnostics access (`ADMIN` or `AUDITOR`) and is not exposed for retail client workflows.

## Privileged endpoints

| Endpoint | Purpose | Allowed userType | Denied userType | Deny code |
|---|---|---|---|---|
| `GET /api/holdings/portfolio/{portfolioId}/reconcile` | Replay executed logs and compare persisted holdings projection values | `ADMIN`, `AUDITOR` | `RETAIL_CLIENT` | `403` |
| `GET /api/order-logs/diagnostics/portfolio/{portfolioId}` | Read newest-first portfolio order logs for diagnostics workflows | `ADMIN`, `AUDITOR` | `RETAIL_CLIENT` | `403` |

- Shared access guard: `PrivilegedAccessService.ensureAdminOrAuditor()`.

## Database schema (as it actually exists in Supabase today)

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `userID`(PK), `email`(unique), `userType`, `firstName`, `lastName`, `city`, `state`, `country`, `zipCode`, `dob`, `avatar` | Merged from the old separate `users` + `profiles` tables. Linked to `auth.users` via Supabase trigger: when an `auth.users` row is created, the trigger creates a matching `profiles` row with `userID = auth.users.id`. Entity: `Profile` |
| `portfolios` | `portfolioID`(PK), `cashHoldings`, `userID`(FK→`profiles`, nullable) | No unique constraint on `userID` — a user can have multiple portfolios. Entity: `Portfolio` |
| `instruments` | `instrumentID`(PK), `ticker`, `type`, `market`, `price`, `last_update`, `logoUrl`, `description` | Centralized reference data for tradable instruments. `logoUrl` and `description` are synced from external API. Entity: `Instrument` |
| `holdings` | `holdingID`(PK), `portfolioID`(FK), `instrumentID`(FK), `currentQuantity`, `cumulativeRealizedPnl`, `updatedAt` | Current position projection table. Entity: `Holding` |
| `position_lots` | `positionLotID`(PK), `holdingID`(FK), `sourceBuyLogOrderID`(FK), `openedAt`, `originalQuantity`, `remainingQuantity`, `unitCost` | FIFO buy lots used for partial sell tracking. Entity: `PositionLot` |
| `lot_matches` | `lotMatchID`(PK), `sellLogOrderID`(FK), `positionLotID`(FK), `holdingID`(FK), `matchedQuantity`, `sellUnitPrice`, `realizedPnlAmount`, `matchedAt` | Sell-to-lot realization slices and realized PnL audit trail. Entity: `LotMatch` |
| `orders` | `orderID`(PK), `portfolioID`(FK), `instrumentID`(FK, nullable), `quantity`, `initTime`, `side`(**text**, nullable — was boolean before this schema update; buy/sell convention needs reconfirming), `initPrice` | Entity: `TradeOrder` |
| `logs` | `logID`(PK), `orderID`(FK), `logTime`, `status`, `executePrice` | Order status/execution trail. Entity: `OrderLog` |
| `watchlists` | `watchListID`(PK), `portfolioID`(FK), `name`, `priority` | Ordered by `priority` ascending (lower = closer to top). Run `tools/supabase-sql/02-add-watchlist-priority.sql` to add this column. Entity: `Watchlist` |
| `watchlist_items` | `listItemID`(PK), `watchListID`(FK), `instrumentID`(FK), `priority` | Entity: `WatchlistItem` |

RLS is enabled on every table but has **no policies defined** (default-deny for the anon/PostgREST API — irrelevant to this backend, since its DB role bypasses RLS).

## Setup

### 1. Supabase Schema (one-time setup)

See [SETUP_SUPABASE_SCHEMA.md](../SETUP_SUPABASE_SCHEMA.md) — run the SQL files in this order:
1. `tools/supabase-sql/00-create-profiles-table.sql`
2. `tools/supabase-sql/01-auth-trigger.sql`
3. `tools/supabase-sql/04-holdings-fifo-projections.sql`
4. `tools/supabase-sql/06-seed-cash-instrument.sql`

This creates the auth trigger that links `auth.users.id` → `profiles.userID` on signup.

### 2. Running locally

See [REQUIREMENTS.md](REQUIREMENTS.md) for tooling versions and required Supabase access first.

```powershell
copy .env.example .env   # then fill in real values, see REQUIREMENTS.md
./mvnw spring-boot:run
```

Runs on `http://localhost:8081`. Check `http://localhost:8081/actuator/health` — `db` should report `UP`.

### Useful commands

```powershell
./mvnw clean package -DskipTests   # build the jar without running tests
./mvnw test                        # run tests
java -jar target\backend-0.0.1-SNAPSHOT.jar   # run the packaged jar directly
```
