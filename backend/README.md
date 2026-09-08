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
| Order business logic (risk checks, real REST DTOs, ownership-scoped endpoints) | ❌ Not started — controllers/services are still stubs echoing raw strings |

## Database schema (as it actually exists in Supabase today)

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `userID`(PK), `email`(unique), `userType`, `firstName`, `lastName`, `city`, `state`, `country`, `zipCode`, `dob`, `avatar` | Merged from the old separate `users` + `profiles` tables. Linked to `auth.users` via Supabase trigger: when an `auth.users` row is created, the trigger creates a matching `profiles` row with `userID = auth.users.id`. Entity: `Profile` |
| `portfolios` | `portfolioID`(PK), `cashHoldings`, `userID`(FK→`profiles`, nullable) | No unique constraint on `userID` — a user can have multiple portfolios. Entity: `Portfolio` |
| `instruments` | `instrumentID`(PK), `ticker`, `type`, `market`, `price`, `last_update` | New: centralized reference data for tradable instruments. Entity: `Instrument` |
| `holdings` | `holdingID`(PK), `portfolioID`(FK), `instrumentID`(FK), `quantity`, `cost` | The positions table. Entity: `Holding` |
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
