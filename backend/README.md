# JAAKD Backend

Spring Boot API backend for JAAKD. Connects directly to Supabase Postgres (privileged role) and validates Supabase-issued JWTs from the Angular client.

## Architecture

```
Angular client --HTTPS + Supabase JWT--> this backend --JDBC (privileged role)--> Supabase Postgres
```

- The client never queries trading data directly against Supabase — only auth (sign up/in/out, session, JWT) goes straight to Supabase from the client. All domain data (orders, holdings, portfolios, transactions) goes through this backend's REST API.
- This backend connects to Postgres with a **privileged DB role** (not the anon/publishable key), so it can read/write regardless of Row Level Security policies.
- This backend validates every incoming request's `Authorization: Bearer <token>` (except `/actuator/**`) against Supabase's JWKS endpoint — no shared secret involved.

## What's implemented

| Area | Status |
|---|---|
| Postgres connectivity (JPA/Hibernate) | ✅ Done, verified live |
| JWT validation (Supabase ES256 / JWKS) | ✅ Done, verified live (`/actuator/health` public, `/api/**` returns 401 without a token) |
| JPA entities/repositories for all 9 real Supabase tables | ✅ Done, schema-validated against the live DB |
| Order/transaction business logic (risk checks, real REST DTOs, ownership-scoped endpoints) | ❌ Not started — controllers/services are still stubs echoing raw strings |

## Database schema (as it actually exists in Supabase today)

> ⚠️ [../prototypes/Jack/supabase-schema/schema.md](../prototypes/Jack/supabase-schema/schema.md) is a **draft design that was never applied**. Do not treat it as ground truth. The tables below are what's actually live, confirmed via `psql` against the project.

All tables are in the `public` schema (no `app`/`reporting` schema exists):

| Table | Key columns | Notes |
|---|---|---|
| `users` | `userID`(PK), `email`(unique), `userType`, `firstName`, `lastName`, `city`, `state`, `country`, `zipCode`, `dob` | App-level user profile, separate from Supabase `auth.users`. Entity: `AppUser` |
| `profiles` | `id`(PK, FK→`auth.users`), `full_name`, `avatar_url` | RLS: owner can `SELECT` their own row. Entity: `Profile` |
| `portfolio` | `portfolioID`(PK), `cashHoldings`, `userID`(FK→`users`, nullable) | No unique constraint on `userID` — a user can have multiple portfolios. Entity: `Portfolio` |
| `holdingID` (table literally named this) | `holdingID`(PK), `portfolioID`(FK), `ticker`, `quantity`, `avgCost`, `lastUpdate` | This is the positions/holdings table. Entity: `Holding` |
| `orders` | `orderID`(PK), `portfolioID`(FK), `ticker`, `quantity`, `initTime`, `market`, `side`(**boolean**, `true` = buy, `false` = sell), `initPrice` | Entity: `TradeOrder` |
| `log` | `logID`(PK), `orderID`(FK), `logTime`, `status`, `executePrice` | Order status/execution trail. Entity: `OrderLog` |
| `transactions` | `id`(PK), `created_at` | **Stub only** — no `amount`/`type`/`account` columns yet, not usable as a real cash ledger. Entity: `Transaction` |
| `watchList` | `watchListID`(PK), `portfolioID`(FK), `name` | Entity: `Watchlist` |
| `watchListItem` | `listItemID`(PK), `watchListID`(FK), `ticker`, `priority` | Entity: `WatchlistItem` |

RLS is enabled on every table but most have **no policies defined** (default-deny for the anon/PostgREST API — irrelevant to this backend, since its DB role bypasses RLS).

## Running locally

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
